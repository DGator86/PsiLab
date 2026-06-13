import { NextResponse } from "next/server";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { arvPredictions, rvTargets, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { XP_ARV_HIT, levelForXp, utcDateString } from "@/lib/drill";

async function targetPair(targetAId: string, targetBId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: rvTargets.id, imageUrl: rvTargets.imageUrl })
    .from(rvTargets)
    .where(inArray(rvTargets.id, [targetAId, targetBId]));
  return {
    a: rows.find((r) => r.id === targetAId) ?? null,
    b: rows.find((r) => r.id === targetBId) ?? null,
  };
}

/**
 * Associative remote viewing, daily cadence. Also performs the lazy reveal:
 * any prediction whose reveal date has arrived gets resolved on this visit.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }
  const today = utcDateString();
  const db = getDb();

  // Lazy reveal of matured predictions.
  const matured = await db.query.arvPredictions.findMany({
    where: and(
      eq(arvPredictions.userId, user.id),
      lte(arvPredictions.revealDate, today),
      isNull(arvPredictions.revealedAt),
    ),
  });
  let justRevealed: (typeof matured)[number] | null = null;
  for (const p of matured) {
    const correct = p.choice ? (p.choice === "A") === (p.outcome === "heads") : null;
    await db
      .update(arvPredictions)
      .set({ correct, revealedAt: new Date() })
      .where(eq(arvPredictions.id, p.id));
    if (correct) {
      await db
        .insert(xpEvents)
        .values({ userId: user.id, source: "arv_hit", amount: XP_ARV_HIT });
      const [u] = await db
        .update(users)
        .set({ xp: sql`${users.xp} + ${XP_ARV_HIT}` })
        .where(eq(users.id, user.id))
        .returning({ xp: users.xp });
      await db.update(users).set({ level: levelForXp(u.xp) }).where(eq(users.id, user.id));
    }
    justRevealed = { ...p, correct, revealedAt: new Date() };
  }

  const current = await db.query.arvPredictions.findFirst({
    where: and(eq(arvPredictions.userId, user.id), eq(arvPredictions.createdDate, today)),
  });

  let revealedPayload = null;
  if (justRevealed) {
    const pair = await targetPair(justRevealed.targetAId, justRevealed.targetBId);
    revealedPayload = {
      createdDate: justRevealed.createdDate,
      outcome: justRevealed.outcome,
      commitSalt: justRevealed.commitSalt,
      commitHash: justRevealed.commitHash,
      choice: justRevealed.choice,
      correct: justRevealed.correct,
      targetA: pair.a,
      targetB: pair.b,
      xpAwarded: justRevealed.correct ? XP_ARV_HIT : 0,
    };
  }

  if (!current) {
    return NextResponse.json({ state: "pending", revealed: revealedPayload });
  }

  const pair = await targetPair(current.targetAId, current.targetBId);
  return NextResponse.json({
    state: current.choice ? "locked" : "choosing",
    commitHash: current.commitHash,
    revealDate: current.revealDate,
    choice: current.choice,
    impressionsText: current.impressionsText,
    targetA: pair.a,
    targetB: pair.b,
    revealed: revealedPayload,
  });
}
