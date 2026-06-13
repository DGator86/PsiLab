"use client";

import { useEffect, useState } from "react";

type Prereg = {
  id: string;
  drillType: string;
  nCommitted: number;
  status: string;
  progress: number;
  hits: number;
  chance: number;
  pValue: number | null;
  sprt: "accept-h1" | "accept-h0" | "continue";
};

const DRILL_LABELS: Record<string, string> = {
  zener4: "Symbols (1-of-4)",
  redblack: "Red / Black",
};

const SPRT_LABELS = {
  "accept-h1": "SPRT: evidence for above-chance scoring",
  "accept-h0": "SPRT: evidence for chance-level scoring",
  continue: "SPRT: undecided — keep going",
} as const;

export default function PreregPanel() {
  const [items, setItems] = useState<Prereg[] | null>(null);
  const [drillType, setDrillType] = useState("zener4");
  const [n, setN] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/prereg")
      .then((res) => (res.ok ? res.json() : { preregistrations: [] }))
      .then((data) => setItems(data.preregistrations ?? []))
      .catch(() => setItems([]));
  }

  useEffect(load, []);

  async function create() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/prereg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drillType, n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const hasActive = (t: string) => items?.some((p) => p.drillType === t && p.status === "active");

  return (
    <section className="rounded-2xl border border-card-border bg-card/80 p-6">
      <h2 className="text-base font-semibold">Preregistration</h2>
      <p className="mt-1 text-xs text-muted">
        Commit to a sample size <em>before</em> looking at the outcome — the gold standard. Finish
        the run for bonus XP and a sequential (SPRT) verdict.
      </p>

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={drillType}
          onChange={(e) => setDrillType(e.target.value)}
          className="rounded-xl border border-card-border bg-black/20 px-3 py-2 text-sm"
          aria-label="Drill type"
        >
          <option value="zener4">Symbols (1-of-4)</option>
          <option value="redblack">Red / Black</option>
        </select>
        <select
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          className="rounded-xl border border-card-border bg-black/20 px-3 py-2 text-sm"
          aria-label="Committed trials"
        >
          {[50, 100, 200, 500].map((v) => (
            <option key={v} value={v}>
              {v} trials
            </option>
          ))}
        </select>
        <button
          onClick={() => void create()}
          disabled={submitting || hasActive(drillType)}
          className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
        >
          {hasActive(drillType) ? "Run already active" : "Commit"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {items === null && <p className="text-sm text-muted">Loading…</p>}
        {items?.length === 0 && <p className="text-sm text-muted">No preregistered runs yet.</p>}
        {items?.map((p) => (
          <div key={p.id} className="rounded-xl border border-card-border bg-black/20 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">
                {DRILL_LABELS[p.drillType] ?? p.drillType} · {p.nCommitted} trials
              </p>
              <span
                className={`font-mono text-xs ${p.status === "completed" ? "text-[var(--accent-phosphor)]" : "text-muted"}`}
              >
                {p.status}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-white/5">
              <div
                className="h-full bg-[var(--accent-phosphor)]"
                style={{ width: `${Math.min(100, (p.progress / p.nCommitted) * 100)}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-muted">
              {p.progress}/{p.nCommitted} · {p.hits} hits · chance {(p.chance * 100).toFixed(0)}%
              {p.pValue !== null && p.status === "completed" && (
                <> · p = {p.pValue < 0.0001 ? "< 0.0001" : p.pValue.toFixed(4)}</>
              )}
            </p>
            <p className="mt-1 text-xs text-muted">{SPRT_LABELS[p.sprt]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
