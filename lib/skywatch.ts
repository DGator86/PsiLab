export const MUNDANE_CHECKLIST = [
  { id: "flights", label: "Checked a flight tracker for aircraft in that direction" },
  { id: "satellites", label: "Checked satellite / Starlink pass times" },
  { id: "launches", label: "Checked for known rocket launches" },
  { id: "balloons", label: "Considered weather balloons and drones" },
  { id: "planets", label: "Ruled out Venus, Jupiter, and other bright planets" },
] as const;

export type ChecklistId = (typeof MUNDANE_CHECKLIST)[number]["id"];

export const WEATHER_OPTIONS = ["clear", "partly cloudy", "overcast", "hazy", "windy"] as const;
export const DURATION_OPTIONS = [15, 30, 60, 120] as const;

export const SKYWATCH_LINES = [
  "Log filed. The sky remains under observation.",
  "Another patient hour under the dome. The dome appreciates it.",
  "Field work logged. Most lights are airplanes. The good ones always are — until they aren't.",
];

export function skywatchLine(): string {
  return SKYWATCH_LINES[Math.floor(Math.random() * SKYWATCH_LINES.length)];
}
