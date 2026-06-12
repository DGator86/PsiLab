import { createHash } from "node:crypto";

export const IMPRESSION_VOCAB = {
  colors: ["red", "orange", "yellow", "green", "blue", "white", "black", "brown", "grey"],
  gestalts: ["land", "water", "structure", "people", "vegetation", "sky", "machine", "animal"],
  textures: ["smooth", "rough", "soft", "hard", "wet", "dry", "grainy", "metallic"],
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
  temperature: string | null;
  motion: string | null;
  tone: string | null;
  notes: string;
};

export function sanitizeImpressions(raw: unknown): Impressions | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const pickList = (key: "colors" | "gestalts" | "textures") => {
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
    temperature: pickOne("temperature"),
    motion: pickOne("motion"),
    tone: pickOne("tone"),
    notes: typeof r.notes === "string" ? r.notes.slice(0, 2000) : "",
  };
}

/**
 * Deterministic daily target assignment: hash(userId, date) mod pool size.
 * Stable for the whole day, different across users, and not guessable
 * without knowing the pool ordering.
 */
export function dailyTargetIndex(userId: string, date: string, poolSize: number): number {
  const digest = createHash("sha256").update(`${userId}:${date}:rv-target`).digest();
  return digest.readUInt32BE(0) % poolSize;
}

/** Cosmetic session code, e.g. "Target 4471-B". */
export function sessionCode(userId: string, date: string): string {
  const digest = createHash("sha256").update(`${userId}:${date}:rv-code`).digest();
  const num = (digest.readUInt16BE(0) % 9000) + 1000;
  const letter = String.fromCharCode(65 + (digest[2] % 6));
  return `Target ${num}-${letter}`;
}

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
