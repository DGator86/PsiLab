import Link from "next/link";
import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { arvPredictions, pkSessions, rvSessions, trials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { utcDayStart } from "@/lib/daily";
import { DRILLS, DRILL_TYPES, previousUtcDate, utcDateString, type DrillType } from "@/lib/drill";
import { isMascotId, lineForHitRate } from "@/lib/mascot";
import { binomialTwoSidedP, binomialZ, wilsonInterval } from "@/lib/stats";
import PreregPanel from "./PreregPanel";

export const dynamic = "force-dynamic";

const MIN_TRIALS_FOR_VERDICT = 100;

type TypeAgg = { drillType: string; n: number; hits: number };
type DayRow = { drillType: string; day: string; n: number; hits: number };
type CalibrationBucket = { bucket: number; n: number; accuracy: number };
type HourRow = { bucket: string; n: number; hits: number; expected: number };
type SplitRow = { n: number; hits: number; expected: number };
type JudgeAgg = { mode: string; n: number; hits: number };
type PkAgg = { intention: string; sessions: number; meanZ: number };

const chanceCase = sql<number>`case ${trials.drillType} when 'redblack' then 0.5 else 0.25 end`;

export default async function StatsPage() {
  const user = await getCurrentUser();

  let typeAggs: TypeAgg[] = [];
  let days: DayRow[] = [];
  let calibration: CalibrationBucket[] = [];
  let calibrationScore: number | null = null;
  let calibrationN = 0;
  let hours: HourRow[] = [];
  let judgeAggs: JudgeAgg[] = [];
  let arvAgg: { n: number; hits: number } = { n: 0, hits: 0 };
  let pkAggs: PkAgg[] = [];
  let postFocus: SplitRow = { n: 0, hits: 0, expected: 0 };
  let noFocus: SplitRow = { n: 0, hits: 0, expected: 0 };
  let kpQuiet: SplitRow = { n: 0, hits: 0, expected: 0 };
  let kpActive: SplitRow = { n: 0, hits: 0, expected: 0 };
  let meditatedSplit: SplitRow = { n: 0, hits: 0, expected: 0 };
  let unmeditatedSplit: SplitRow = { n: 0, hits: 0, expected: 0 };
  let halves: { half: string; n: number; hits: number; expected: number }[] = [];
  let selfScores: { overall: string; n: number }[] = [];

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

    // Blind judging stats per modality (forced choice, 25%).
    judgeAggs = await db
      .select({
        mode: rvSessions.mode,
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when ${rvSessions.judgeCorrect} then 1 else 0 end), 0)::int`,
      })
      .from(rvSessions)
      .where(and(eq(rvSessions.userId, user.id), isNotNull(rvSessions.judgedAt)))
      .groupBy(rvSessions.mode);

    const [arvRow] = await db
      .select({
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when ${arvPredictions.correct} then 1 else 0 end), 0)::int`,
      })
      .from(arvPredictions)
      .where(
        and(
          eq(arvPredictions.userId, user.id),
          isNotNull(arvPredictions.revealedAt),
          isNotNull(arvPredictions.correct),
        ),
      );
    arvAgg = { n: Number(arvRow?.n ?? 0), hits: Number(arvRow?.hits ?? 0) };

    pkAggs = await db
      .select({
        intention: pkSessions.intention,
        sessions: sql<number>`count(*)::int`,
        meanZ: sql<number>`avg(${pkSessions.zScore})`,
      })
      .from(pkSessions)
      .where(eq(pkSessions.userId, user.id))
      .groupBy(pkSessions.intention);

    // Correlations: post-focus window, geomagnetic activity, state tags.
    const splitSelect = {
      n: sql<number>`count(*)::int`,
      hits: sql<number>`coalesce(sum(case when ${trials.correct} then 1 else 0 end), 0)::int`,
      expected: sql<number>`coalesce(sum(${chanceCase}), 0)`,
    };
    const focusExists = sql`exists (
      select 1 from focus_sessions f
      where f.user_id = ${user.id}
        and ${trials.guessedAt} >= f.created_at
        and ${trials.guessedAt} <= f.created_at + interval '30 minutes'
    )`;
    [postFocus] = await db.select(splitSelect).from(trials).where(and(answered, focusExists));
    [noFocus] = await db
      .select(splitSelect)
      .from(trials)
      .where(and(answered, sql`not ${focusExists}`));

    [kpQuiet] = await db
      .select(splitSelect)
      .from(trials)
      .where(and(answered, isNotNull(trials.kp), lt(trials.kp, 3)));
    [kpActive] = await db
      .select(splitSelect)
      .from(trials)
      .where(and(answered, isNotNull(trials.kp), gte(trials.kp, 3)));

    const meditatedExists = sql`exists (
      select 1 from daily_states s
      where s.user_id = ${user.id}
        and s.date = (${trials.guessedAt} at time zone 'UTC')::date
        and s.meditated
    )`;
    [meditatedSplit] = await db
      .select(splitSelect)
      .from(trials)
      .where(and(answered, meditatedExists));
    [unmeditatedSplit] = await db
      .select(splitSelect)
      .from(trials)
      .where(and(answered, sql`not ${meditatedExists}`));

    // Decline effect: first half vs second half of your trial history.
    halves = await db
      .select({
        half: sql<string>`case when rn <= total / 2 then 'first' else 'second' end`,
        n: sql<number>`count(*)::int`,
        hits: sql<number>`coalesce(sum(case when correct then 1 else 0 end), 0)::int`,
        expected: sql<number>`coalesce(sum(case drill_type when 'redblack' then 0.5 else 0.25 end), 0)`,
      })
      .from(
        sql`(
          select correct, drill_type,
                 row_number() over (order by guessed_at) as rn,
                 count(*) over () as total
          from trials
          where user_id = ${user.id} and guessed_at is not null
        ) ranked`,
      )
      .groupBy(sql`1`);

    selfScores = await db
      .select({
        overall: sql<string>`${rvSessions.selfScoreJson} ->> 'overall'`,
        n: sql<number>`count(*)::int`,
      })
      .from(rvSessions)
      .where(and(eq(rvSessions.userId, user.id), isNotNull(rvSessions.selfScoreJson)))
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

      <section className="rounded-2xl border border-card-border bg-card/80 p-6">
        <h2 className="text-base font-semibold">Protocol meta-analysis</h2>
        <p className="mt-1 text-xs text-muted">
          Every forced-choice protocol, one table, honest baselines. Effect = your hit rate minus
          chance.
        </p>
        <div className="mt-3 space-y-2">
          {[
            { label: "Symbols (1-of-4)", n: typeAggs.find((t) => t.drillType === "zener4")?.n ?? 0, hits: typeAggs.find((t) => t.drillType === "zener4")?.hits ?? 0, chance: 0.25 },
            { label: "Red / Black", n: typeAggs.find((t) => t.drillType === "redblack")?.n ?? 0, hits: typeAggs.find((t) => t.drillType === "redblack")?.hits ?? 0, chance: 0.5 },
            { label: "RV blind judging", n: judgeAggs.find((j) => j.mode === "rv")?.n ?? 0, hits: judgeAggs.find((j) => j.mode === "rv")?.hits ?? 0, chance: 0.25 },
            { label: "Ganzfeld judging", n: judgeAggs.find((j) => j.mode === "ganzfeld")?.n ?? 0, hits: judgeAggs.find((j) => j.mode === "ganzfeld")?.hits ?? 0, chance: 0.25 },
            { label: "Drawing judging", n: judgeAggs.find((j) => j.mode === "drawing")?.n ?? 0, hits: judgeAggs.find((j) => j.mode === "drawing")?.hits ?? 0, chance: 0.25 },
            { label: "ARV predictions", n: arvAgg.n, hits: arvAgg.hits, chance: 0.5 },
          ].map((row) => (
            <ProtocolRow key={row.label} {...row} />
          ))}
        </div>
        {halves.length === 2 && (
          <div className="mt-4 rounded-xl border border-card-border bg-black/20 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted">Decline effect check</p>
            {(["first", "second"] as const).map((h) => {
              const row = halves.find((x) => x.half === h);
              if (!row || row.n === 0) return null;
              return (
                <p key={h} className="mt-1 font-mono text-xs text-muted">
                  {h === "first" ? "First half" : "Second half"}: {row.hits}/{row.n} (
                  {((row.hits / row.n) * 100).toFixed(1)}%) · chance predicts{" "}
                  {Number(row.expected).toFixed(1)}
                </p>
              );
            })}
            <p className="mt-2 text-xs text-muted">
              Classic psi studies famously decline over time. Now you can watch yours do it live.
            </p>
          </div>
        )}
      </section>

      {pkAggs.length > 0 && (
        <section className="rounded-2xl border border-card-border bg-card/80 p-6">
          <h2 className="text-base font-semibold">PK · RNG influence</h2>
          <p className="mt-1 text-xs text-muted">
            Mean z-score per intention. Control runs are your baseline — if high, low, and control
            all hover near 0, the RNG remains stubbornly an RNG.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            {(["high", "low", "control"] as const).map((i) => {
              const row = pkAggs.find((p) => p.intention === i);
              return (
                <div key={i} className="flex justify-between">
                  <dt className="capitalize text-muted">{i === "high" ? "More 1s" : i === "low" ? "More 0s" : "Control"}</dt>
                  <dd className="font-mono">
                    {row ? `${row.sessions} sessions · mean z = ${Number(row.meanZ).toFixed(2)}` : "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      <section className="rounded-2xl border border-card-border bg-card/80 p-6">
        <h2 className="text-base font-semibold">Correlations</h2>
        <p className="mt-1 text-xs text-muted">
          Exploratory splits, not conclusions. Small samples lie enthusiastically.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <SplitLine label="Within 30 min of a focus session" row={postFocus} />
          <SplitLine label="No recent focus session" row={noFocus} />
          <SplitLine label="Quiet geomagnetic field (Kp < 3)" row={kpQuiet} />
          <SplitLine label="Active geomagnetic field (Kp ≥ 3)" row={kpActive} />
          <SplitLine label="Days you tagged as meditated" row={meditatedSplit} />
          <SplitLine label="Days without the meditated tag" row={unmeditatedSplit} />
        </dl>
      </section>

      <PreregPanel />

      <section className="rounded-2xl border border-dashed border-card-border bg-card/40 p-6">
        <h2 className="text-base font-semibold">Self-scored (subjective)</h2>
        <p className="mt-1 text-xs text-muted">
          Your own RV rubric verdicts. Kept in a separate pen from the blind stats above, because
          self-scoring is vibes with extra steps. Charming, but vibes.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          {(["hit", "partial", "miss"] as const).map((v) => {
            const row = selfScores.find((s) => s.overall === v);
            return (
              <div key={v} className="flex justify-between">
                <dt className="capitalize text-muted">{v}</dt>
                <dd className="font-mono">{row ? `${row.n} sessions` : "—"}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="rounded-2xl border border-card-border bg-card/80 p-5">
        <p className="text-sm text-muted">
          🦉 “
          {lineForHitRate(
            totalHits,
            totalN,
            totalN > 0 ? weightedChance(typeAggs) : 0.25,
            user && isMascotId(user.mascot) ? user.mascot : "nox",
          )}
          ”
        </p>
      </section>

      <p className="text-center text-xs text-muted">
        <Link href="/observatory" className="hover:text-foreground">
          Compare with the global observatory →
        </Link>
      </p>
    </main>
  );
}

function ProtocolRow({
  label,
  n,
  hits,
  chance,
}: {
  label: string;
  n: number;
  hits: number;
  chance: number;
}) {
  if (n === 0) {
    return (
      <div className="flex items-baseline justify-between rounded-xl border border-card-border bg-black/20 px-3 py-2 text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-xs text-muted">no data · chance {(chance * 100).toFixed(0)}%</span>
      </div>
    );
  }
  const rate = hits / n;
  const ci = wilsonInterval(hits, n);
  const z = binomialZ(hits, n, chance);
  return (
    <div className="rounded-xl border border-card-border bg-black/20 px-3 py-2 text-sm">
      <div className="flex items-baseline justify-between">
        <span>{label}</span>
        <span className="font-mono">
          {(rate * 100).toFixed(1)}% <span className="text-xs text-muted">vs {(chance * 100).toFixed(0)}%</span>
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted">
        {hits}/{n} · effect {((rate - chance) * 100).toFixed(1)} pts · 95% CI {(ci.low * 100).toFixed(0)}–
        {(ci.high * 100).toFixed(0)}% · z = {z.toFixed(2)}
      </p>
    </div>
  );
}

function SplitLine({ label, row }: { label: string; row: { n: number; hits: number; expected: number } }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-nowrap font-mono text-xs">
        {row.n > 0
          ? `${row.hits}/${row.n} · chance ${Number(row.expected).toFixed(1)}`
          : "—"}
      </dd>
    </div>
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
