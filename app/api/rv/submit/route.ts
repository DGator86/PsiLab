import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rvSessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { utcDateString } from "@/lib/drill";
import {
  dailyTargetIndex,
  decoyIndices,
  isRvMode,
  sanitizeImpressions,
  sanitizeSketchUrl,
} from "@/lib/rv";
import { buildLineup, getActivePool } from "@/lib/rv-server";

/**
 * Locks in today's impressions for the given mode and returns the blind
 * 4-candidate lineup. The real target was deterministically assigned before
 * the user ever typed a word; impressions are immutable once submitted, and
 * nothing in the response indicates which candidate is real.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = (body as Record<string, unknown>) ?? {};
  const mode = typeof raw.mode === "string" ? raw.mode : "rv";
  if (!isRvMode(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
  const impressions = sanitizeImpressions(raw.impressions);
  if (!impressions) {
    return NextResponse.json({ error: "Invalid impressions" }, { status: 400 });
  }
  const confidence =
    typeof raw.confidence === "number"
      ? Math.round(Math.min(100, Math.max(0, raw.confidence)))
      : null;
  const sketchUrl = sanitizeSketchUrl(raw.sketchUrl);

  const today = utcDateString();
  const db = getDb();

  const existing = await db.query.rvSessions.findFirst({
    where: and(
      eq(rvSessions.userId, user.id),
      eq(rvSessions.sessionDate, today),
      eq(rvSessions.mode, mode),
    ),
  });
  if (existing) {
    return NextResponse.json({ error: "Today's session is already locked" }, { status: 409 });
  }

  const pool = await getActivePool(mode);
  if (pool.length < 4) {
    return NextResponse.json({ error: "Not enough targets in the pool yet" }, { status: 503 });
  }

  const targetIdx = dailyTargetIndex(user.id, today, pool.length, mode);
  const target = pool[targetIdx];
  const decoyIds = decoyIndices(user.id, today, pool.length, targetIdx, mode).map(
    (i) => pool[i].id,
  );

  await db
    .insert(rvSessions)
    .values({
      userId: user.id,
      targetId: target.id,
      sessionDate: today,
      mode,
      impressionsJson: impressions,
      confidence,
      sketchUrl,
      decoyIdsJson: decoyIds,
    })
    .onConflictDoNothing();

  const lineup = await buildLineup(user.id, today, mode, target.id, decoyIds);

  return NextResponse.json({
    state: "judging",
    impressions,
    confidence,
    sketchUrl,
    lineup: lineup.map((c) => ({ id: c.id, imageUrl: c.imageUrl })),
  });
}
