import { createHash, randomBytes } from "node:crypto";

export type DrillType = "zener4" | "redblack";

export const DRILLS: Record<
  DrillType,
  { label: string; options: readonly string[]; chance: number }
> = {
  zener4: {
    label: "Symbol guess",
    options: ["circle", "cross", "waves", "star"] as const,
    chance: 0.25,
  },
  redblack: {
    label: "Red or black",
    options: ["red", "black"] as const,
    chance: 0.5,
  },
};

export const DRILL_TYPES = Object.keys(DRILLS) as DrillType[];

export function isDrillType(value: string): value is DrillType {
  return value in DRILLS;
}

export const DAILY_GOAL = 10;

export const XP_PER_TRIAL = 2;
export const XP_PER_HIT = 5;
export const XP_SESSION_BONUS = 10;
export const XP_RV_SESSION = 15;
export const XP_RV_JUDGE_HIT = 10;
export const XP_FOCUS_PER_SESSION = 10;
export const XP_PK_SESSION = 5;
export const XP_ARV_PREDICTION = 5;
export const XP_ARV_HIT = 10;
export const XP_SKYWATCH_LOG = 10;
export const XP_QUEST_BONUS = 20;
export const XP_PREREG_BONUS = 50;

/**
 * Calibration bonus (the app's quiet thesis): a Brier-based proper scoring
 * rule, so reporting your honest confidence maximizes expected XP.
 * brier = (confidence - outcome)^2, bonus = 0..3 XP.
 */
export function calibrationBonusXp(confidence: number | null, correct: boolean): number {
  if (confidence === null) return 0;
  const c = Math.min(100, Math.max(0, confidence)) / 100;
  const brier = (c - (correct ? 1 : 0)) ** 2;
  return Math.round(3 * (1 - brier));
}

export const LEVELS: { name: string; minXp: number }[] = [
  { name: "Novice", minXp: 0 },
  { name: "Sensitive", minXp: 100 },
  { name: "Calibrated", minXp: 300 },
  { name: "Statistically Anomalous", minXp: 700 },
  { name: "Immaculate", minXp: 1500 },
];

export function levelForXp(xp: number): string {
  let current = LEVELS[0].name;
  for (const level of LEVELS) {
    if (xp >= level.minXp) current = level.name;
  }
  return current;
}

/** Unbiased pick from a cryptographic source via rejection sampling. */
export function pickFrom<T>(options: readonly T[]): T {
  const max = Math.floor(256 / options.length) * options.length;
  for (;;) {
    const byte = randomBytes(1)[0];
    if (byte < max) return options[byte % options.length];
  }
}

export function makeCommitment(answer: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: commitHash(answer, salt) };
}

export function commitHash(answer: string, salt: string): string {
  return createHash("sha256").update(`${answer}:${salt}`).digest("hex");
}

export function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function previousUtcDate(dateStr: string, daysBack = 1): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return utcDateString(d);
}

export type StreakUpdate = {
  streakCount: number;
  streakFreezeAvailable: boolean;
  freezeUsed: boolean;
  lastCompletedDate: string;
};

/**
 * Streak rules, applied when today's session is completed:
 * - completed yesterday: streak continues
 * - missed exactly one day with a freeze available: freeze is consumed, streak continues
 * - otherwise: streak restarts at 1
 * A consumed freeze is earned back every time the streak reaches a multiple of 7
 * (one free freeze per week of consistent practice).
 */
export function updateStreakOnCompletion(
  current: { streakCount: number; streakFreezeAvailable: boolean; lastCompletedDate: string | null },
  today: string = utcDateString(),
): StreakUpdate {
  const yesterday = previousUtcDate(today, 1);
  const twoDaysAgo = previousUtcDate(today, 2);

  if (current.lastCompletedDate === today) {
    return {
      streakCount: current.streakCount,
      streakFreezeAvailable: current.streakFreezeAvailable,
      freezeUsed: false,
      lastCompletedDate: today,
    };
  }

  let streakCount: number;
  let freezeUsed = false;
  let freezeAvailable = current.streakFreezeAvailable;

  if (current.lastCompletedDate === yesterday) {
    streakCount = current.streakCount + 1;
  } else if (current.lastCompletedDate === twoDaysAgo && current.streakFreezeAvailable) {
    streakCount = current.streakCount + 1;
    freezeUsed = true;
    freezeAvailable = false;
  } else {
    streakCount = 1;
  }

  if (!freezeAvailable && streakCount > 0 && streakCount % 7 === 0) {
    freezeAvailable = true;
  }

  return { streakCount, streakFreezeAvailable: freezeAvailable, freezeUsed, lastCompletedDate: today };
}
