import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "@/db/client";
import { pkSessions, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { XP_PK_SESSION, levelForXp } from "@/lib/drill";
import { checkAchievements } from "@/lib/awards";

const ROUNDS = 20;
const BITS_PER_ROUND = 200;

const PK_LINES = {
  high: ["Intention: high. The bits were informed and remained bits."],
  low: ["Intention: low. The RNG acknowledges your preference."],
  control: ["Control run logged. The baseline thanks you for your neutrality."],
};

/**
 * PEAR-style RNG intention session. All bits are generated server-side with
 * crypto randomness in one shot — the client only animates the playback, so
 * there is nothing to manipulate.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const intention = (body as Record<string, unknown>)?.intention;
  if (intention !== "high" && intention !== "low" && intention !== "control") {
    return NextResponse.json({ error: "Intention must be high, low, or control" }, { status: 400 });
  }

  // One round = 200 bits = 25 random bytes, popcounted.
  const rounds: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const bytes = randomBytes(BITS_PER_ROUND / 8);
    let ones = 0;
    for (const b of bytes) {
      let v = b;
      while (v) {
        ones += v & 1;
        v >>= 1;
      }
    }
    rounds.push(ones);
  }

  const bitsTotal = ROUNDS * BITS_PER_ROUND;
  const onesTotal = rounds.reduce((a, b) => a + b, 0);
  const zScore = (onesTotal - bitsTotal / 2) / Math.sqrt(bitsTotal / 4);

  const db = getDb();
  await db.insert(pkSessions).values({
    userId: user.id,
    intention,
    bitsTotal,
    onesTotal,
    zScore,
    roundsJson: rounds,
  });

  await db
    .insert(xpEvents)
    .values({ userId: user.id, source: "pk_session", amount: XP_PK_SESSION });
  const [u] = await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${XP_PK_SESSION}` })
    .where(eq(users.id, user.id))
    .returning({ xp: users.xp });
  await db.update(users).set({ level: levelForXp(u.xp) }).where(eq(users.id, user.id));

  const newAchievements = await checkAchievements(user.id);

  return NextResponse.json({
    intention,
    rounds,
    bitsPerRound: BITS_PER_ROUND,
    bitsTotal,
    onesTotal,
    zScore,
    xpAwarded: XP_PK_SESSION,
    mascotLine: PK_LINES[intention][0],
    newAchievements,
  });
}
