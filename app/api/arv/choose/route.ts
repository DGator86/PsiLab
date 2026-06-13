import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { arvPredictions, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { XP_ARV_PREDICTION, levelForXp, utcDateString } from "@/lib/drill";

/** Locks today's ARV choice. Immutable; outcome stays sealed until tomorrow. */
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
  const raw = (body as Record<string, unknown>) ?? {};
  const choice = raw.choice === "A" || raw.choice === "B" ? raw.choice : null;
  if (!choice) {
    return NextResponse.json({ error: "Choice must be A or B" }, { status: 400 });
  }
  const impressionsText =
    typeof raw.impressionsText === "string" ? raw.impressionsText.slice(0, 1000) : null;

  const today = utcDateString();
  const db = getDb();

  const updated = await db
    .update(arvPredictions)
    .set({ choice, impressionsText, chosenAt: new Date() })
    .where(
      and(
        eq(arvPredictions.userId, user.id),
        eq(arvPredictions.createdDate, today),
        isNull(arvPredictions.choice),
      ),
    )
    .returning({ id: arvPredictions.id, revealDate: arvPredictions.revealDate });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nothing to choose (not started or already locked)" }, { status: 409 });
  }

  await db
    .insert(xpEvents)
    .values({ userId: user.id, source: "arv_prediction", amount: XP_ARV_PREDICTION });
  const [u] = await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${XP_ARV_PREDICTION}` })
    .where(eq(users.id, user.id))
    .returning({ xp: users.xp });
  await db.update(users).set({ level: levelForXp(u.xp) }).where(eq(users.id, user.id));

  return NextResponse.json({
    state: "locked",
    choice,
    revealDate: updated[0].revealDate,
    xpAwarded: XP_ARV_PREDICTION,
  });
}
