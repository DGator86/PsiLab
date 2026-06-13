export const FOCUS_LEVELS = [
  { id: "body-calm", label: "Level 1 · Body Calm" },
  { id: "expanded-awareness", label: "Level 2 · Expanded Awareness" },
  { id: "open-field", label: "Level 3 · Open Field" },
  // Logged variants, not part of the standard timer picker:
  { id: "breathwork", label: "Box Breathing" },
  { id: "spoon-parlor", label: "Spoon-Bending Parlor" },
] as const;

/** Levels offered by the standard focus timer UI. */
export const FOCUS_TIMER_LEVELS = FOCUS_LEVELS.slice(0, 3);

export const FOCUS_DURATIONS = [5, 10, 20] as const;

export const FOCUS_SENSATIONS = [
  "warmth",
  "tingling",
  "heaviness",
  "floating",
  "imagery",
  "sounds",
  "drifting",
  "stillness",
] as const;

export const FOCUS_MOODS = ["calm", "restless", "neutral", "energized", "sleepy"] as const;

export function isFocusLevel(id: string): boolean {
  return FOCUS_LEVELS.some((l) => l.id === id);
}

export const FOCUS_LINES = [
  "Session logged. The void noticed nothing unusual, which is its job.",
  "Stillness achieved, or at least attempted. Both count.",
  "Another entry in the lab notebook of consciousness.",
];

export function focusLine(): string {
  return FOCUS_LINES[Math.floor(Math.random() * FOCUS_LINES.length)];
}
