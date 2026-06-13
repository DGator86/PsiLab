import Link from "next/link";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  achievements,
  arvPredictions,
  fieldLogs,
  focusSessions,
  pkSessions,
  rvSessions,
  trials,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { countGuessedToday, utcDayStart } from "@/lib/daily";
import { DAILY_GOAL, LEVELS, utcDateString } from "@/lib/drill";
import { MASCOTS, isMascotId, lineForHitRate } from "@/lib/mascot";
import { ACHIEVEMENT_DEFS } from "@/lib/awards";
import MascotPicker from "@/components/MascotPicker";
import StatePrompt from "@/components/StatePrompt";

export const dynamic = "force-dynamic";

type Practice = {
  href: string;
  title: string;
  desc: string;
  done: boolean;
  status: string;
};

type Unit = {
  name: string;
  blurb: string;
  unlockAt: number;
  practices: Practice[];
};

export default async function Home() {
  const user = await getCurrentUser();

  let dailyProgress = 0;
  let n = 0;
  let hits = 0;
  let chanceWeighted = 0.25;
  let rvDone = false;
  let ganzfeldDone = false;
  let drawingDone = false;
  let focusDone = false;
  let arvDone = false;
  let pkToday = 0;
  let skywatchToday = 0;
  let earned: { key: string }[] = [];

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
    const dayStart = utcDayStart();

    const sessions = await db
      .select({ mode: rvSessions.mode })
      .from(rvSessions)
      .where(and(eq(rvSessions.userId, user.id), eq(rvSessions.sessionDate, today)));
    rvDone = sessions.some((s) => s.mode === "rv");
    ganzfeldDone = sessions.some((s) => s.mode === "ganzfeld");
    drawingDone = sessions.some((s) => s.mode === "drawing");

    const [focusRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, user.id), gte(focusSessions.createdAt, dayStart)));
    focusDone = (focusRow?.count ?? 0) > 0;

    const arv = await db.query.arvPredictions.findFirst({
      where: and(eq(arvPredictions.userId, user.id), eq(arvPredictions.createdDate, today)),
    });
    arvDone = !!arv?.choice;

    const [pkRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pkSessions)
      .where(and(eq(pkSessions.userId, user.id), gte(pkSessions.createdAt, dayStart)));
    pkToday = pkRow?.count ?? 0;

    const [swRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fieldLogs)
      .where(and(eq(fieldLogs.userId, user.id), gte(fieldLogs.datetime, dayStart)));
    skywatchToday = swRow?.count ?? 0;

    earned = await db
      .select({ key: achievements.key })
      .from(achievements)
      .where(eq(achievements.userId, user.id));
  }

  const xp = user?.xp ?? 0;
  const level = user?.level ?? "Novice";
  const nextLevel = LEVELS.find((l) => l.minXp > xp);
  const sessionDone = dailyProgress >= DAILY_GOAL;
  const mascot = user && isMascotId(user.mascot) ? MASCOTS[user.mascot] : MASCOTS.nox;
  const questDone = sessionDone && rvDone && focusDone;

  const units: Unit[] = [
    {
      name: "Perception",
      blurb: "Forced-choice intuition. Where everyone starts.",
      unlockAt: 0,
      practices: [
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
      ],
    },
    {
      name: "Reception",
      blurb: "Stargate protocols: structured viewing, blind judging.",
      unlockAt: 20,
      practices: [
        {
          href: "/rv",
          title: "Remote viewing",
          desc: "CRV stages, sketch, 1-of-4 blind lineup.",
          done: rvDone,
          status: rvDone ? "done today" : "coordinate waiting",
        },
        {
          href: "/ganzfeld",
          title: "Ganzfeld",
          desc: "Red field, white noise, then the lineup.",
          done: ganzfeldDone,
          status: ganzfeldDone ? "done today" : "headphones ready?",
        },
      ],
    },
    {
      name: "Projection",
      blurb: "Drawing duplication and tomorrow's coin flip.",
      unlockAt: 60,
      practices: [
        {
          href: "/drawing",
          title: "Drawing duplication",
          desc: "Sketch the sealed line drawing. SRI classic.",
          done: drawingDone,
          status: drawingDone ? "done today" : "pencil at the ready",
        },
        {
          href: "/arv",
          title: "ARV · Precognition",
          desc: "Predict a sealed coin flip a day early.",
          done: arvDone,
          status: arvDone ? "locked in" : "the future awaits",
        },
      ],
    },
    {
      name: "Influence",
      blurb: "PEAR-style mind-over-RNG. Bring intentions.",
      unlockAt: 120,
      practices: [
        {
          href: "/pk",
          title: "PK · RNG influence",
          desc: "4,000 crypto bits vs your intention.",
          done: pkToday > 0,
          status: pkToday > 0 ? `${pkToday} run${pkToday > 1 ? "s" : ""} today` : "the bits are waiting",
        },
      ],
    },
    {
      name: "Field Work",
      blurb: "CE5-adjacent sky watching, mundane checklist first.",
      unlockAt: 200,
      practices: [
        {
          href: "/skywatch",
          title: "Sky watch log",
          desc: "Debunk first, wonder second. No lasers.",
          done: skywatchToday > 0,
          status: skywatchToday > 0 ? "logged today" : "clear skies?",
        },
      ],
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-card-border bg-card/70 p-6 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">PsiLab</p>
            <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Third Eye</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
              We don&apos;t ask you to believe. We help you test.
            </p>
          </div>
          <MascotPicker current={user?.mascot ?? "nox"} plan={user?.plan ?? "free"} />
        </div>
      </header>

      <StatePrompt />

      <section className="rounded-2xl border border-card-border bg-card/80 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Daily quest</h2>
          <span className="font-mono text-sm text-muted">
            {Math.min(dailyProgress, DAILY_GOAL)}/{DAILY_GOAL} trials
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-[var(--accent-phosphor)]"
            style={{ width: `${Math.min(100, (dailyProgress / DAILY_GOAL) * 100)}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Drill goal {sessionDone ? "✓" : "·"} remote viewing {rvDone ? "✓" : "·"} focus session{" "}
          {focusDone ? "✓" : "·"}
          {questDone
            ? " — full sweep, bonus XP awarded."
            : " — complete all three for the daily combo bonus."}
        </p>
      </section>

      {units.map((unit) => {
        const locked = n < unit.unlockAt;
        return (
          <section key={unit.name} className="rounded-2xl border border-card-border bg-card/80 p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">
                {unit.name}
                {locked && <span className="ml-2 text-xs font-normal text-muted">🔒 suggested unlock at {unit.unlockAt} trials</span>}
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted">{unit.blurb}</span>
            </div>
            <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${locked ? "opacity-60" : ""}`}>
              {unit.practices.map((p) => (
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
        );
      })}

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
            </Link>{" "}
            ·{" "}
            <Link href="/observatory" className="underline">
              observatory
            </Link>
          </p>
        </article>
      </section>

      {earned.length > 0 && (
        <section className="rounded-2xl border border-card-border bg-card/80 p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Achievements</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {earned.map(({ key }) => {
              const def = ACHIEVEMENT_DEFS[key];
              if (!def) return null;
              return (
                <span
                  key={key}
                  title={def.description}
                  className="rounded-full border border-card-border bg-black/20 px-3 py-1 text-xs"
                >
                  {def.emoji} {def.name}
                </span>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-card-border bg-card/80 p-5">
        <p className="text-sm text-muted">
          {mascot.emoji} {mascot.name} the {mascot.type}: “
          {lineForHitRate(hits, n, chanceWeighted, user && isMascotId(user.mascot) ? user.mascot : "nox")}”
        </p>
      </section>
    </main>
  );
}
