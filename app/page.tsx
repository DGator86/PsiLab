import Link from "next/link";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { focusSessions, rvSessions, trials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { countGuessedToday, utcDayStart } from "@/lib/daily";
import { DAILY_GOAL, LEVELS, utcDateString } from "@/lib/drill";
import { lineForHitRate } from "@/lib/mascot";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  let dailyProgress = 0;
  let n = 0;
  let hits = 0;
  let chanceWeighted = 0.25;
  let rvDone = false;
  let focusDone = false;

  if (user) {
    const db = getDb();
    dailyProgress = await countGuessedToday(user.id);
    const [agg] = await db
      .select({
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)::int`,
        expected: sql<number>`coalesce(sum(case ${trials.drillType} when 'redblack' then 0.5 else 0.25 end), 0)`,
      })
      .from(trials)
      .where(and(eq(trials.userId, user.id), isNotNull(trials.guessedAt)));
    n = agg?.n ?? 0;
    hits = agg?.hits ?? 0;
    if (n > 0) chanceWeighted = Number(agg.expected) / n;

    const today = utcDateString();
    const rv = await db.query.rvSessions.findFirst({
      where: and(eq(rvSessions.userId, user.id), eq(rvSessions.sessionDate, today)),
    });
    rvDone = !!rv;
    const [focusRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, user.id), gte(focusSessions.createdAt, utcDayStart())));
    focusDone = (focusRow?.count ?? 0) > 0;
  }

  const xp = user?.xp ?? 0;
  const level = user?.level ?? "Novice";
  const nextLevel = LEVELS.find((l) => l.minXp > xp);
  const sessionDone = dailyProgress >= DAILY_GOAL;

  const practices = [
    {
      href: "/drill?type=zener4",
      title: "Quick-fire · Symbols",
      desc: "1-of-4 guess. Chance 25%.",
      done: sessionDone,
      status: `${Math.min(dailyProgress, DAILY_GOAL)}/${DAILY_GOAL} today`,
    },
    {
      href: "/drill?type=redblack",
      title: "Quick-fire · Red or black",
      desc: "Card color call. Chance 50%.",
      done: sessionDone,
      status: "counts toward the same session",
    },
    {
      href: "/rv",
      title: "Remote viewing",
      desc: "One hidden target a day. Impressions first.",
      done: rvDone,
      status: rvDone ? "done today" : "target waiting",
    },
    {
      href: "/focus",
      title: "Focus training",
      desc: "5–20 min. Then journal what you noticed.",
      done: focusDone,
      status: focusDone ? "done today" : "not yet",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-card-border bg-card/70 p-6 backdrop-blur">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">PsiLab</p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Third Eye</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          We don&apos;t ask you to believe. We help you test.
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
        {sessionDone && (
          <p className="mt-3 text-sm text-[var(--accent-phosphor)]">
            Daily session complete. Extra trials still count toward your stats.
          </p>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {practices.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group rounded-xl border border-card-border bg-black/20 p-4 transition hover:border-[var(--accent-phosphor)]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold group-hover:text-[var(--accent-phosphor)]">
                  {p.title}
                </p>
                {p.done && <span className="text-[var(--accent-phosphor)]">✓</span>}
              </div>
              <p className="mt-1 text-xs text-muted">{p.desc}</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted">
                {p.status}
              </p>
            </Link>
          ))}
        </div>
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
          <p className="mt-2 text-xl font-semibold">{level}</p>
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
            Chance {(chanceWeighted * 100).toFixed(0)}% · {n} trials ·{" "}
            <Link href="/stats" className="underline">
              stats
            </Link>
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-card-border bg-card/80 p-5">
        <p className="text-sm text-muted">
          🦉 Nox the Pocket Owl: “{lineForHitRate(hits, n, chanceWeighted)}”
        </p>
      </section>
    </main>
  );
}
