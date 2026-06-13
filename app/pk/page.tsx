"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type RunResult = {
  intention: "high" | "low" | "control";
  rounds: number[];
  bitsPerRound: number;
  bitsTotal: number;
  onesTotal: number;
  zScore: number;
  xpAwarded: number;
  mascotLine: string;
};

const PARLOR_STEPS = [
  "Hold an imaginary spoon. A real one also works, but we are not liable for cutlery.",
  "Feel its weight, temperature, the exact point where the neck meets the bowl.",
  "Picture warmth gathering at that point — soft metal, like taffy in the sun.",
  "Intend the bend. Don't force it. Geller never looked like he was trying.",
  "Hold the intention for ten slow breaths.",
  "Open your eyes. Inspect the spoon. Log what you felt — the spoon's opinion is its own.",
];

/**
 * Cumulative deviation chart: random walk of (ones - expected) per round with
 * ±1.96σ parabola envelopes. Pure SVG, animated by slicing the data.
 */
function DeviationChart({ rounds, bitsPerRound, visible }: { rounds: number[]; bitsPerRound: number; visible: number }) {
  const W = 560;
  const H = 220;
  const n = rounds.length;
  let cum = 0;
  const points = rounds.map((ones) => {
    cum += ones - bitsPerRound / 2;
    return cum;
  });
  // y-scale: cover the 2-sigma envelope at full length plus headroom.
  const maxSigma = 1.96 * Math.sqrt((n * bitsPerRound) / 4);
  const yMax = Math.max(maxSigma * 1.2, Math.max(...points.map(Math.abs), 1) * 1.2);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => H / 2 - (v / yMax) * (H / 2);

  const envelope = Array.from({ length: n + 1 }, (_, i) => 1.96 * Math.sqrt((i * bitsPerRound) / 4));
  const upperPath = envelope.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const lowerPath = envelope.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(-v)}`).join(" ");
  const walkPath = ["M0," + y(0), ...points.slice(0, visible).map((v, i) => `L${x(i + 1)},${y(v)}`)].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-card-border bg-black/30">
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#2a3650" strokeWidth={1} />
      <path d={upperPath} fill="none" stroke="#3a4a6b" strokeWidth={1} strokeDasharray="4 4" />
      <path d={lowerPath} fill="none" stroke="#3a4a6b" strokeWidth={1} strokeDasharray="4 4" />
      <text x={W - 6} y={y(envelope[n]) + 12} textAnchor="end" fontSize={10} fill="#5a6a8b">
        +1.96σ
      </text>
      <text x={W - 6} y={y(-envelope[n]) - 4} textAnchor="end" fontSize={10} fill="#5a6a8b">
        −1.96σ
      </text>
      {visible > 0 && <path d={walkPath} fill="none" stroke="var(--accent-phosphor, #7ef0a8)" strokeWidth={2} />}
    </svg>
  );
}

export default function PkPage() {
  const [intention, setIntention] = useState<"high" | "low" | "control">("high");
  const [result, setResult] = useState<RunResult | null>(null);
  const [visible, setVisible] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parlorStep, setParlorStep] = useState(-1);
  const [parlorNotes, setParlorNotes] = useState("");
  const [parlorLogged, setParlorLogged] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setVisible(0);
    try {
      const res = await fetch("/api/pk/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intention }),
      });
      if (!res.ok) throw new Error(`Failed to run (${res.status})`);
      const data: RunResult = await res.json();
      setResult(data);
      let i = 0;
      timer.current = setInterval(() => {
        i += 1;
        setVisible(i);
        if (i >= data.rounds.length) {
          if (timer.current) clearInterval(timer.current);
          setRunning(false);
        }
      }, 350);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setRunning(false);
    }
  }

  async function logParlor() {
    try {
      const res = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration: 5,
          level: "spoon-parlor",
          journal: { sensations: [], mood: null, notes: parlorNotes },
        }),
      });
      if (!res.ok) throw new Error(`Failed to log (${res.status})`);
      const data = await res.json();
      setParlorLogged(data.mascotLine ?? "Parlor session logged.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const done = result && visible >= result.rounds.length;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Psychokinesis · RNG influence
          </p>
          <h1 className="mt-1 text-xl font-semibold">Bend the bits</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>
      )}

      <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
        <p className="text-sm text-muted">
          PEAR-style protocol: 20 rounds × 200 crypto-random bits, generated server-side before
          the chart even starts moving. Declare an intention, then watch the cumulative deviation
          walk. Control runs are first-class data — run them often.
        </p>
        <div className="flex gap-2">
          {(["high", "low", "control"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setIntention(opt)}
              aria-pressed={intention === opt}
              className={`rounded-full border px-4 py-1.5 text-sm capitalize transition ${
                intention === opt
                  ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/15 text-[var(--accent-phosphor)]"
                  : "border-card-border text-muted hover:text-foreground"
              }`}
            >
              {opt === "high" ? "More 1s" : opt === "low" ? "More 0s" : "Control"}
            </button>
          ))}
        </div>
        <button
          onClick={() => void run()}
          disabled={running}
          className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
        >
          {running ? "Running…" : "Run 4,000 bits"}
        </button>

        {result && (
          <div className="space-y-3">
            <DeviationChart rounds={result.rounds} bitsPerRound={result.bitsPerRound} visible={visible} />
            {done && (
              <div className="rounded-xl border border-card-border bg-black/20 p-4 text-sm">
                <p>
                  <span className="font-mono">{result.onesTotal}</span> ones out of{" "}
                  <span className="font-mono">{result.bitsTotal}</span> bits · expected{" "}
                  <span className="font-mono">{result.bitsTotal / 2}</span> · z ={" "}
                  <span className="font-mono">{result.zScore.toFixed(2)}</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  |z| &gt; 1.96 happens to 1 in 20 runs by pure chance. Single sessions prove
                  nothing; the stats page tracks your lifetime mean.
                </p>
                <p className="mt-2 text-sm text-muted">
                  🦉 “{result.mascotLine}” <span className="text-[var(--accent-phosphor)]">+{result.xpAwarded} XP</span>
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
        <div>
          <p className="text-sm font-semibold">The spoon-bending parlor</p>
          <p className="mt-1 text-sm text-muted">
            A guided visualization, Geller-style. Journal tier only — no stats are harmed in the
            making of this exercise.
          </p>
        </div>
        {parlorStep === -1 && !parlorLogged && (
          <button
            onClick={() => setParlorStep(0)}
            className="rounded-xl border border-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-[var(--accent-phosphor)] transition hover:bg-[var(--accent-phosphor)]/10"
          >
            Enter the parlor
          </button>
        )}
        {parlorStep >= 0 && parlorStep < PARLOR_STEPS.length && (
          <div className="space-y-3">
            <p className="font-mono text-xs text-muted">
              Step {parlorStep + 1}/{PARLOR_STEPS.length}
            </p>
            <p className="text-sm">{PARLOR_STEPS[parlorStep]}</p>
            <button
              onClick={() => setParlorStep((s) => s + 1)}
              className="rounded-xl border border-card-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
            >
              {parlorStep === PARLOR_STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        )}
        {parlorStep >= PARLOR_STEPS.length && !parlorLogged && (
          <div className="space-y-3">
            <textarea
              value={parlorNotes}
              onChange={(e) => setParlorNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="What did you feel? What did the spoon feel?"
              className="w-full rounded-xl border border-card-border bg-black/20 p-3 text-sm outline-none focus:border-[var(--accent-phosphor)]"
            />
            <button
              onClick={() => void logParlor()}
              className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Log parlor session
            </button>
          </div>
        )}
        {parlorLogged && <p className="text-sm text-muted">🦉 “{parlorLogged}”</p>}
      </section>
    </main>
  );
}
