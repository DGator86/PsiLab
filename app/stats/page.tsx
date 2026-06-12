import Link from "next/link";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { trials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { utcDayStart } from "@/lib/daily";
import { CHANCE_RATE, previousUtcDate, utcDateString } from "@/lib/drill";
import { lineForHitRate } from "@/lib/mascot";
import { binomialTwoSidedP, wilsonInterval } from "@/lib/stats";

export const dynamic = "force-dynamic";

type DayRow = { day: string; n: number; hits: number };

export default async function StatsPage() {
  const user = await getCurrentUser();

  let n = 0;
  let hits = 0;
  let days: DayRow[] = [];

  if (user) {
    const db = getDb();
    const [agg] = await db
      .select({
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)::int`,
      })
      .from(trials)
      .where(and(eq(trials.userId, user.id), isNotNull(trials.guessedAt)));
    n = agg?.n ?? 0;
    hits = agg?.hits ?? 0;

    const since = utcDayStart(previousUtcDate(utcDateString(), 13));
    days = await db
      .select({
        day: sql<string>`to_char(${trials.guessedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)::int`,
      })
      .from(trials)
      .where(
        and(eq(trials.userId, user.id), isNotNull(trials.guessedAt), gte(trials.guessedAt, since)),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`);
  }

  const hitRate = n > 0 ? hits / n : 0;
  const ci = wilsonInterval(hits, n);
  const pValue = binomialTwoSidedP(hits, n, CHANCE_RATE);
  const mascotLine = lineForHitRate(hits, n, CHANCE_RATE);

  // Fill in the last 14 days so the sparkline has a fixed width.
  const today = utcDateString();
  const series: DayRow[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = previousUtcDate(today, i);
    series.push(days.find((d) => d.day === day) ?? { day, n: 0, hits: 0 });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Honest statistics
          </p>
          <h1 className="mt-1 text-xl font-semibold">Card drill results</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-card-border bg-card/80 p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Trials</p>
          <p className="mt-2 text-2xl font-semibold">{n}</p>
        </article>
        <article className="rounded-2xl border border-card-border bg-card/80 p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Hit rate</p>
          <p className="mt-2 text-2xl font-semibold">
            {n > 0 ? `${(hitRate * 100).toFixed(1)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">Chance: {(CHANCE_RATE * 100).toFixed(0)}%</p>
        </article>
        <article className="rounded-2xl border border-card-border bg-card/80 p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Hits</p>
          <p className="mt-2 text-2xl font-semibold">{hits}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-card-border bg-card/80 p-6">
        <h2 className="text-base font-semibold">The math</h2>
        {n === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No answered trials yet.{" "}
            <Link href="/drill" className="text-[var(--accent-phosphor)] underline">
              Run your first drill
            </Link>
            .
          </p>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">95% confidence interval (Wilson)</dt>
              <dd className="font-mono">
                {(ci.low * 100).toFixed(1)}% – {(ci.high * 100).toFixed(1)}%
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Two-sided exact binomial test vs 25%</dt>
              <dd className="font-mono">p = {pValue < 0.0001 ? "< 0.0001" : pValue.toFixed(4)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Verdict</dt>
              <dd>
                {pValue < 0.05
                  ? "Statistically distinguishable from chance"
                  : "Consistent with chance"}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-2xl border border-card-border bg-card/80 p-6">
        <h2 className="text-base font-semibold">Last 14 days</h2>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {series.map((d) => {
            const rate = d.n > 0 ? d.hits / d.n : 0;
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end rounded bg-white/5">
                  <div
                    className={`w-full rounded ${
                      d.n === 0 ? "bg-transparent" : "bg-[var(--accent-phosphor)]"
                    }`}
                    style={{ height: `${Math.max(d.n === 0 ? 0 : 6, rate * 100 * 0.8)}%` }}
                    title={`${d.day}: ${d.hits}/${d.n}`}
                  />
                </div>
                <span className="font-mono text-[9px] text-muted">{d.day.slice(8)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          Bar height = daily hit rate. Dashed expectation: 25%.
        </p>
      </section>

      <section className="rounded-2xl border border-card-border bg-card/80 p-5">
        <p className="text-sm text-muted">🦉 Nox: “{mascotLine}”</p>
      </section>
    </main>
  );
}
