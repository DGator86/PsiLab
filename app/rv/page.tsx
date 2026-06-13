"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import JudgeLineup, { type LineupItem } from "@/components/JudgeLineup";
import SketchPad from "@/components/SketchPad";
import TargetImage from "@/components/TargetImage";

const VOCAB = {
  colors: ["red", "orange", "yellow", "green", "blue", "white", "black", "brown", "grey"],
  gestalts: ["land", "water", "structure", "people", "vegetation", "sky", "machine", "animal"],
  textures: ["smooth", "rough", "soft", "hard", "wet", "dry", "grainy", "metallic"],
  sounds: ["silent", "hum", "wind", "water", "voices", "mechanical", "rhythmic"],
  dimensionals: ["tall", "flat", "wide", "massive", "small", "deep", "hollow", "dense", "angular", "curved"],
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
  sounds?: string[];
  dimensionals?: string[];
  temperature: string | null;
  motion: string | null;
  tone: string | null;
  notes: string;
};

type Target = { id: string; imageUrl: string; tags: Record<string, unknown> };

type TodayState = {
  state: "pending" | "judging" | "judged" | "scored";
  code: string;
  impressions?: Impressions;
  confidence?: number | null;
  sketchUrl?: string | null;
  lineup?: LineupItem[];
  judgeCorrect?: boolean | null;
  selfScore?: Record<string, string> | null;
  target?: Target | null;
};

const STAGES = [
  { id: "gestalt", title: "Stage 1 · Gestalt", prompt: "First contact. Which basic gestalts arrive?" },
  { id: "sensory", title: "Stage 2 · Sensory", prompt: "Colors, textures, temperature, sounds." },
  { id: "dimensional", title: "Stage 3 · Dimensionals", prompt: "Size, mass, verticality, motion." },
  { id: "aesthetic", title: "Stage 4 · Aesthetic", prompt: "How does the site feel?" },
  { id: "sketch", title: "Stage 5 · Sketch", prompt: "Draw what wants to be drawn. Quality optional." },
  { id: "summary", title: "Stage 6 · Summary", prompt: "Free-text summary and confidence." },
] as const;

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
          <Chip key={option} label={option} active={selected.includes(option)} onClick={() => onToggle(option)} />
        ))}
      </div>
    </div>
  );
}

function OneOfGroup({
  title,
  options,
  value,
  onSet,
}: {
  title: string;
  options: readonly string[];
  value: string | null;
  onSet: (v: string | null) => void;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option} label={option} active={value === option} onClick={() => onSet(value === option ? null : option)} />
        ))}
      </div>
    </div>
  );
}

export default function RvPage() {
  const [today, setToday] = useState<TodayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState(0);

  const [colors, setColors] = useState<string[]>([]);
  const [gestalts, setGestalts] = useState<string[]>([]);
  const [textures, setTextures] = useState<string[]>([]);
  const [sounds, setSounds] = useState<string[]>([]);
  const [dimensionals, setDimensionals] = useState<string[]>([]);
  const [temperature, setTemperature] = useState<string | null>(null);
  const [motion, setMotion] = useState<string | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [confidence, setConfidence] = useState(30);
  const [sketchUrl, setSketchUrl] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, string>>({});
  const [judgeResult, setJudgeResult] = useState<{ xpAwarded: number; mascotLine: string } | null>(null);
  const [scoreResult, setScoreResult] = useState<{ xpAwarded: number; mascotLine: string; questXp?: number } | null>(null);

  useEffect(() => {
    fetch("/api/rv/today?mode=rv")
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
          mode: "rv",
          impressions: { colors, gestalts, textures, sounds, dimensionals, temperature, motion, tone, notes },
          confidence,
          sketchUrl,
        }),
      });
      if (!res.ok) throw new Error(`Failed to submit (${res.status})`);
      const data = await res.json();
      setToday((prev) =>
        prev
          ? { ...prev, state: "judging", impressions: data.impressions, lineup: data.lineup, confidence: data.confidence, sketchUrl: data.sketchUrl }
          : prev,
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
        body: JSON.stringify({ mode: "rv", pickId }),
      });
      if (!res.ok) throw new Error(`Failed to judge (${res.status})`);
      const data = await res.json();
      setJudgeResult({ xpAwarded: data.xpAwarded, mascotLine: data.mascotLine });
      setToday((prev) =>
        prev ? { ...prev, state: "judged", judgeCorrect: data.judgeCorrect, target: data.target } : prev,
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
      setScoreResult({ xpAwarded: data.xpAwarded, mascotLine: data.mascotLine, questXp: data.questXp });
      setToday((prev) => (prev ? { ...prev, state: "scored", selfScore: data.selfScore } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const allScored = SCORE_CATEGORIES.every((c) => scores[c]);
  const current = STAGES[stage];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Remote viewing · coordinate
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{current.title}</p>
              <p className="mt-1 text-sm text-muted">{current.prompt}</p>
            </div>
            <span className="font-mono text-xs text-muted">
              {stage + 1}/{STAGES.length}
            </span>
          </div>
          <div className="flex gap-1">
            {STAGES.map((s, i) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded ${i <= stage ? "bg-[var(--accent-phosphor)]" : "bg-card-border"}`}
              />
            ))}
          </div>

          {current.id === "gestalt" && (
            <ChipGroup title="Gestalts" options={VOCAB.gestalts} selected={gestalts} onToggle={toggle(gestalts, setGestalts)} />
          )}

          {current.id === "sensory" && (
            <div className="space-y-4">
              <ChipGroup title="Colors" options={VOCAB.colors} selected={colors} onToggle={toggle(colors, setColors)} />
              <ChipGroup title="Textures" options={VOCAB.textures} selected={textures} onToggle={toggle(textures, setTextures)} />
              <ChipGroup title="Sounds" options={VOCAB.sounds} selected={sounds} onToggle={toggle(sounds, setSounds)} />
              <OneOfGroup title="Temperature" options={VOCAB.temperature} value={temperature} onSet={setTemperature} />
            </div>
          )}

          {current.id === "dimensional" && (
            <div className="space-y-4">
              <ChipGroup title="Dimensionals" options={VOCAB.dimensionals} selected={dimensionals} onToggle={toggle(dimensionals, setDimensionals)} />
              <OneOfGroup title="Motion" options={VOCAB.motion} value={motion} onSet={setMotion} />
            </div>
          )}

          {current.id === "aesthetic" && (
            <OneOfGroup title="Emotional tone" options={VOCAB.tone} value={tone} onSet={setTone} />
          )}

          {current.id === "sketch" && <SketchPad onChange={setSketchUrl} />}

          {current.id === "summary" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="notes" className="text-xs uppercase tracking-wide text-muted">
                  Summary notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Whatever arrived. No editing after lock."
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
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStage((s) => Math.max(0, s - 1))}
              disabled={stage === 0}
              className="rounded-xl border border-card-border px-4 py-2 text-sm text-muted transition hover:text-foreground disabled:opacity-40"
            >
              Back
            </button>
            {stage < STAGES.length - 1 ? (
              <button
                onClick={() => setStage((s) => s + 1)}
                className="rounded-xl border border-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-[var(--accent-phosphor)] transition hover:bg-[var(--accent-phosphor)]/10"
              >
                Next stage
              </button>
            ) : (
              <button
                onClick={() => void submitImpressions()}
                disabled={submitting}
                className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
              >
                Lock impressions
              </button>
            )}
          </div>
        </section>
      )}

      {today?.state === "judging" && today.lineup && (
        <section className="rounded-2xl border border-card-border bg-card/80 p-6">
          <JudgeLineup lineup={today.lineup} onJudge={(id) => void judge(id)} submitting={submitting} />
        </section>
      )}

      {(today?.state === "judged" || today?.state === "scored") && today.target && (
        <section className="space-y-5 rounded-2xl border border-card-border bg-card/80 p-6">
          <div
            className={`rounded-xl border p-3 text-sm ${
              today.judgeCorrect
                ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                : "border-card-border bg-black/20 text-muted"
            }`}
          >
            Blind judging: {today.judgeCorrect ? "you picked the real target (25% chance)." : "not the target. Chance favored this outcome 3-to-1."}
            {judgeResult && <span className="ml-2 text-[var(--accent-phosphor)]">+{judgeResult.xpAwarded} XP</span>}
          </div>
          {judgeResult && <p className="text-sm text-muted">🦉 “{judgeResult.mascotLine}”</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="reveal-flip overflow-hidden rounded-xl border border-card-border">
              <TargetImage imageUrl={today.target.imageUrl} alt="Revealed remote viewing target" />
            </div>
            <div className="rounded-xl border border-card-border bg-black/20 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted">Your impressions</p>
              <ul className="mt-2 space-y-1 text-muted">
                <li>Gestalts: {today.impressions?.gestalts.join(", ") || "—"}</li>
                <li>Colors: {today.impressions?.colors.join(", ") || "—"}</li>
                <li>Textures: {today.impressions?.textures.join(", ") || "—"}</li>
                <li>Sounds: {today.impressions?.sounds?.join(", ") || "—"}</li>
                <li>Dimensionals: {today.impressions?.dimensionals?.join(", ") || "—"}</li>
                <li>Temperature: {today.impressions?.temperature ?? "—"} · Motion: {today.impressions?.motion ?? "—"} · Tone: {today.impressions?.tone ?? "—"}</li>
                {today.impressions?.notes && <li>Notes: {today.impressions.notes}</li>}
                <li>Confidence: {today.confidence ?? "—"}%</li>
              </ul>
              {today.sketchUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={today.sketchUrl} alt="Your sketch" className="mt-3 w-full rounded-lg border border-card-border" />
              )}
            </div>
          </div>

          {today.state === "judged" && (
            <div>
              <p className="text-sm font-semibold">Self-score (subjective, kept separate from the blind stat)</p>
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
                Self-scored: {SCORE_CATEGORIES.map((c) => `${c} ${today.selfScore?.[c] ?? "—"}`).join(" · ")}
              </p>
              {scoreResult && (
                <p className="mt-2 text-sm text-[var(--accent-phosphor)]">
                  +{scoreResult.xpAwarded} XP
                  {scoreResult.questXp ? ` · Daily quest complete, +${scoreResult.questXp} XP` : ""}
                </p>
              )}
              <p className="mt-2 text-sm text-muted">
                🦉 “{scoreResult?.mascotLine ?? "Session archived. The void thanks you."}”
              </p>
              <p className="mt-2 text-xs text-muted">New coordinate tomorrow.</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
