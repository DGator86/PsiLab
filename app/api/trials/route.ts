import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { trials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { countGuessedToday } from "@/lib/daily";
import { DAILY_GOAL, DRILL_TYPE, SYMBOLS, makeCommitment, pickAnswer } from "@/lib/drill";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }

  const answer = pickAnswer();
  const { salt, hash } = makeCommitment(answer);

  const db = getDb();
  const [trial] = await db
    .insert(trials)
    .values({
      userId: user.id,
      drillType: DRILL_TYPE,
      answer,
      commitSalt: salt,
      commitHash: hash,
    })
    .returning({ id: trials.id, presentedAt: trials.presentedAt });

  const dailyProgress = await countGuessedToday(user.id);

  return NextResponse.json({
    trialId: trial.id,
    choices: SYMBOLS,
    commitHash: hash,
    presentedAt: trial.presentedAt,
    dailyProgress,
    dailyGoal: DAILY_GOAL,
  });
}
