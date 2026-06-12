import Link from "next/link";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { trials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { utcDayStart } from "@/lib/daily";
import { DRILLS, DRILL_TYPES, previousUtcDate, utcDateString, type DrillType } from "@/lib/drill";
import { lineForHitRate } from "@/lib/mascot";
import { binomialTwoSidedP, wilsonInterval } from "@/lib/stats";

export const dynamic = "force-dynamic";

const MIN_TRIALS_FOR_VERDICT = 100;

type TypeAgg = { drillType: string; n: number; hits: number };
type DayRow = { drillType: string; day: string; n: number; hits: number };
type CalibrationBucket = { bucket: number; n: number; accuracy: number };
type HourRow = { bucket: string; n: number; hits: number; expected: number };

const chanceCase = sql<number>`case ${trials.drillType} when 'redblack' then 0.5 else 0.25 end`;

export default async function StatsPage() {
  const user = await getCurrentUser();

  let typeAggs: TypeAgg[] = [];
  let days: DayRow[] = [];
  let calibration: CalibrationBucket[] = [];
  let calibrationScore: number | null = null;
  let calibrationN = 0;
  let hours: HourRow[] = [];

  if (user) {
    const db = getDb();
    const answered = and(eq(trials.userId, user.id), isNotNull(trials.guessedAt));

    typeAggs = await db
      .select({
        drillType: trials.drillType,
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)::int`,
      })
      .from(trials)
      .where(answered)
      .groupBy(trials.drillType);

    const since = utcDayStart(previousUtcDate(utcDateString(), 13));
    days = await db
      .select({
        drillType: trials.drillType,
        day: sql<string>`to_char(${trials.guessedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)::int`,
      })
      .from(trials)
      .where(and(answered, gte(trials.guessedAt, since)))
      .groupBy(trials.drillType, sql`2`)
      .orderBy(sql`2`);

    calibration = await db
      .select({
        bucket: sql<number>`least(4, floor(${trials.confidence} / 20))::int`,
        n: sql<number>`count(*)::int`,
        accuracy: sql<number>`avg(case when ${trials.correct} then 1.0 else 0.0 end)`,
      })
      .from(trials)
      .where(and(answered, isNotNull(trials.confidence)))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const [brierRow] = await db
      .select({
        n: sql<number>`count(*)::int`,
        meanBrier: sql<number>`avg(power(${trials.confidence} / 100.0 - case when ${trials.correct} then 1 else 0 end, 2))`,
      })
      .from(trials)
      .where(and(answered, isNotNull(trials.confidence)));
    calibrationN = brierRow?.n ?? 0;
    if (calibrationN > 0 && brierRow.meanBrier !== null) {
      calibrationScore = Math.round((1 - Number(brierRow.meanBrier)) * 100);
    }

    hours = await db
      .select({
        bucket: sql<string>`case
          when extract(hour from ${trials.guessedAt} at time zone 'UTC') between 5 and 11 then 'Morning'
          when extract(hour from ${trials.guessedAt} at time zone 'UTC') between 12 and 16 then 'Afternoon'
          when extract(hour from ${trials.guessedAt} at time zone 'UTC') between 17 and 21 then 'Evening'
          else 'Night'
        end`,
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)::int`,
        expected: sql<number>`sum(${chanceCase})`,
      })
      .from(trials)
      .where(answered)
      .groupBy(sql`1`);
  }

  const totalN = typeAggs.reduce((sum, t) => sum + t.n, 0);
  const totalHits = typeAggs.reduce((sum, t) => sum + t.hits, 0);
  const today = utcDateString();
  const hourOrder = ["Morning", "Afternoon", "Evening", "Night"];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Honest statistics
          </p>
          <h1 className="mt-1 text-xl font-semibold">Quick-fire results</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      {totalN === 0 && (
        <section className="rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm text-muted">
            No answered trials yet.{" "}
            <Link href="/drill" className="text-[var(--accent-phosphor)] underline">
              Run your first drill
            </Link>
            .
          </p>
        </section>
      )}

      {DRILL_TYPES.map((type) => {
        const agg = typeAggs.find((t) => t.drillType === type);
        if (!agg || agg.n === 0) return null;
        return (
          <DrillSection
            key={type}
            type={type}
            n={agg.n}
            hits={agg.hits}
            days={days.filter((d) => d.drillType === type)}
            today={today}
          />
        );
      })}

      <section className="rounded-2xl border border-card-border bg-card/80 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Calibration</h2>
          {calibrationScore !== null && (
            <span className="font-mono text-lg text-[var(--accent-phosphor)]">
              {calibrationScore}/100
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          Does your confidence match your accuracy? The one trainable skill here. (Self-reported
          confidence vs. actual hit rate; score is Brier-based.)
        </p>
        {calibrationN < 20 ? (
          <p className="mt-3 text-sm text-muted">
            Too early to tell. The void needs more data. ({calibrationN}/20 rated trials)
          </p>
        ) : (
          <div className="mt-4 flex h-32 items-end gap-2">
            {[0, 1, 2, 3, 4].map((b) => {
              const row = calibration.find((c) => c.bucket === b);
              const acc = row ? Number(row.accuracy) : null;
              return (
                <div key={b} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end rounded bg-white/5">
                    <div
                      className="w-full rounded bg-[var(--accent-phosphor)]"
                      style={{ height: `${acc === null ? 0 : Math.max(acc * 100, 3)}%` }}
                      title={row ? `${Math.round((acc ?? 0) * 100)}% accurate over ${row.n} trials` : "No data"}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-muted">
                    {b * 20}–{b * 20 + 20}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-card-border bg-card/80 p-6">
        <h2 className="text-base font-semibold">Time of day (UTC)</h2>
        <p className="mt-1 text-xs text-muted">Hits vs. what chance predicts for those trials.</p>
        <dl className="mt-3 space-y-2 text-sm">
          {hourOrder.map((bucket) => {
            const row = hours.find((h) => h.bucket === bucket);
            return (
              <div key={bucket} className="flex justify-between">
                <dt className="text-muted">{bucket}</dt>
                <dd className="font-mono">
                  {row
                    ? `${row.hits}/${row.n} hits · chance predicts ${Number(row.expected).toFixed(1)}`
                    : "—"}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="rounded-2xl border border-card-border bg-card/80 p-5">
        <p className="text-sm text-muted">
          🦉 Nox: “{lineForHitRate(totalHits, totalN, totalN > 0 ? weightedChance(typeAggs) : 0.25)}”
        </p>
      </section>
    </main>
  );
}

function weightedChance(aggs: TypeAgg[]): number {
  const total = aggs.reduce((sum, a) => sum + a.n, 0);
  if (total === 0) return 0.25;
  return (
    aggs.reduce((sum, a) => {
      const chance = a.drillType === "redblack" ? 0.5 : 0.25;
      return sum + chance * a.n;
    }, 0) / total
  );
}

function DrillSection({
  type,
  n,
  hits,
  days,
  today,
}: {
  type: DrillType;
  n: number;
  hits: number;
  days: DayRow[];
  today: string;
}) {
  const drill = DRILLS[type];
  const hitRate = hits / n;
  const ci = wilsonInterval(hits, n);
  const pValue = binomialTwoSidedP(hits, n, drill.chance);
  const series: { day: string; n: number; hits: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = previousUtcDate(today, i);
    const found = days.find((d) => d.day === day);
    series.push(found ?? { day, n: 0, hits: 0 });
  }

  return (
    <section className="rounded-2xl border border-card-border bg-card/80 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{drill.label}</h2>
        <span className="font-mono text-sm text-muted">{n} trials</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">
        {(hitRate * 100).toFixed(1)}%{" "}
        <span className="text-sm font-normal text-muted">
          hit rate · chance {(drill.chance * 100).toFixed(0)}%
        </span>
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">95% confidence interval (Wilson)</dt>
          <dd className="font-mono">
            {(ci.low * 100).toFixed(1)}% – {(ci.high * 100).toFixed(1)}%
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">
            Exact binomial test vs {(drill.chance * 100).toFixed(0)}%
          </dt>
          <dd className="font-mono">p = {pValue < 0.0001 ? "< 0.0001" : pValue.toFixed(4)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Verdict</dt>
          <dd className={n < MIN_TRIALS_FOR_VERDICT ? "text-muted" : ""}>
            {n < MIN_TRIALS_FOR_VERDICT
              ? `Too early to tell. The void needs more data. (${n}/${MIN_TRIALS_FOR_VERDICT})`
              : pValue < 0.05
                ? "Statistically distinguishable from chance"
                : "Consistent with chance"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex h-20 items-end gap-1.5">
        {series.map((d) => {
          const rate = d.n > 0 ? d.hits / d.n : 0;
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-14 w-full items-end rounded bg-white/5">
                <div
                  className={`w-full rounded ${d.n === 0 ? "bg-transparent" : "bg-[var(--accent-phosphor)]"}`}
                  style={{ height: `${Math.max(d.n === 0 ? 0 : 6, rate * 80)}%` }}
                  title={`${d.day}: ${d.hits}/${d.n}`}
                />
              </div>
              <span className="font-mono text-[9px] text-muted">{d.day.slice(8)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
