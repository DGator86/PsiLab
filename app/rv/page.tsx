"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const VOCAB = {
  colors: ["red", "orange", "yellow", "green", "blue", "white", "black", "brown", "grey"],
  gestalts: ["land", "water", "structure", "people", "vegetation", "sky", "machine", "animal"],
  textures: ["smooth", "rough", "soft", "hard", "wet", "dry", "grainy", "metallic"],
  temperature: ["cold", "cool", "neutral", "warm", "hot"],
  motion: ["still", "slow", "flowing", "fast", "chaotic"],
  tone: ["calm", "ominous", "joyful", "lonely", "busy", "sacred", "mundane"],
} as const;

const SCORE_CATEGORIES = ["colors", "shapes", "textures", "overall"] as const;
const SCORE_VALUES = ["hit", "partial", "miss"] as const;

type Impressions = {
  colors: string[];
  gestalts: string[];
  textures: string[];
  temperature: string | null;
  motion: string | null;
  tone: string | null;
  notes: string;
};

type Target = { imageUrl: string; tags: Record<string, unknown> };

type TodayState = {
  state: "pending" | "revealed" | "scored";
  code: string;
  impressions?: Impressions;
  confidence?: number | null;
  selfScore?: Record<string, string> | null;
  target?: Target | null;
};

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

function ChipGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            active={selected.includes(option)}
            onClick={() => onToggle(option)}
          />
        ))}
      </div>
    </div>
  );
}

export default function RvPage() {
  const [today, setToday] = useState<TodayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [colors, setColors] = useState<string[]>([]);
  const [gestalts, setGestalts] = useState<string[]>([]);
  const [textures, setTextures] = useState<string[]>([]);
  const [temperature, setTemperature] = useState<string | null>(null);
  const [motion, setMotion] = useState<string | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [confidence, setConfidence] = useState(30);

  const [scores, setScores] = useState<Record<string, string>>({});
  const [scoreResult, setScoreResult] = useState<{ xpAwarded: number; mascotLine: string } | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/rv/today")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then(setToday)
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"));
  }, []);

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
          impressions: { colors, gestalts, textures, temperature, motion, tone, notes },
          confidence,
        }),
      });
      if (!res.ok) throw new Error(`Failed to submit (${res.status})`);
      const data = await res.json();
      setToday((prev) =>
        prev ? { ...prev, state: "revealed", impressions: data.impressions, target: data.target, confidence: data.confidence } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitScores() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rv/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfScore: scores }),
      });
      if (!res.ok) throw new Error(`Failed to score (${res.status})`);
      const data = await res.json();
      setScoreResult({ xpAwarded: data.xpAwarded, mascotLine: data.mascotLine });
      setToday((prev) => (prev ? { ...prev, state: "scored", selfScore: data.selfScore } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const allScored = SCORE_CATEGORIES.every((c) => scores[c]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Remote viewing · daily target
          </p>
          <h1 className="mt-1 text-xl font-semibold">{today?.code ?? "Target …"}</h1>
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

      {!today && !error && (
        <div className="h-64 animate-pulse rounded-2xl border border-card-border bg-card/50" />
      )}

      {today?.state === "pending" && (
        <section className="space-y-5 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm text-muted">
            A target image is already assigned to this session. Record your impressions first —
            the reveal is one-way and your entries lock when you submit.
          </p>

          <ChipGroup title="Colors" options={VOCAB.colors} selected={colors} onToggle={toggle(colors, setColors)} />
          <ChipGroup title="Gestalts / shapes" options={VOCAB.gestalts} selected={gestalts} onToggle={toggle(gestalts, setGestalts)} />
          <ChipGroup title="Textures" options={VOCAB.textures} selected={textures} onToggle={toggle(textures, setTextures)} />

          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ["Temperature", VOCAB.temperature, temperature, setTemperature],
              ["Motion", VOCAB.motion, motion, setMotion],
              ["Emotional tone", VOCAB.tone, tone, setTone],
            ] as const).map(([title, options, value, set]) => (
              <div key={title}>
                <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {options.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      active={value === option}
                      onClick={() => set(value === option ? null : option)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="notes" className="text-xs uppercase tracking-wide text-muted">
              Free-text notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Whatever arrives. No editing after reveal."
              className="mt-2 w-full rounded-xl border border-card-border bg-black/20 p-3 text-sm outline-none focus:border-[var(--accent-phosphor)]"
            />
          </div>

          <div>
            <label htmlFor="rv-confidence" className="flex justify-between text-sm text-muted">
              <span>Confidence</span>
              <span className="font-mono">{confidence}%</span>
            </label>
            <input
              id="rv-confidence"
              type="range"
              min={0}
              max={100}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--accent-phosphor)]"
            />
          </div>

          <button
            onClick={() => void submitImpressions()}
            disabled={submitting}
            className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            Lock impressions &amp; reveal target
          </button>
        </section>
      )}

      {(today?.state === "revealed" || today?.state === "scored") && today.target && (
        <section className="space-y-5 rounded-2xl border border-card-border bg-card/80 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="reveal-flip overflow-hidden rounded-xl border border-card-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={today.target.imageUrl}
                alt="Revealed remote viewing target"
                className="h-56 w-full object-cover"
              />
            </div>
            <div className="rounded-xl border border-card-border bg-black/20 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted">Your impressions</p>
              <ul className="mt-2 space-y-1 text-muted">
                <li>Colors: {today.impressions?.colors.join(", ") || "—"}</li>
                <li>Gestalts: {today.impressions?.gestalts.join(", ") || "—"}</li>
                <li>Textures: {today.impressions?.textures.join(", ") || "—"}</li>
                <li>Temperature: {today.impressions?.temperature ?? "—"}</li>
                <li>Motion: {today.impressions?.motion ?? "—"}</li>
                <li>Tone: {today.impressions?.tone ?? "—"}</li>
                {today.impressions?.notes && <li>Notes: {today.impressions.notes}</li>}
                <li>Confidence: {today.confidence ?? "—"}%</li>
              </ul>
            </div>
          </div>

          {today.state === "revealed" && (
            <div>
              <p className="text-sm font-semibold">Self-score (subjective, labeled as such)</p>
              <div className="mt-3 space-y-3">
                {SCORE_CATEGORIES.map((category) => (
                  <div key={category} className="flex items-center justify-between gap-3">
                    <span className="text-sm capitalize text-muted">{category}</span>
                    <div className="flex gap-2">
                      {SCORE_VALUES.map((value) => (
                        <Chip
                          key={value}
                          label={value}
                          active={scores[category] === value}
                          onClick={() => setScores((s) => ({ ...s, [category]: value }))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => void submitScores()}
                disabled={!allScored || submitting}
                className="mt-4 rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
              >
                Submit self-score
              </button>
            </div>
          )}

          {today.state === "scored" && (
            <div className="rounded-xl border border-card-border bg-black/20 p-4">
              <p className="text-sm">
                Scored:{" "}
                {SCORE_CATEGORIES.map((c) => `${c} ${today.selfScore?.[c] ?? "—"}`).join(" · ")}
              </p>
              {scoreResult && (
                <p className="mt-2 text-sm text-[var(--accent-phosphor)]">
                  +{scoreResult.xpAwarded} XP
                </p>
              )}
              <p className="mt-2 text-sm text-muted">
                🦉 Nox: “{scoreResult?.mascotLine ?? "Session archived. The void thanks you."}”
              </p>
              <p className="mt-2 text-xs text-muted">New target tomorrow.</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
