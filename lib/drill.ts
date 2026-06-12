import { createHash, randomBytes } from "node:crypto";

export const DRILL_TYPE = "zener4";

export const SYMBOLS = ["circle", "cross", "waves", "star"] as const;
export type Symbol = (typeof SYMBOLS)[number];

export const CHANCE_RATE = 1 / SYMBOLS.length;

export const DAILY_GOAL = 10;

export const XP_PER_TRIAL = 2;
export const XP_PER_HIT = 5;
export const XP_SESSION_BONUS = 10;

export const LEVELS: { name: string; minXp: number }[] = [
  { name: "Novice", minXp: 0 },
  { name: "Apprentice", minXp: 100 },
  { name: "Adept", minXp: 300 },
  { name: "Oracle", minXp: 700 },
  { name: "Clairvoyant", minXp: 1500 },
];

export function levelForXp(xp: number): string {
  let current = LEVELS[0].name;
  for (const level of LEVELS) {
    if (xp >= level.minXp) current = level.name;
  }
  return current;
}

export function pickAnswer(): Symbol {
  // Rejection sampling for an unbiased pick from a cryptographic source.
  // (256 % 4 === 0 so a single byte mod 4 is already unbiased, but stay
  // robust if the symbol count changes.)
  const max = Math.floor(256 / SYMBOLS.length) * SYMBOLS.length;
  for (;;) {
    const byte = randomBytes(1)[0];
    if (byte < max) return SYMBOLS[byte % SYMBOLS.length];
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
 * A consumed freeze is earned back every time the streak reaches a multiple of 7.
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
