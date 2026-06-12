import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { trials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { countGuessedToday } from "@/lib/daily";
import { DAILY_GOAL, DRILLS, isDrillType, makeCommitment, pickFrom } from "@/lib/drill";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }

  let drillType = "zener4";
  try {
    const body = await request.json();
    if (typeof body?.drillType === "string") drillType = body.drillType;
  } catch {
    // No body: default drill type.
  }
  if (!isDrillType(drillType)) {
    return NextResponse.json({ error: "Unknown drill type" }, { status: 400 });
  }

  const drill = DRILLS[drillType];
  const answer = pickFrom(drill.options);
  const { salt, hash } = makeCommitment(answer);

  const db = getDb();
  const [trial] = await db
    .insert(trials)
    .values({
      userId: user.id,
      drillType,
      answer,
      commitSalt: salt,
      commitHash: hash,
    })
    .returning({ id: trials.id, presentedAt: trials.presentedAt });

  const dailyProgress = await countGuessedToday(user.id);

  return NextResponse.json({
    trialId: trial.id,
    drillType,
    choices: drill.options,
    chance: drill.chance,
    commitHash: hash,
    presentedAt: trial.presentedAt,
    dailyProgress,
    dailyGoal: DAILY_GOAL,
  });
}
