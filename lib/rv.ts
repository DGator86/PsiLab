import { createHash } from "node:crypto";

export const IMPRESSION_VOCAB = {
  colors: ["red", "orange", "yellow", "green", "blue", "white", "black", "brown", "grey"],
  gestalts: ["land", "water", "structure", "people", "vegetation", "sky", "machine", "animal"],
  textures: ["smooth", "rough", "soft", "hard", "wet", "dry", "grainy", "metallic"],
  sounds: ["silent", "hum", "wind", "water", "voices", "mechanical", "rhythmic"],
  dimensionals: ["tall", "flat", "wide", "massive", "small", "deep", "hollow", "dense", "angular", "curved"],
  temperature: ["cold", "cool", "neutral", "warm", "hot"],
  motion: ["still", "slow", "flowing", "fast", "chaotic"],
  tone: ["calm", "ominous", "joyful", "lonely", "busy", "sacred", "mundane"],
} as const;

export const SELF_SCORE_CATEGORIES = ["colors", "shapes", "textures", "overall"] as const;
export type SelfScoreCategory = (typeof SELF_SCORE_CATEGORIES)[number];
export type SelfScoreValue = "hit" | "partial" | "miss";

export function isSelfScoreValue(v: unknown): v is SelfScoreValue {
  return v === "hit" || v === "partial" || v === "miss";
}

export type Impressions = {
  colors: string[];
  gestalts: string[];
  textures: string[];
  sounds: string[];
  dimensionals: string[];
  temperature: string | null;
  motion: string | null;
  tone: string | null;
  notes: string;
};

export function sanitizeImpressions(raw: unknown): Impressions | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const pickList = (key: "colors" | "gestalts" | "textures" | "sounds" | "dimensionals") => {
    const allowed = IMPRESSION_VOCAB[key] as readonly string[];
    const value = Array.isArray(r[key]) ? (r[key] as unknown[]) : [];
    return value.filter((v): v is string => typeof v === "string" && allowed.includes(v));
  };
  const pickOne = (key: "temperature" | "motion" | "tone") => {
    const allowed = IMPRESSION_VOCAB[key] as readonly string[];
    const value = r[key];
    return typeof value === "string" && allowed.includes(value) ? value : null;
  };
  return {
    colors: pickList("colors"),
    gestalts: pickList("gestalts"),
    textures: pickList("textures"),
    sounds: pickList("sounds"),
    dimensionals: pickList("dimensionals"),
    temperature: pickOne("temperature"),
    motion: pickOne("motion"),
    tone: pickOne("tone"),
    notes: typeof r.notes === "string" ? r.notes.slice(0, 2000) : "",
  };
}

/** Validates a small sketch data URL (PNG/JPEG/WebP, capped at ~200KB). */
export function sanitizeSketchUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw)) return null;
  if (raw.length > 200_000) return null;
  return raw;
}

export type RvMode = "rv" | "ganzfeld" | "drawing";

export function isRvMode(v: string): v is RvMode {
  return v === "rv" || v === "ganzfeld" || v === "drawing";
}

/**
 * Deterministic daily target assignment: hash(userId, date, mode) mod pool size.
 * Stable for the whole day, different across users and modes, and not
 * guessable without knowing the pool ordering.
 */
export function dailyTargetIndex(
  userId: string,
  date: string,
  poolSize: number,
  mode: RvMode = "rv",
): number {
  const digest = createHash("sha256").update(`${userId}:${date}:${mode}-target`).digest();
  return digest.readUInt32BE(0) % poolSize;
}

/** Stargate-style coordinate code, e.g. "8472-9931". */
export function sessionCode(userId: string, date: string, mode: RvMode = "rv"): string {
  const digest = createHash("sha256").update(`${userId}:${date}:${mode}-code`).digest();
  const a = (digest.readUInt16BE(0) % 9000) + 1000;
  const b = (digest.readUInt16BE(2) % 9000) + 1000;
  return `${a}-${b}`;
}

/**
 * Deterministic decoy pick: 3 distinct indices != targetIndex, derived from
 * the same seed so a refresh can't reshuffle the lineup.
 */
export function decoyIndices(
  userId: string,
  date: string,
  poolSize: number,
  targetIndex: number,
  mode: RvMode = "rv",
): number[] {
  const picks: number[] = [];
  let counter = 0;
  while (picks.length < Math.min(3, poolSize - 1)) {
    const digest = createHash("sha256")
      .update(`${userId}:${date}:${mode}-decoy-${counter++}`)
      .digest();
    const idx = digest.readUInt32BE(0) % poolSize;
    if (idx !== targetIndex && !picks.includes(idx)) picks.push(idx);
  }
  return picks;
}

/** Deterministic shuffle of the 4-candidate lineup (so position leaks nothing). */
export function lineupOrder(userId: string, date: string, mode: RvMode = "rv"): number[] {
  const digest = createHash("sha256").update(`${userId}:${date}:${mode}-lineup`).digest();
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = digest[i] % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Swann-style CRV stages used by the staged impression flow. */
export const CRV_STAGES = [
  {
    id: "gestalt",
    title: "Stage 1 · Ideogram / gestalt",
    prompt: "First contact. Which basic gestalts arrive?",
  },
  {
    id: "sensory",
    title: "Stage 2 · Sensory contact",
    prompt: "Colors, textures, temperatures, sounds.",
  },
  {
    id: "dimensional",
    title: "Stage 3 · Dimensionals",
    prompt: "Size, verticality, mass, density, motion.",
  },
  {
    id: "aesthetic",
    title: "Stage 4 · Emotional / aesthetic",
    prompt: "How does the site feel?",
  },
  {
    id: "sketch",
    title: "Stage 5 · Sketch",
    prompt: "Draw what wants to be drawn. Quality optional.",
  },
  {
    id: "summary",
    title: "Stage 6 · Summary",
    prompt: "Free-text summary and confidence.",
  },
] as const;

export const RV_VERDICTS: Record<SelfScoreValue, string[]> = {
  hit: [
    "A self-scored hit. The committee of one is impressed.",
    "Strong overlap. Noted with one raised eyebrow.",
  ],
  partial: [
    "Partial contact. The universe gave you a trailer, not the film.",
    "Some signal, some noise. Mostly noise, statistically.",
  ],
  miss: [
    "A miss. The target remains comfortably elsewhere.",
    "No overlap detected. The void appreciates your honesty.",
  ],
};

export function rvVerdictLine(overall: SelfScoreValue): string {
  const lines = RV_VERDICTS[overall];
  return lines[Math.floor(Math.random() * lines.length)];
}

export const JUDGE_VERDICTS = {
  hit: [
    "You picked the real target out of the lineup. That one counts.",
    "Correct identification. 25% chance, 100% smugness permitted.",
    "The real target. Logged with quiet astonishment.",
  ],
  miss: [
    "Not the target. The decoys send their thanks.",
    "A miss — but a beautifully blind one. That's the protocol working.",
    "Wrong pick. Chance predicted this 75% of the time, so no drama.",
  ],
} as const;

export function judgeVerdictLine(correct: boolean): string {
  const lines = correct ? JUDGE_VERDICTS.hit : JUDGE_VERDICTS.miss;
  return lines[Math.floor(Math.random() * lines.length)];
}
