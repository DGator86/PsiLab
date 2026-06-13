import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rvTargets } from "@/db/schema";
import { lineupOrder, type RvMode } from "@/lib/rv";

export type Candidate = { id: string; imageUrl: string; tags: unknown };

export function poolKindFor(mode: RvMode): "photo" | "drawing" {
  return mode === "drawing" ? "drawing" : "photo";
}

export async function getActivePool(mode: RvMode): Promise<Candidate[]> {
  const db = getDb();
  return db
    .select({ id: rvTargets.id, imageUrl: rvTargets.imageUrl, tags: rvTargets.attributeTagsJson })
    .from(rvTargets)
    .where(and(eq(rvTargets.active, true), eq(rvTargets.kind, poolKindFor(mode))))
    .orderBy(asc(rvTargets.id));
}

/**
 * Rebuilds the blind 4-candidate lineup from stored ids. Candidates are
 * sorted by id and then permuted with a per-user/day seed so the real
 * target's position is stable across refreshes but leaks nothing.
 */
export async function buildLineup(
  userId: string,
  date: string,
  mode: RvMode,
  targetId: string,
  decoyIds: string[],
): Promise<Candidate[]> {
  const db = getDb();
  const ids = [targetId, ...decoyIds];
  const rows = await db
    .select({ id: rvTargets.id, imageUrl: rvTargets.imageUrl, tags: rvTargets.attributeTagsJson })
    .from(rvTargets)
    .where(inArray(rvTargets.id, ids));
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const order = lineupOrder(userId, date, mode);
  return order.filter((i) => i < sorted.length).map((i) => sorted[i]);
}
