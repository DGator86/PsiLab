export type MascotId = "nox" | "iris" | "aster";

export const MASCOTS: Record<
  MascotId,
  { name: string; type: string; emoji: string; pro: boolean }
> = {
  nox: { name: "Nox", type: "Pocket Owl", emoji: "🦉", pro: false },
  iris: { name: "Iris", type: "Third-Eye Blob", emoji: "👁️", pro: true },
  aster: { name: "Aster", type: "Quiet Satellite", emoji: "🛰️", pro: true },
};

export function isMascotId(v: string): v is MascotId {
  return v in MASCOTS;
}

type LineSet = {
  hit: string[];
  miss: string[];
  aboveChance: string[];
  atChance: string[];
  belowChance: string[];
  tooEarly: string;
};

const LINES: Record<MascotId, LineSet> = {
  nox: {
    hit: [
      "A hit. Don't let it go to your head.",
      "Correct. The sample size remains unimpressed.",
      "One for the spreadsheet.",
      "Noted. Statistically, somebody had to get that.",
      "Correct. I'll allow it.",
    ],
    miss: [
      "A miss. The void appreciates your contribution.",
      "Incorrect. Chance sends its regards.",
      "No. But confidently no, which I respect.",
      "The cards remain coy.",
      "Wrong, but in a very reproducible way.",
    ],
    aboveChance: [
      "You're running above chance. I'm professionally suspicious.",
      "Above chance. Keep going before I get excited.",
    ],
    atChance: [
      "You're scoring exactly chance. Statistically immaculate.",
      "Perfectly average. The null hypothesis thanks you.",
    ],
    belowChance: [
      "Below chance is also interesting, technically.",
      "If you keep missing this reliably, that's data too.",
    ],
    tooEarly: "Not enough data yet. The universe remains coy.",
  },
  iris: {
    hit: [
      "A hit. I felt nothing, but congratulations.",
      "Correct. Day after day, the eye stays open.",
      "Yes. The void blinked first.",
    ],
    miss: [
      "A miss. Staring into the void continues on schedule.",
      "No. The third eye needs reading glasses, apparently.",
      "Incorrect. We log it and we move on. That's the practice.",
    ],
    aboveChance: ["Above chance. The eye twitches with cautious interest."],
    atChance: ["Exactly chance. A perfect, unbroken gaze into nothing."],
    belowChance: ["Below chance. Even the void is confused."],
    tooEarly: "Too few trials. The eye has barely opened.",
  },
  aster: {
    hit: [
      "Hit confirmed from orbit. No anomalies detected otherwise.",
      "Correct. Telemetry nominal.",
      "A hit. Logging quietly and saying nothing further.",
    ],
    miss: [
      "Miss. The universe remains coy.",
      "Negative contact. Continuing scheduled sweep.",
      "Incorrect. Signal indistinguishable from background.",
    ],
    aboveChance: ["Trending above chance. Maintaining professional silence."],
    atChance: ["Holding exactly at baseline. A very stable orbit."],
    belowChance: ["Below baseline. Recalibrating nothing, because that's how chance works."],
    tooEarly: "Insufficient data. Still listening.",
  },
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function lineForResult(correct: boolean, mascot: MascotId = "nox"): string {
  const set = LINES[mascot] ?? LINES.nox;
  return pick(correct ? set.hit : set.miss);
}

export function lineForHitRate(
  hits: number,
  n: number,
  chance: number,
  mascot: MascotId = "nox",
): string {
  const set = LINES[mascot] ?? LINES.nox;
  if (n < 20) return set.tooEarly;
  const rate = hits / n;
  if (rate > chance + 0.03) return pick(set.aboveChance);
  if (rate < chance - 0.03) return pick(set.belowChance);
  return pick(set.atChance);
}

export const MASCOT = MASCOTS.nox;
