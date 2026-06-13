"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import JudgeLineup, { type LineupItem } from "@/components/JudgeLineup";
import SketchPad from "@/components/SketchPad";
import TargetImage from "@/components/TargetImage";

type TodayState = {
  state: "pending" | "judging" | "judged" | "scored";
  code: string;
  sketchUrl?: string | null;
  lineup?: LineupItem[];
  judgeCorrect?: boolean | null;
  target?: { id: string; imageUrl: string } | null;
};

export default function DrawingPage() {
  const [today, setToday] = useState<TodayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sketchUrl, setSketchUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [judgeResult, setJudgeResult] = useState<{ xpAwarded: number; mascotLine: string } | null>(null);

  useEffect(() => {
    fetch("/api/rv/today?mode=drawing")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then(setToday)
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"));
  }, []);

  async function lock() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rv/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "drawing", impressions: { notes }, confidence: null, sketchUrl }),
      });
      if (!res.ok) throw new Error(`Failed to submit (${res.status})`);
      const data = await res.json();
      setToday((prev) =>
        prev ? { ...prev, state: "judging", lineup: data.lineup, sketchUrl: data.sketchUrl } : prev,
      );
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
        body: JSON.stringify({ mode: "drawing", pickId }),
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Drawing duplication · coordinate
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

      {today?.state === "pending" && (
        <section className="space-y-5 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm text-muted">
            A simple line drawing has been sealed for this coordinate — the SRI classic. Sketch
            whatever shape arrives. Your drawing locks when you submit, then you face the lineup.
          </p>
          <SketchPad onChange={setSketchUrl} />
          <div>
            <label htmlFor="drawing-notes" className="text-xs uppercase tracking-wide text-muted">
              Optional notes
            </label>
            <input
              id="drawing-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
              placeholder="e.g. something round, pointing up"
              className="mt-2 w-full rounded-xl border border-card-border bg-black/20 p-3 text-sm outline-none focus:border-[var(--accent-phosphor)]"
            />
          </div>
          <button
            onClick={() => void lock()}
            disabled={submitting || !sketchUrl}
            className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            Lock my sketch
          </button>
        </section>
      )}

      {today?.state === "judging" && today.lineup && (
        <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
          {today.sketchUrl && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Your sketch</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={today.sketchUrl} alt="Your sketch" className="mt-2 h-40 rounded-lg border border-card-border" />
            </div>
          )}
          <JudgeLineup lineup={today.lineup} onJudge={(id) => void judge(id)} submitting={submitting} />
        </section>
      )}

      {today?.state === "scored" && today.target && (
        <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
          <div
            className={`rounded-xl border p-3 text-sm ${
              today.judgeCorrect
                ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                : "border-card-border bg-black/20 text-muted"
            }`}
          >
            {today.judgeCorrect
              ? "You identified your own target drawing. 25% chance — noted."
              : "Not the one. The decoys remain smug."}
            {judgeResult && <span className="ml-2 text-[var(--accent-phosphor)]">+{judgeResult.xpAwarded} XP</span>}
          </div>
          {judgeResult && <p className="text-sm text-muted">🦉 “{judgeResult.mascotLine}”</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">The target</p>
              <div className="reveal-flip mt-2 overflow-hidden rounded-xl border border-card-border">
                <TargetImage imageUrl={today.target.imageUrl} alt="Target drawing" className="h-48 w-full object-contain" />
              </div>
            </div>
            {today.sketchUrl && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Your sketch</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={today.sketchUrl} alt="Your sketch" className="mt-2 h-48 w-full rounded-xl border border-card-border object-contain" />
              </div>
            )}
          </div>
          <p className="text-xs text-muted">New drawing tomorrow.</p>
        </section>
      )}
    </main>
  );
}
