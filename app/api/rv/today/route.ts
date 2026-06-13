import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rvSessions, rvTargets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { utcDateString } from "@/lib/drill";
import { isRvMode, sessionCode } from "@/lib/rv";
import { buildLineup } from "@/lib/rv-server";

/**
 * State machine for today's session in a given mode (rv | ganzfeld | drawing):
 *   pending  → no impressions yet
 *   judging  → impressions locked, blind 4-candidate lineup awaiting a pick
 *   judged   → lineup judged; rv mode still offers the subjective self-score
 *   scored   → rv mode fully complete
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }
  const mode = request.nextUrl.searchParams.get("mode") ?? "rv";
  if (!isRvMode(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const today = utcDateString();
  const db = getDb();

  const session = await db.query.rvSessions.findFirst({
    where: and(
      eq(rvSessions.userId, user.id),
      eq(rvSessions.sessionDate, today),
      eq(rvSessions.mode, mode),
    ),
  });

  const code = sessionCode(user.id, today, mode);

  if (!session) {
    return NextResponse.json({ state: "pending", code });
  }

  const decoyIds = (session.decoyIdsJson as string[] | null) ?? [];

  if (!session.judgedAt) {
    const lineup = await buildLineup(user.id, today, mode, session.targetId, decoyIds);
    return NextResponse.json({
      state: "judging",
      code,
      impressions: session.impressionsJson,
      confidence: session.confidence,
      sketchUrl: session.sketchUrl,
      lineup: lineup.map((c) => ({ id: c.id, imageUrl: c.imageUrl })),
    });
  }

  const target = await db.query.rvTargets.findFirst({
    where: eq(rvTargets.id, session.targetId),
  });

  return NextResponse.json({
    state: mode === "rv" && !session.selfScoreJson ? "judged" : "scored",
    code,
    impressions: session.impressionsJson,
    confidence: session.confidence,
    sketchUrl: session.sketchUrl,
    judgeCorrect: session.judgeCorrect,
    selfScore: session.selfScoreJson,
    target: target ? { id: target.id, imageUrl: target.imageUrl, tags: target.attributeTagsJson } : null,
  });
}
