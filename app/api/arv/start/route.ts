import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { arvPredictions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { makeCommitment, pickFrom, previousUtcDate, utcDateString } from "@/lib/drill";
import { dailyTargetIndex } from "@/lib/rv";
import { getActivePool } from "@/lib/rv-server";

/**
 * Starts today's ARV prediction: the server flips a crypto coin NOW, commits
 * to it (hash goes to the client), and binds two photo targets to the
 * outcomes (A = heads, B = tails). The flip is revealed on the next UTC day.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }
  const today = utcDateString();
  const db = getDb();

  const existing = await db.query.arvPredictions.findFirst({
    where: and(eq(arvPredictions.userId, user.id), eq(arvPredictions.createdDate, today)),
  });
  if (existing) {
    return NextResponse.json({ error: "Already started today" }, { status: 409 });
  }

  const pool = await getActivePool("rv");
  if (pool.length < 2) {
    return NextResponse.json({ error: "Not enough targets in the pool yet" }, { status: 503 });
  }

  const outcome = pickFrom(["heads", "tails"] as const);
  const { salt, hash } = makeCommitment(outcome);

  const idxA = dailyTargetIndex(user.id, `${today}:arv-a`, pool.length);
  let idxB = createHash("sha256").update(`${user.id}:${today}:arv-b`).digest().readUInt32BE(0) % pool.length;
  if (idxB === idxA) idxB = (idxB + 1) % pool.length;

  // revealDate = tomorrow (UTC): previousUtcDate with -1 days back walks forward.
  const revealDate = previousUtcDate(today, -1);

  const [created] = await db
    .insert(arvPredictions)
    .values({
      userId: user.id,
      createdDate: today,
      revealDate,
      outcome,
      commitSalt: salt,
      commitHash: hash,
      targetAId: pool[idxA].id,
      targetBId: pool[idxB].id,
    })
    .onConflictDoNothing()
    .returning({ id: arvPredictions.id });
  if (!created) {
    return NextResponse.json({ error: "Already started today" }, { status: 409 });
  }

  return NextResponse.json({
    state: "choosing",
    commitHash: hash,
    revealDate,
    targetA: { id: pool[idxA].id, imageUrl: pool[idxA].imageUrl },
    targetB: { id: pool[idxB].id, imageUrl: pool[idxB].imageUrl },
  });
}
