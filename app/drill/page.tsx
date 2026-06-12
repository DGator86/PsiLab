"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Trial = {
  trialId: string;
  choices: string[];
  commitHash: string;
  dailyProgress: number;
  dailyGoal: number;
};

type GuessResult = {
  correct: boolean;
  answer: string;
  commitSalt: string;
  commitHash: string;
  mascotLine: string;
  xpAwarded: number;
  totalXp: number;
  level: string;
  dailyProgress: number;
  dailyGoal: number;
  sessionCompleted: boolean;
  streak: { count: number; freezeAvailable: boolean; freezeUsed: boolean };
};

const SYMBOL_GLYPHS: Record<string, React.ReactNode> = {
  circle: (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
      <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
      <path d="M24 8v32M8 24h32" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  ),
  waves: (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
      <path
        d="M8 16c4-6 8-6 12 0s8 6 12 0 8-6 8 0M8 26c4-6 8-6 12 0s8 6 12 0 8-6 8 0M8 36c4-6 8-6 12 0s8 6 12 0 8-6 8 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
      <path
        d="M24 6l5.2 11.6L42 19l-9.5 8.6L35 40l-11-6.6L13 40l2.5-12.4L6 19l12.8-1.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function DrillPage() {
  const [trial, setTrial] = useState<Trial | null>(null);
  const [result, setResult] = useState<GuessResult | null>(null);
  const [confidence, setConfidence] = useState(50);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const presentedAtRef = useRef<number>(0);

  const loadTrial = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setVerified(null);
    try {
      const res = await fetch("/api/trials", { method: "POST" });
      if (!res.ok) throw new Error(`Failed to start trial (${res.status})`);
      const data: Trial = await res.json();
      setTrial(data);
      presentedAtRef.current = performance.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrial();
  }, [loadTrial]);

  async function submitGuess(guess: string) {
    if (!trial || submitting || result) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trials/${trial.trialId}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guess,
          confidence,
          latencyMs: Math.round(performance.now() - presentedAtRef.current),
        }),
      });
      if (!res.ok) throw new Error(`Failed to submit guess (${res.status})`);
      const data: GuessResult = await res.json();
      setResult(data);
      const recomputed = await sha256Hex(`${data.answer}:${data.commitSalt}`);
      setVerified(recomputed === trial.commitHash && data.commitHash === trial.commitHash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const progress = result?.dailyProgress ?? trial?.dailyProgress ?? 0;
  const goal = result?.dailyGoal ?? trial?.dailyGoal ?? 10;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Card drill · chance 25%
          </p>
          <h1 className="mt-1 text-xl font-semibold">Which symbol is it?</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      <div className="rounded-2xl border border-card-border bg-card/70 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Today&apos;s session</span>
          <span className="font-mono">
            {Math.min(progress, goal)}/{goal}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-[var(--accent-phosphor)] transition-all"
            style={{ width: `${Math.min(100, (progress / goal) * 100)}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {error}{" "}
          <button className="underline" onClick={() => void loadTrial()}>
            Retry
          </button>
        </div>
      )}

      {!result && (
        <section className="rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm text-muted">
            The answer is already committed server-side. Hash:{" "}
            <span className="font-mono text-xs break-all">
              {trial ? trial.commitHash.slice(0, 16) + "…" : "…"}
            </span>
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(trial?.choices ?? ["circle", "cross", "waves", "star"]).map((symbol) => (
              <button
                key={symbol}
                disabled={loading || submitting || !trial}
                onClick={() => void submitGuess(symbol)}
                className="group flex flex-col items-center gap-2 rounded-xl border border-card-border bg-black/20 p-4 text-foreground transition hover:border-[var(--accent-phosphor)] hover:text-[var(--accent-phosphor)] disabled:opacity-40"
              >
                {SYMBOL_GLYPHS[symbol]}
                <span className="text-xs capitalize text-muted group-hover:text-[var(--accent-phosphor)]">
                  {symbol}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <label htmlFor="confidence" className="flex justify-between text-sm text-muted">
              <span>Confidence</span>
              <span className="font-mono">{confidence}%</span>
            </label>
            <input
              id="confidence"
              type="range"
              min={0}
              max={100}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--accent-phosphor)]"
            />
          </div>
        </section>
      )}

      {result && (
        <section className="rounded-2xl border border-card-border bg-card/80 p-6">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-xl border ${
                result.correct
                  ? "border-[var(--accent-phosphor)] text-[var(--accent-phosphor)]"
                  : "border-card-border text-muted"
              }`}
            >
              {SYMBOL_GLYPHS[result.answer]}
            </div>
            <div>
              <p className="text-lg font-semibold">
                {result.correct ? "Hit" : "Miss"} · it was {result.answer}
              </p>
              <p className="text-sm text-muted">
                +{result.xpAwarded} XP · {result.level}
              </p>
            </div>
          </div>

          <p className="mt-4 rounded-xl border border-card-border bg-black/20 p-3 text-sm text-muted">
            🦉 Nox: “{result.mascotLine}”
          </p>

          <p className="mt-3 font-mono text-xs text-muted">
            {verified === null
              ? "Verifying commitment…"
              : verified
                ? "✓ Commitment verified: the answer was locked before your guess."
                : "✗ Commitment mismatch — this should never happen."}
          </p>

          {result.sessionCompleted && (
            <div className="mt-4 rounded-xl border border-[var(--accent-phosphor)] bg-black/20 p-4">
              <p className="text-sm font-semibold text-[var(--accent-phosphor)]">
                Daily session complete · streak {result.streak.count}
                {result.streak.freezeUsed ? " (freeze used)" : ""}
              </p>
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => void loadTrial()}
              className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Next trial
            </button>
            <Link
              href="/stats"
              className="rounded-xl border border-card-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
            >
              View stats
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
