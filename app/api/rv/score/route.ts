import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rvSessions, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { XP_RV_SESSION, levelForXp, utcDateString } from "@/lib/drill";
import {
  SELF_SCORE_CATEGORIES,
  isSelfScoreValue,
  rvVerdictLine,
  type SelfScoreValue,
} from "@/lib/rv";

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
  const raw = ((body as Record<string, unknown>)?.selfScore ?? {}) as Record<string, unknown>;
  const selfScore: Partial<Record<(typeof SELF_SCORE_CATEGORIES)[number], SelfScoreValue>> = {};
  for (const category of SELF_SCORE_CATEGORIES) {
    const value = raw[category];
    if (!isSelfScoreValue(value)) {
      return NextResponse.json({ error: `Missing score for ${category}` }, { status: 400 });
    }
    selfScore[category] = value;
  }

  const today = utcDateString();
  const db = getDb();

  // Guarded update: scores are immutable once submitted.
  const updated = await db
    .update(rvSessions)
    .set({ selfScoreJson: selfScore })
    .where(
      and(
        eq(rvSessions.userId, user.id),
        eq(rvSessions.sessionDate, today),
        isNull(rvSessions.selfScoreJson),
      ),
    )
    .returning({ id: rvSessions.id });
  if (updated.length === 0) {
    return NextResponse.json(
      { error: "No unscored session for today" },
      { status: 409 },
    );
  }

  await db
    .insert(xpEvents)
    .values({ userId: user.id, source: "rv_session", amount: XP_RV_SESSION });
  const [updatedUser] = await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${XP_RV_SESSION}` })
    .where(eq(users.id, user.id))
    .returning({ xp: users.xp });
  await db
    .update(users)
    .set({ level: levelForXp(updatedUser.xp) })
    .where(eq(users.id, user.id));

  return NextResponse.json({
    state: "scored",
    selfScore,
    xpAwarded: XP_RV_SESSION,
    totalXp: updatedUser.xp,
    level: levelForXp(updatedUser.xp),
    mascotLine: rvVerdictLine(selfScore.overall as SelfScoreValue),
  });
}
