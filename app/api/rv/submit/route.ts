import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rvSessions, rvTargets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { utcDateString } from "@/lib/drill";
import { dailyTargetIndex, sanitizeImpressions } from "@/lib/rv";

/**
 * Locks in today's impressions and reveals the target.
 * The target was deterministically assigned before the user ever typed
 * a word; impressions are immutable once submitted.
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
  const impressions = sanitizeImpressions(raw.impressions);
  if (!impressions) {
    return NextResponse.json({ error: "Invalid impressions" }, { status: 400 });
  }
  const confidence =
    typeof raw.confidence === "number"
      ? Math.round(Math.min(100, Math.max(0, raw.confidence)))
      : null;

  const today = utcDateString();
  const db = getDb();

  const existing = await db.query.rvSessions.findFirst({
    where: and(eq(rvSessions.userId, user.id), eq(rvSessions.sessionDate, today)),
  });
  if (existing) {
    return NextResponse.json({ error: "Today's session is already locked" }, { status: 409 });
  }

  const pool = await db
    .select({ id: rvTargets.id, imageUrl: rvTargets.imageUrl, tags: rvTargets.attributeTagsJson })
    .from(rvTargets)
    .where(eq(rvTargets.active, true))
    .orderBy(asc(rvTargets.id));
  if (pool.length === 0) {
    return NextResponse.json({ error: "No targets in the pool yet" }, { status: 503 });
  }

  const target = pool[dailyTargetIndex(user.id, today, pool.length)];

  await db
    .insert(rvSessions)
    .values({
      userId: user.id,
      targetId: target.id,
      sessionDate: today,
      impressionsJson: impressions,
      confidence,
      revealedAt: new Date(),
    })
    .onConflictDoNothing();

  return NextResponse.json({
    state: "revealed",
    impressions,
    confidence,
    target: { imageUrl: target.imageUrl, tags: target.tags },
  });
}
