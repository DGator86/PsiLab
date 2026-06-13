import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  achievements,
  fieldLogs,
  focusSessions,
  pkSessions,
  preregistrations,
  rvSessions,
  trials,
  users,
  xpEvents,
} from "@/db/schema";
import { DAILY_GOAL, XP_QUEST_BONUS, levelForXp, utcDateString } from "@/lib/drill";
import { utcDayStart } from "@/lib/daily";

export const ACHIEVEMENT_DEFS: Record<string, { name: string; description: string; emoji: string }> = {
  first_blood: { name: "First Contact", description: "Answer your first trial.", emoji: "🔮" },
  century: { name: "Century", description: "Answer 100 forced-choice trials.", emoji: "💯" },
  statistically_immaculate: {
    name: "Statistically Immaculate",
    description: "Score within 1% of chance over 100+ trials. Perfection.",
    emoji: "⚖️",
  },
  calibrated: {
    name: "Calibrated",
    description: "Brier score ≤ 0.20 across 50+ confidence-rated trials.",
    emoji: "🎯",
  },
  random_walker: { name: "Random Walker", description: "Complete 5 PK RNG sessions.", emoji: "🎲" },
  certified_mundane: {
    name: "Certified Mundane",
    description: "File a sky-watch log with the full checklist and no anomaly flag.",
    emoji: "📋",
  },
  field_ready: { name: "Field Ready", description: "File your first sky-watch log.", emoji: "🔭" },
  blind_judge: { name: "Blind Justice", description: "Pick the real target in blind judging.", emoji: "🏛️" },
  committed: { name: "Committed", description: "Complete a preregistered run.", emoji: "📜" },
  streak_7: { name: "Week of the Void", description: "Hold a 7-day streak.", emoji: "🔥" },
  quest_day: { name: "Full Sweep", description: "Complete every daily practice in one day.", emoji: "🌌" },
};

async function award(userId: string, key: string): Promise<boolean> {
  const db = getDb();
  const inserted = await db
    .insert(achievements)
    .values({ userId, key })
    .onConflictDoNothing()
    .returning({ id: achievements.id });
  return inserted.length > 0;
}

/**
 * Lazy achievement sweep. Cheap aggregate queries; called after meaningful
 * completions (end of drill round, RV judge, PK session, sky-watch log...).
 * Returns the keys newly awarded.
 */
export async function checkAchievements(userId: string): Promise<string[]> {
  const db = getDb();
  const newly: string[] = [];

  const [agg] = await db
    .select({
      n: count(),
      hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)`,
      chanceSum: sql<number>`coalesce(sum(case when ${trials.drillType} = 'redblack' then 0.5 else 0.25 end), 0)`,
    })
    .from(trials)
    .where(and(eq(trials.userId, userId), isNotNull(trials.correct)));

  const n = Number(agg?.n ?? 0);
  const hits = Number(agg?.hits ?? 0);

  if (n >= 1 && (await award(userId, "first_blood"))) newly.push("first_blood");
  if (n >= 100 && (await award(userId, "century"))) newly.push("century");
  if (n >= 100) {
    const expected = Number(agg.chanceSum) / n;
    if (Math.abs(hits / n - expected) <= 0.01 && (await award(userId, "statistically_immaculate")))
      newly.push("statistically_immaculate");
  }

  const [cal] = await db
    .select({
      n: count(),
      brier: sql<number>`avg(power((${trials.confidence}::float / 100) - (case when ${trials.correct} then 1 else 0 end), 2))`,
    })
    .from(trials)
    .where(and(eq(trials.userId, userId), isNotNull(trials.correct), isNotNull(trials.confidence)));
  if (Number(cal?.n ?? 0) >= 50 && Number(cal.brier) <= 0.2 && (await award(userId, "calibrated")))
    newly.push("calibrated");

  const [pk] = await db
    .select({ n: count() })
    .from(pkSessions)
    .where(eq(pkSessions.userId, userId));
  if (Number(pk?.n ?? 0) >= 5 && (await award(userId, "random_walker"))) newly.push("random_walker");

  const [logsAll] = await db
    .select({ n: count() })
    .from(fieldLogs)
    .where(eq(fieldLogs.userId, userId));
  if (Number(logsAll?.n ?? 0) >= 1 && (await award(userId, "field_ready"))) newly.push("field_ready");

  const [logsMundane] = await db
    .select({ n: count() })
    .from(fieldLogs)
    .where(and(eq(fieldLogs.userId, userId), eq(fieldLogs.anomalousFlag, false)));
  if (Number(logsMundane?.n ?? 0) >= 1 && (await award(userId, "certified_mundane")))
    newly.push("certified_mundane");

  const [judged] = await db
    .select({ n: count() })
    .from(rvSessions)
    .where(and(eq(rvSessions.userId, userId), eq(rvSessions.judgeCorrect, true)));
  if (Number(judged?.n ?? 0) >= 1 && (await award(userId, "blind_judge"))) newly.push("blind_judge");

  const [prereg] = await db
    .select({ n: count() })
    .from(preregistrations)
    .where(and(eq(preregistrations.userId, userId), eq(preregistrations.status, "completed")));
  if (Number(prereg?.n ?? 0) >= 1 && (await award(userId, "committed"))) newly.push("committed");

  const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if ((me?.streakCount ?? 0) >= 7 && (await award(userId, "streak_7"))) newly.push("streak_7");

  return newly;
}

/**
 * Awards the daily quest bonus once per UTC day when the drill goal, the RV
 * target, and a focus session have all been completed. Idempotent.
 */
export async function maybeAwardDailyQuest(userId: string): Promise<number> {
  const db = getDb();
  const today = utcDateString();
  const dayStart = utcDayStart();

  const [already] = await db
    .select({ n: count() })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, userId),
        eq(xpEvents.source, "daily_quest"),
        gte(xpEvents.createdAt, dayStart),
      ),
    );
  if (Number(already?.n ?? 0) > 0) return 0;

  const [trialsToday] = await db
    .select({ n: count() })
    .from(trials)
    .where(and(eq(trials.userId, userId), gte(trials.guessedAt, dayStart)));
  if (Number(trialsToday?.n ?? 0) < DAILY_GOAL) return 0;

  const rvDone = await db.query.rvSessions.findFirst({
    where: and(
      eq(rvSessions.userId, userId),
      eq(rvSessions.sessionDate, today),
      eq(rvSessions.mode, "rv"),
      isNotNull(rvSessions.selfScoreJson),
    ),
  });
  if (!rvDone) return 0;

  const [focusToday] = await db
    .select({ n: count() })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), gte(focusSessions.createdAt, dayStart)));
  if (Number(focusToday?.n ?? 0) < 1) return 0;

  await db.insert(xpEvents).values({ userId, source: "daily_quest", amount: XP_QUEST_BONUS });
  const [updated] = await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${XP_QUEST_BONUS}` })
    .where(eq(users.id, userId))
    .returning({ xp: users.xp });
  if (updated) {
    await db.update(users).set({ level: levelForXp(updated.xp) }).where(eq(users.id, userId));
  }
  await award(userId, "quest_day");
  return XP_QUEST_BONUS;
}
