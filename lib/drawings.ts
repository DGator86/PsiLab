/**
 * Pool of simple line drawings for the drawing-duplication drill
 * (SRI/Geller style). Stored in rv_targets with imageUrl `svg:<id>` and
 * kind "drawing"; rendered inline from these paths so no assets are needed.
 *
 * All paths live in a 100x100 viewBox, stroke-only.
 */
export type DrawingDef = { id: string; label: string; paths: string[] };

export const DRAWINGS: DrawingDef[] = [
  { id: "house", label: "House", paths: ["M20 50 L50 25 L80 50", "M28 50 L28 80 L72 80 L72 50", "M44 80 L44 62 L56 62 L56 80"] },
  { id: "sun", label: "Sun", paths: ["M50 35 A15 15 0 1 0 50 65 A15 15 0 1 0 50 35", "M50 10 L50 22", "M50 78 L50 90", "M10 50 L22 50", "M78 50 L90 50", "M22 22 L31 31", "M69 69 L78 78", "M78 22 L69 31", "M31 69 L22 78"] },
  { id: "boat", label: "Sailboat", paths: ["M25 70 L75 70 L65 82 L35 82 Z", "M50 70 L50 25", "M50 25 L75 60 L50 60 Z"] },
  { id: "fish", label: "Fish", paths: ["M20 50 Q45 25 70 50 Q45 75 20 50", "M70 50 L85 38 L85 62 Z", "M38 45 A2 2 0 1 0 38 49 A2 2 0 1 0 38 45"] },
  { id: "tree", label: "Tree", paths: ["M50 80 L50 55", "M50 55 Q25 55 30 35 Q32 18 50 20 Q68 18 70 35 Q75 55 50 55", "M40 80 L60 80"] },
  { id: "eye", label: "Eye", paths: ["M15 50 Q50 20 85 50 Q50 80 15 50", "M50 38 A12 12 0 1 0 50 62 A12 12 0 1 0 50 38"] },
  { id: "star", label: "Star", paths: ["M50 15 L59 40 L86 40 L64 56 L72 82 L50 66 L28 82 L36 56 L14 40 L41 40 Z"] },
  { id: "cup", label: "Cup", paths: ["M30 35 L34 80 L66 80 L70 35", "M30 35 L70 35", "M70 45 Q85 47 80 60 Q77 68 68 64"] },
  { id: "mountain", label: "Mountains", paths: ["M10 80 L38 35 L55 62 L68 42 L90 80 Z", "M32 45 L38 52 L44 45"] },
  { id: "umbrella", label: "Umbrella", paths: ["M20 50 Q50 15 80 50", "M20 50 Q35 42 50 50 Q65 42 80 50", "M50 50 L50 80 Q50 88 42 86"] },
  { id: "key", label: "Key", paths: ["M30 38 A12 12 0 1 0 30 62 A12 12 0 1 0 30 38", "M42 50 L82 50", "M70 50 L70 60", "M80 50 L80 62"] },
  { id: "arrow", label: "Arrow", paths: ["M15 50 L80 50", "M62 32 L82 50 L62 68"] },
  { id: "flower", label: "Flower", paths: ["M50 45 A8 8 0 1 0 50 61 A8 8 0 1 0 50 45", "M50 30 Q60 38 50 45 Q40 38 50 30", "M68 45 Q64 56 53 52 Q58 42 68 45", "M61 70 Q50 72 49 62 Q60 60 61 70", "M39 70 Q38 60 49 62 Q50 72 39 70", "M32 45 Q42 42 47 52 Q36 56 32 45", "M50 62 L50 88"] },
  { id: "wave", label: "Waves", paths: ["M10 45 Q25 30 40 45 Q55 60 70 45 Q82 33 92 45", "M10 65 Q25 50 40 65 Q55 80 70 65 Q82 53 92 65"] },
  { id: "moon", label: "Crescent moon", paths: ["M62 15 A38 38 0 1 0 62 85 A30 30 0 1 1 62 15"] },
  { id: "ladder", label: "Ladder", paths: ["M38 12 L32 88", "M66 12 L72 88", "M36 28 L67 28", "M35 46 L69 46", "M34 64 L70 64"] },
  { id: "bell", label: "Bell", paths: ["M50 20 Q72 22 72 55 L78 66 L22 66 L28 55 Q28 22 50 20", "M44 66 Q44 78 50 78 Q56 78 56 66"] },
  { id: "kite", label: "Kite", paths: ["M50 12 L72 42 L50 72 L28 42 Z", "M50 12 L50 72", "M28 42 L72 42", "M50 72 Q58 80 52 86 Q46 92 54 96"] },
  { id: "snail", label: "Spiral", paths: ["M50 50 Q58 50 58 42 Q58 32 46 32 Q32 32 32 48 Q32 66 52 66 Q74 66 74 44 Q74 20 48 20"] },
  { id: "glasses", label: "Glasses", paths: ["M22 50 A12 12 0 1 0 46 50 A12 12 0 1 0 22 50", "M54 50 A12 12 0 1 0 78 50 A12 12 0 1 0 54 50", "M46 50 Q50 45 54 50", "M22 50 L12 44", "M78 50 L88 44"] },
];

export function drawingById(id: string): DrawingDef | undefined {
  return DRAWINGS.find((d) => d.id === id);
}

/** Extracts the drawing id from an rv_targets imageUrl of the form "svg:house". */
export function svgIdFromUrl(url: string): string | null {
  return url.startsWith("svg:") ? url.slice(4) : null;
}
