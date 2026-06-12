export const MASCOT = {
  name: "Nox",
  type: "Pocket Owl",
} as const;

const hitLines = [
  "A hit. Don't let it go to your head.",
  "Correct. The sample size remains unimpressed.",
  "One for the spreadsheet.",
  "Noted. Statistically, somebody had to get that.",
  "Correct. I'll allow it.",
];

const missLines = [
  "A miss. The void appreciates your contribution.",
  "Incorrect. Chance sends its regards.",
  "No. But confidently no, which I respect.",
  "The cards remain coy.",
  "Wrong, but in a very reproducible way.",
];

const aboveChanceLines = [
  "You're running above chance. I'm professionally suspicious.",
  "Above chance. Keep going before I get excited.",
];

const atChanceLines = [
  "You're scoring exactly chance. Statistically immaculate.",
  "Perfectly average. The null hypothesis thanks you.",
];

const belowChanceLines = [
  "Below chance is also interesting, technically.",
  "If you keep missing this reliably, that's data too.",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function lineForResult(correct: boolean): string {
  return pick(correct ? hitLines : missLines);
}

export function lineForHitRate(hits: number, n: number, chance: number): string {
  if (n < 20) return "Not enough data yet. The universe remains coy.";
  const rate = hits / n;
  if (rate > chance + 0.03) return pick(aboveChanceLines);
  if (rate < chance - 0.03) return pick(belowChanceLines);
  return pick(atChanceLines);
}
