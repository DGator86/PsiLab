import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dailyStates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { utcDateString } from "@/lib/drill";

const SLEEP = ["poor", "ok", "good"] as const;
const CAFFEINE = ["none", "some", "lots"] as const;
const MOOD = ["low", "neutral", "high"] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }
  const db = getDb();
  const state = await db.query.dailyStates.findFirst({
    where: and(eq(dailyStates.userId, user.id), eq(dailyStates.date, utcDateString())),
  });
  return NextResponse.json({ state: state ?? null });
}

/** One-tap daily state tags. Upserts today's row so taps are forgiving. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sleep =
    typeof body.sleep === "string" && (SLEEP as readonly string[]).includes(body.sleep)
      ? body.sleep
      : null;
  const caffeine =
    typeof body.caffeine === "string" && (CAFFEINE as readonly string[]).includes(body.caffeine)
      ? body.caffeine
      : null;
  const mood =
    typeof body.mood === "string" && (MOOD as readonly string[]).includes(body.mood)
      ? body.mood
      : null;
  const meditated = body.meditated === true;

  const today = utcDateString();
  const db = getDb();
  const [saved] = await db
    .insert(dailyStates)
    .values({ userId: user.id, date: today, sleep, caffeine, mood, meditated })
    .onConflictDoUpdate({
      target: [dailyStates.userId, dailyStates.date],
      set: { sleep, caffeine, mood, meditated },
    })
    .returning();

  return NextResponse.json({ state: saved });
}
