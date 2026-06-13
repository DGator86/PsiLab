"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import JudgeLineup, { type LineupItem } from "@/components/JudgeLineup";
import TargetImage from "@/components/TargetImage";

const DURATIONS = [5, 10, 15] as const;

const GESTALTS = ["land", "water", "structure", "people", "vegetation", "sky", "machine", "animal"] as const;
const COLORS = ["red", "orange", "yellow", "green", "blue", "white", "black", "brown", "grey"] as const;

type TodayState = {
  state: "pending" | "judging" | "judged" | "scored";
  code: string;
  lineup?: LineupItem[];
  judgeCorrect?: boolean | null;
  target?: { id: string; imageUrl: string } | null;
};

type Phase = "setup" | "immersion" | "impressions";

export default function GanzfeldPage() {
  const [today, setToday] = useState<TodayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [duration, setDuration] = useState<number>(5);
  const [remaining, setRemaining] = useState(0);

  const [gestalts, setGestalts] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [judgeResult, setJudgeResult] = useState<{ xpAwarded: number; mascotLine: string } | null>(null);

  const audioCtx = useRef<AudioContext | null>(null);
  const noiseNode = useRef<AudioBufferSourceNode | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/rv/today?mode=ganzfeld")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then(setToday)
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"));
    return () => stopImmersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNoise() {
    const ctx = new AudioContext();
    // 2 seconds of generated white noise, looped. License-free by construction.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.18;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    source.connect(gain).connect(ctx.destination);
    source.start();
    audioCtx.current = ctx;
    noiseNode.current = source;
  }

  function stopImmersion() {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    try {
      noiseNode.current?.stop();
      void audioCtx.current?.close();
    } catch {
      // already stopped
    }
    noiseNode.current = null;
    audioCtx.current = null;
  }

  function begin() {
    startNoise();
    setRemaining(duration * 60);
    setPhase("immersion");
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          stopImmersion();
          setPhase("impressions");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function endEarly() {
    stopImmersion();
    setPhase("impressions");
  }

  const toggle = (list: string[], set: (v: string[]) => void) => (value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  async function submitImpressions() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rv/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ganzfeld",
          impressions: { gestalts, colors, notes },
          confidence: null,
        }),
      });
      if (!res.ok) throw new Error(`Failed to submit (${res.status})`);
      const data = await res.json();
      setToday((prev) => (prev ? { ...prev, state: "judging", lineup: data.lineup } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function judge(pickId: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rv/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ganzfeld", pickId }),
      });
      if (!res.ok) throw new Error(`Failed to judge (${res.status})`);
      const data = await res.json();
      setJudgeResult({ xpAwarded: data.xpAwarded, mascotLine: data.mascotLine });
      setToday((prev) =>
        prev ? { ...prev, state: "scored", judgeCorrect: data.judgeCorrect, target: data.target } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "immersion") {
    const mm = Math.floor(remaining / 60);
    const ss = String(remaining % 60).padStart(2, "0");
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-8"
        style={{ background: "radial-gradient(circle at 50% 40%, #7a1212 0%, #3f0808 70%, #2a0505 100%)" }}
      >
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-red-200/70">Ganzfeld field active</p>
        <p className="font-mono text-6xl font-semibold text-red-100/90">
          {mm}:{ss}
        </p>
        <p className="max-w-xs text-center text-sm text-red-200/60">
          Eyes soft. Let the red field and the noise take the foreground. Speak or hold whatever
          arrives — you&apos;ll log it after.
        </p>
        <button
          onClick={endEarly}
          className="rounded-xl border border-red-300/30 px-4 py-2 text-sm text-red-200/80 transition hover:bg-red-300/10"
        >
          End immersion early
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Ganzfeld · coordinate
          </p>
          <h1 className="mt-1 font-mono text-xl font-semibold">{today?.code ?? "…"}</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>
      )}

      {!today && !error && (
        <div className="h-64 animate-pulse rounded-2xl border border-card-border bg-card/50" />
      )}

      {today?.state === "pending" && phase === "setup" && (
        <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm text-muted">
            The classic: uniform red field, generated white noise, mild sensory deprivation. A
            target is already sealed for this coordinate. Immerse, collect impressions, then face
            the 4-candidate lineup. Headphones recommended; lying down optional but traditional.
          </p>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Immersion length</p>
            <div className="mt-2 flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  aria-pressed={duration === d}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    duration === d
                      ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/15 text-[var(--accent-phosphor)]"
                      : "border-card-border text-muted hover:text-foreground"
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={begin}
            className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Begin immersion
          </button>
        </section>
      )}

      {today?.state === "pending" && phase === "impressions" && (
        <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Free response</p>
          <p className="text-sm text-muted">Whatever surfaced during the immersion. Lock it before the lineup.</p>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Gestalts</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {GESTALTS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggle(gestalts, setGestalts)(g)}
                  aria-pressed={gestalts.includes(g)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                    gestalts.includes(g)
                      ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/15 text-[var(--accent-phosphor)]"
                      : "border-card-border text-muted hover:text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Colors</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(colors, setColors)(c)}
                  aria-pressed={colors.includes(c)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                    colors.includes(c)
                      ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/15 text-[var(--accent-phosphor)]"
                      : "border-card-border text-muted hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Imagery, fragments, narratives — raw and unedited."
            className="w-full rounded-xl border border-card-border bg-black/20 p-3 text-sm outline-none focus:border-[var(--accent-phosphor)]"
          />
          <button
            onClick={() => void submitImpressions()}
            disabled={submitting}
            className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            Lock impressions
          </button>
        </section>
      )}

      {today?.state === "judging" && today.lineup && (
        <section className="rounded-2xl border border-card-border bg-card/80 p-6">
          <JudgeLineup lineup={today.lineup} onJudge={(id) => void judge(id)} submitting={submitting} />
        </section>
      )}

      {(today?.state === "judged" || today?.state === "scored") && today.target && (
        <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
          <div
            className={`rounded-xl border p-3 text-sm ${
              today.judgeCorrect
                ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                : "border-card-border bg-black/20 text-muted"
            }`}
          >
            {today.judgeCorrect
              ? "Direct hit through the static. 25% chance — logged."
              : "Not the target. The noise keeps its secrets today."}
            {judgeResult && <span className="ml-2 text-[var(--accent-phosphor)]">+{judgeResult.xpAwarded} XP</span>}
          </div>
          {judgeResult && <p className="text-sm text-muted">🦉 “{judgeResult.mascotLine}”</p>}
          <div className="reveal-flip overflow-hidden rounded-xl border border-card-border">
            <TargetImage imageUrl={today.target.imageUrl} alt="Revealed ganzfeld target" />
          </div>
          <p className="text-xs text-muted">New session tomorrow.</p>
        </section>
      )}
    </main>
  );
}
