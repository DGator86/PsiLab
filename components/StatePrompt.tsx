"use client";

import { useEffect, useState } from "react";

type DailyState = {
  sleep: string | null;
  caffeine: string | null;
  mood: string | null;
  meditated: boolean;
};

const EMPTY: DailyState = { sleep: null, caffeine: null, mood: null, meditated: false };

const GROUPS = [
  { key: "sleep" as const, label: "Sleep", options: ["poor", "ok", "good"] },
  { key: "caffeine" as const, label: "Caffeine", options: ["none", "some", "lots"] },
  { key: "mood" as const, label: "Mood", options: ["low", "neutral", "high"] },
];

/** One-tap daily state tags; saved instantly, used by the correlations panel. */
export default function StatePrompt() {
  const [state, setState] = useState<DailyState | null>(null);

  useEffect(() => {
    fetch("/api/state")
      .then((res) => (res.ok ? res.json() : { state: null }))
      .then((data) => setState(data.state ?? EMPTY))
      .catch(() => setState(EMPTY));
  }, []);

  function save(next: DailyState) {
    setState(next);
    void fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  if (!state) return null;

  return (
    <section className="rounded-2xl border border-card-border bg-card/80 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Today&apos;s state</h2>
        <span className="text-[10px] uppercase tracking-wide text-muted">feeds the correlations panel</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        {GROUPS.map((g) => (
          <div key={g.key} className="flex items-center gap-2">
            <span className="text-xs text-muted">{g.label}</span>
            {g.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => save({ ...state, [g.key]: state[g.key] === opt ? null : opt })}
                aria-pressed={state[g.key] === opt}
                className={`rounded-full border px-2.5 py-0.5 text-xs capitalize transition ${
                  state[g.key] === opt
                    ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/15 text-[var(--accent-phosphor)]"
                    : "border-card-border text-muted hover:text-foreground"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => save({ ...state, meditated: !state.meditated })}
          aria-pressed={state.meditated}
          className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
            state.meditated
              ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/15 text-[var(--accent-phosphor)]"
              : "border-card-border text-muted hover:text-foreground"
          }`}
        >
          meditated today
        </button>
      </div>
    </section>
  );
}
