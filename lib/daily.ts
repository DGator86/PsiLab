import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { trials } from "@/db/schema";
import { utcDateString } from "@/lib/drill";

export function utcDayStart(date: string = utcDateString()): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Number of trials the user has answered today (UTC). */
export async function countGuessedToday(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trials)
    .where(and(eq(trials.userId, userId), gte(trials.guessedAt, utcDayStart())));
  return row?.count ?? 0;
}
