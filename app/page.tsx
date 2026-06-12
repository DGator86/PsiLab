import Link from "next/link";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { trials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { countGuessedToday } from "@/lib/daily";
import { CHANCE_RATE, DAILY_GOAL, LEVELS } from "@/lib/drill";
import { lineForHitRate } from "@/lib/mascot";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  let dailyProgress = 0;
  let n = 0;
  let hits = 0;

  if (user) {
    const db = getDb();
    dailyProgress = await countGuessedToday(user.id);
    const [agg] = await db
      .select({
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)::int`,
      })
      .from(trials)
      .where(and(eq(trials.userId, user.id), isNotNull(trials.guessedAt)));
    n = agg?.n ?? 0;
    hits = agg?.hits ?? 0;
  }

  const xp = user?.xp ?? 0;
  const level = user?.level ?? "Novice";
  const nextLevel = LEVELS.find((l) => l.minXp > xp);
  const sessionDone = dailyProgress >= DAILY_GOAL;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-card-border bg-card/70 p-6 backdrop-blur">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">PsiLab</p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Third Eye</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Daily intuition drills with honest statistics. The answers are committed
          server-side before you guess — no take-backs, for either of us.
        </p>
      </header>

      <section className="rounded-2xl border border-card-border bg-card/80 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Today&apos;s drills</h2>
          <span className="font-mono text-sm text-muted">
            {Math.min(dailyProgress, DAILY_GOAL)}/{DAILY_GOAL}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-[var(--accent-phosphor)]"
            style={{ width: `${Math.min(100, (dailyProgress / DAILY_GOAL) * 100)}%` }}
          />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Link
            href="/drill"
            className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            {sessionDone ? "Keep drilling" : dailyProgress > 0 ? "Continue session" : "Start session"}
          </Link>
          <Link
            href="/stats"
            className="rounded-xl border border-card-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
          >
            Stats
          </Link>
        </div>
        {sessionDone && (
          <p className="mt-3 text-sm text-[var(--accent-phosphor)]">
            Daily session complete. Extra trials still count toward your stats.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-card-border bg-card/80 p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Streak</p>
          <p className="mt-2 text-2xl font-semibold">{user?.streakCount ?? 0} days</p>
          <p className="mt-1 text-xs text-muted">
            Freeze: {user?.streakFreezeAvailable ? "available" : "used"}
          </p>
        </article>
        <article className="rounded-2xl border border-card-border bg-card/80 p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Level</p>
          <p className="mt-2 text-2xl font-semibold">{level}</p>
          <p className="mt-1 text-xs text-muted">
            {xp} XP{nextLevel ? ` · ${nextLevel.minXp - xp} to ${nextLevel.name}` : " · max level"}
          </p>
        </article>
        <article className="rounded-2xl border border-card-border bg-card/80 p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Hit rate</p>
          <p className="mt-2 text-2xl font-semibold">
            {n > 0 ? `${((hits / n) * 100).toFixed(1)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Chance {(CHANCE_RATE * 100).toFixed(0)}% · {n} trials
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-card-border bg-card/80 p-5">
        <p className="text-sm text-muted">
          🦉 Nox the Pocket Owl: “{lineForHitRate(hits, n, CHANCE_RATE)}”
        </p>
      </section>
    </main>
  );
}
