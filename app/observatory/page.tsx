import Link from "next/link";
import { isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { arvPredictions, pkSessions, rvSessions, trials, users } from "@/db/schema";
import { binomialTwoSidedP, binomialZ, wilsonInterval } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * The population-level truth: anonymous aggregates across every user.
 * If psi is real and trainable, it should show up here first — and if it
 * isn't, this page is the world's most patient null result.
 */
export default async function ObservatoryPage() {
  const db = getDb();

  const trialAggs = await db
    .select({
      drillType: trials.drillType,
      n: sql<number>`count(*)::int`,
      hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)::int`,
    })
    .from(trials)
    .where(isNotNull(trials.guessedAt))
    .groupBy(trials.drillType);

  const judgeAggs = await db
    .select({
      mode: rvSessions.mode,
      n: sql<number>`count(*)::int`,
      hits: sql<number>`coalesce(sum(case when ${rvSessions.judgeCorrect} then 1 else 0 end), 0)::int`,
    })
    .from(rvSessions)
    .where(isNotNull(rvSessions.judgedAt))
    .groupBy(rvSessions.mode);

  const [arvAgg] = await db
    .select({
      n: sql<number>`count(*)::int`,
      hits: sql<number>`coalesce(sum(case when ${arvPredictions.correct} then 1 else 0 end), 0)::int`,
    })
    .from(arvPredictions)
    .where(isNotNull(arvPredictions.correct));

  const pkAggs = await db
    .select({
      intention: pkSessions.intention,
      sessions: sql<number>`count(*)::int`,
      meanZ: sql<number>`avg(${pkSessions.zScore})`,
    })
    .from(pkSessions)
    .groupBy(pkSessions.intention);

  const [population] = await db.select({ n: sql<number>`count(*)::int` }).from(users);

  const rows = [
    { label: "Symbols (1-of-4)", chance: 0.25, ...agg(trialAggs.find((t) => t.drillType === "zener4")) },
    { label: "Red / Black", chance: 0.5, ...agg(trialAggs.find((t) => t.drillType === "redblack")) },
    { label: "RV blind judging", chance: 0.25, ...agg(judgeAggs.find((j) => j.mode === "rv")) },
    { label: "Ganzfeld judging", chance: 0.25, ...agg(judgeAggs.find((j) => j.mode === "ganzfeld")) },
    { label: "Drawing judging", chance: 0.25, ...agg(judgeAggs.find((j) => j.mode === "drawing")) },
    { label: "ARV predictions", chance: 0.5, n: Number(arvAgg?.n ?? 0), hits: Number(arvAgg?.hits ?? 0) },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Global observatory
          </p>
          <h1 className="mt-1 text-xl font-semibold">Everyone vs. the universe</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      <p className="text-sm text-muted">
        Anonymous aggregates across all {Number(population?.n ?? 0)} participants. No usernames, no
        leaderboards — just the population hit rate sitting next to chance, daring it to blink.
      </p>

      <section className="space-y-2">
        {rows.map((row) => {
          if (row.n === 0) {
            return (
              <div key={row.label} className="flex items-baseline justify-between rounded-2xl border border-card-border bg-card/80 px-5 py-4 text-sm">
                <span className="text-muted">{row.label}</span>
                <span className="font-mono text-xs text-muted">no data yet</span>
              </div>
            );
          }
          const rate = row.hits / row.n;
          const ci = wilsonInterval(row.hits, row.n);
          const z = binomialZ(row.hits, row.n, row.chance);
          const p = binomialTwoSidedP(row.hits, row.n, row.chance);
          return (
            <div key={row.label} className="rounded-2xl border border-card-border bg-card/80 px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{row.label}</span>
                <span className="font-mono text-sm">
                  {(rate * 100).toFixed(2)}% <span className="text-xs text-muted">vs {(row.chance * 100).toFixed(0)}%</span>
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {row.hits.toLocaleString()}/{row.n.toLocaleString()} · 95% CI {(ci.low * 100).toFixed(1)}–
                {(ci.high * 100).toFixed(1)}% · z = {z.toFixed(2)} · p = {p < 0.0001 ? "< 0.0001" : p.toFixed(4)}
              </p>
            </div>
          );
        })}
      </section>

      {pkAggs.length > 0 && (
        <section className="rounded-2xl border border-card-border bg-card/80 p-6">
          <h2 className="text-base font-semibold">PK · all users</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {(["high", "low", "control"] as const).map((i) => {
              const row = pkAggs.find((p) => p.intention === i);
              return (
                <div key={i} className="flex justify-between">
                  <dt className="capitalize text-muted">{i}</dt>
                  <dd className="font-mono">
                    {row ? `${row.sessions} sessions · mean z = ${Number(row.meanZ).toFixed(3)}` : "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      <p className="text-xs text-muted">
        🦉 “If the population hit rate ever leaves that confidence interval and stays out,
        you&apos;ll hear it from us first. Until then: the universe remains coy.”
      </p>
    </main>
  );
}

function agg(row: { n: number; hits: number } | undefined): { n: number; hits: number } {
  return { n: Number(row?.n ?? 0), hits: Number(row?.hits ?? 0) };
}
