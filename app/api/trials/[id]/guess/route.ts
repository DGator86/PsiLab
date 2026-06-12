import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { trials, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { countGuessedToday } from "@/lib/daily";
import {
  DAILY_GOAL,
  DRILLS,
  XP_PER_HIT,
  XP_PER_TRIAL,
  XP_SESSION_BONUS,
  calibrationBonusXp,
  isDrillType,
  levelForXp,
  updateStreakOnCompletion,
} from "@/lib/drill";
import { lineForResult } from "@/lib/mascot";

type Body = {
  guess?: string;
  confidence?: number;
  latencyMs?: number;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }

  const { id } = await params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const guess = body.guess;
  const confidence =
    typeof body.confidence === "number"
      ? Math.round(Math.min(100, Math.max(0, body.confidence)))
      : null;
  const latencyMs =
    typeof body.latencyMs === "number" && body.latencyMs >= 0
      ? Math.round(body.latencyMs)
      : null;

  const db = getDb();
  const trial = await db.query.trials.findFirst({
    where: eq(trials.id, id),
  });
  if (!trial || trial.userId !== user.id) {
    return NextResponse.json({ error: "Trial not found" }, { status: 404 });
  }
  if (trial.guessedAt) {
    return NextResponse.json({ error: "Trial already answered" }, { status: 409 });
  }
  if (
    !guess ||
    !isDrillType(trial.drillType) ||
    !DRILLS[trial.drillType].options.includes(guess)
  ) {
    return NextResponse.json({ error: "Invalid guess" }, { status: 400 });
  }

  const correct = guess === trial.answer;

  // Guarded update so a double-submit can't score the trial twice.
  const updated = await db
    .update(trials)
    .set({ guess, correct, confidence, latencyMs, guessedAt: new Date() })
    .where(and(eq(trials.id, id), isNull(trials.guessedAt)))
    .returning({ id: trials.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Trial already answered" }, { status: 409 });
  }

  const calibrationXp = calibrationBonusXp(confidence, correct);
  let xpAwarded = XP_PER_TRIAL + (correct ? XP_PER_HIT : 0) + calibrationXp;
  await db
    .insert(xpEvents)
    .values({ userId: user.id, source: "trial", amount: XP_PER_TRIAL + (correct ? XP_PER_HIT : 0) });
  if (calibrationXp > 0) {
    await db
      .insert(xpEvents)
      .values({ userId: user.id, source: "calibration", amount: calibrationXp });
  }

  const dailyProgress = await countGuessedToday(user.id);
  const sessionCompleted = dailyProgress === DAILY_GOAL;

  let streak = {
    count: user.streakCount,
    freezeAvailable: user.streakFreezeAvailable,
    freezeUsed: false,
  };
  let newXp = user.xp + xpAwarded;

  if (sessionCompleted) {
    const update = updateStreakOnCompletion({
      streakCount: user.streakCount,
      streakFreezeAvailable: user.streakFreezeAvailable,
      lastCompletedDate: user.lastCompletedDate,
    });
    await db
      .insert(xpEvents)
      .values({ userId: user.id, source: "session_bonus", amount: XP_SESSION_BONUS });
    xpAwarded += XP_SESSION_BONUS;
    newXp += XP_SESSION_BONUS;
    streak = {
      count: update.streakCount,
      freezeAvailable: update.streakFreezeAvailable,
      freezeUsed: update.freezeUsed,
    };
    await db
      .update(users)
      .set({
        xp: newXp,
        level: levelForXp(newXp),
        streakCount: update.streakCount,
        streakFreezeAvailable: update.streakFreezeAvailable,
        lastCompletedDate: update.lastCompletedDate,
      })
      .where(eq(users.id, user.id));
  } else {
    await db
      .update(users)
      .set({ xp: newXp, level: levelForXp(newXp) })
      .where(eq(users.id, user.id));
  }

  return NextResponse.json({
    correct,
    answer: trial.answer,
    // Commit-reveal proof: sha256(`${answer}:${salt}`) must equal commitHash
    // the client received when the trial was created.
    commitSalt: trial.commitSalt,
    commitHash: trial.commitHash,
    mascotLine: lineForResult(correct),
    xpAwarded,
    calibrationXp,
    totalXp: newXp,
    level: levelForXp(newXp),
    dailyProgress,
    dailyGoal: DAILY_GOAL,
    sessionCompleted,
    streak,
  });
}
