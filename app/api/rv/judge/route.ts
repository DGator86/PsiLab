import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rvSessions, rvTargets, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { XP_RV_JUDGE_HIT, levelForXp, utcDateString } from "@/lib/drill";
import { isRvMode, judgeVerdictLine } from "@/lib/rv";
import { checkAchievements } from "@/lib/awards";

const XP_JUDGE_BASE = 5;

/**
 * Blind rank-order judging: the user picks which of the 4 candidates is the
 * real target. Forced choice at 25% chance — this is the objective RV stat.
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
  const pickId = typeof raw.pickId === "string" ? raw.pickId : null;
  if (!isRvMode(mode) || !pickId) {
    return NextResponse.json({ error: "Invalid judge payload" }, { status: 400 });
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
  if (!session) {
    return NextResponse.json({ error: "No session to judge" }, { status: 404 });
  }

  const decoyIds = (session.decoyIdsJson as string[] | null) ?? [];
  const validIds = [session.targetId, ...decoyIds];
  if (!validIds.includes(pickId)) {
    return NextResponse.json({ error: "Pick is not in the lineup" }, { status: 400 });
  }

  const correct = pickId === session.targetId;

  // Guarded update: judging is immutable once submitted.
  const updated = await db
    .update(rvSessions)
    .set({
      judgedTargetId: pickId,
      judgeCorrect: correct,
      judgedAt: new Date(),
      revealedAt: new Date(),
    })
    .where(and(eq(rvSessions.id, session.id), isNull(rvSessions.judgedAt)))
    .returning({ id: rvSessions.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Already judged" }, { status: 409 });
  }

  const xpAwarded = XP_JUDGE_BASE + (correct ? XP_RV_JUDGE_HIT : 0);
  await db
    .insert(xpEvents)
    .values({ userId: user.id, source: `${mode}_judge`, amount: xpAwarded });
  const [updatedUser] = await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${xpAwarded}` })
    .where(eq(users.id, user.id))
    .returning({ xp: users.xp });
  await db
    .update(users)
    .set({ level: levelForXp(updatedUser.xp) })
    .where(eq(users.id, user.id));

  const target = await db.query.rvTargets.findFirst({
    where: eq(rvTargets.id, session.targetId),
  });

  const newAchievements = await checkAchievements(user.id);

  return NextResponse.json({
    state: mode === "rv" ? "judged" : "scored",
    judgeCorrect: correct,
    target: target
      ? { id: target.id, imageUrl: target.imageUrl, tags: target.attributeTagsJson }
      : null,
    xpAwarded,
    totalXp: updatedUser.xp,
    level: levelForXp(updatedUser.xp),
    mascotLine: judgeVerdictLine(correct),
    newAchievements,
  });
}
