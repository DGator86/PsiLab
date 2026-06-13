"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LEVELS = [
  { id: "body-calm", label: "Level 1 · Body Calm" },
  { id: "expanded-awareness", label: "Level 2 · Expanded Awareness" },
  { id: "open-field", label: "Level 3 · Open Field" },
];
const DURATIONS = [5, 10, 20];
const SENSATIONS = [
  "warmth",
  "tingling",
  "heaviness",
  "floating",
  "imagery",
  "sounds",
  "drifting",
  "stillness",
];
const MOODS = ["calm", "restless", "neutral", "energized", "sleepy"];

type Phase = "setup" | "running" | "journal" | "done";
type Mode = "timer" | "breathwork";

const BREATH_PHASES = ["Inhale", "Hold", "Exhale", "Hold"] as const;
const BREATH_SECONDS = 4;

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
        active
          ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/15 text-[var(--accent-phosphor)]"
          : "border-card-border text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export default function FocusPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("timer");
  const [duration, setDuration] = useState(5);
  const [level, setLevel] = useState(LEVELS[0].id);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const startedAtRef = useRef<number>(0);

  const [sensations, setSensations] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ xpAwarded: number; mascotLine: string } | null>(null);

  useEffect(() => {
    if (phase !== "running") return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setPhase("journal");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  function start() {
    setSecondsLeft(duration * 60);
    startedAtRef.current = Date.now();
    setPhase("running");
  }

  function endEarly() {
    setPhase("journal");
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const elapsedMin = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
    try {
      const res = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration: Math.min(duration, elapsedMin),
          level: mode === "breathwork" ? "breathwork" : level,
          journal: { sensations, mood, notes },
        }),
      });
      if (!res.ok) throw new Error(`Failed to save session (${res.status})`);
      const data = await res.json();
      setResult({ xpAwarded: data.xpAwarded, mascotLine: data.mascotLine });
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Focus training
          </p>
          <h1 className="mt-1 text-xl font-semibold">Sit. Settle. Notice.</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {phase === "setup" && (
        <section className="space-y-5 rounded-2xl border border-card-border bg-card/80 p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Mode</p>
            <div className="mt-2 flex gap-2">
              <Chip label="Still timer" active={mode === "timer"} onClick={() => setMode("timer")} />
              <Chip label="Box breathing" active={mode === "breathwork"} onClick={() => setMode("breathwork")} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Duration</p>
            <div className="mt-2 flex gap-2">
              {DURATIONS.map((d) => (
                <Chip key={d} label={`${d} min`} active={duration === d} onClick={() => setDuration(d)} />
              ))}
            </div>
          </div>
          {mode === "timer" && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Level</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <Chip key={l.id} label={l.label} active={level === l.id} onClick={() => setLevel(l.id)} />
                ))}
              </div>
            </div>
          )}
          {mode === "breathwork" && (
            <p className="text-sm text-muted">
              4-4-4-4 box breathing: inhale, hold, exhale, hold — four seconds each. The square
              breathes; you follow the square.
            </p>
          )}
          <button
            onClick={start}
            className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Begin
          </button>
        </section>
      )}

      {phase === "running" && mode === "timer" && (
        <section className="flex flex-col items-center gap-6 rounded-2xl border border-card-border bg-card/80 p-10">
          <p className="font-mono text-6xl tabular-nums">{mm}:{ss}</p>
          <p className="text-sm text-muted">{LEVELS.find((l) => l.id === level)?.label}</p>
          <button onClick={endEarly} className="text-xs text-muted underline hover:text-foreground">
            End session early
          </button>
        </section>
      )}

      {phase === "running" && mode === "breathwork" && (() => {
        const elapsed = duration * 60 - secondsLeft;
        const phaseIdx = Math.floor(elapsed / BREATH_SECONDS) % 4;
        const inPhase = elapsed % BREATH_SECONDS;
        const breathLabel = BREATH_PHASES[phaseIdx];
        // Scale: grows during inhale, big during hold, shrinks during exhale, small during hold.
        const t = (inPhase + 1) / BREATH_SECONDS;
        const scale =
          phaseIdx === 0 ? 0.55 + 0.45 * t : phaseIdx === 1 ? 1 : phaseIdx === 2 ? 1 - 0.45 * t : 0.55;
        return (
          <section className="flex flex-col items-center gap-6 rounded-2xl border border-card-border bg-card/80 p-10">
            <div className="flex h-48 w-48 items-center justify-center">
              <div
                className="flex h-40 w-40 items-center justify-center rounded-2xl border-2 border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/10 transition-transform duration-1000 ease-in-out"
                style={{ transform: `scale(${scale})` }}
              >
                <span className="text-sm font-semibold text-[var(--accent-phosphor)]">{breathLabel}</span>
              </div>
            </div>
            <p className="font-mono text-3xl tabular-nums">{mm}:{ss}</p>
            <button onClick={endEarly} className="text-xs text-muted underline hover:text-foreground">
              End session early
            </button>
          </section>
        );
      })()}

      {phase === "journal" && (
        <section className="space-y-5 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm text-muted">Session complete. What did you notice?</p>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Sensations</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SENSATIONS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  active={sensations.includes(s)}
                  onClick={() =>
                    setSensations((cur) =>
                      cur.includes(s) ? cur.filter((v) => v !== s) : [...cur, s],
                    )
                  }
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Mood</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <Chip key={m} label={m} active={mood === m} onClick={() => setMood(mood === m ? null : m)} />
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="focus-notes" className="text-xs uppercase tracking-wide text-muted">
              Notes
            </label>
            <textarea
              id="focus-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-2 w-full rounded-xl border border-card-border bg-black/20 p-3 text-sm outline-none focus:border-[var(--accent-phosphor)]"
            />
          </div>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            Save session
          </button>
        </section>
      )}

      {phase === "done" && result && (
        <section className="rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-lg font-semibold text-[var(--accent-phosphor)]">
            +{result.xpAwarded} XP
          </p>
          <p className="mt-3 rounded-xl border border-card-border bg-black/20 p-3 text-sm text-muted">
            🦉 Nox: “{result.mascotLine}”
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/"
              className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Back home
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
