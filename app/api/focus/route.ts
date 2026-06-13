import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { focusSessions, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { XP_FOCUS_PER_SESSION, levelForXp } from "@/lib/drill";
import { FOCUS_MOODS, FOCUS_SENSATIONS, focusLine, isFocusLevel } from "@/lib/focus";
import { maybeAwardDailyQuest } from "@/lib/awards";

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

  const duration = typeof body.duration === "number" ? Math.round(body.duration) : 0;
  const level = typeof body.level === "string" ? body.level : "";
  if (duration < 1 || duration > 120 || !isFocusLevel(level)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const journal = (body.journal ?? {}) as Record<string, unknown>;
  const sensations = Array.isArray(journal.sensations)
    ? journal.sensations.filter(
        (s): s is string => typeof s === "string" && (FOCUS_SENSATIONS as readonly string[]).includes(s),
      )
    : [];
  const mood =
    typeof journal.mood === "string" && (FOCUS_MOODS as readonly string[]).includes(journal.mood)
      ? journal.mood
      : null;
  const notes = typeof journal.notes === "string" ? journal.notes.slice(0, 2000) : "";

  const db = getDb();
  await db.insert(focusSessions).values({
    userId: user.id,
    duration,
    level,
    journalJson: { sensations, mood, notes },
  });

  await db
    .insert(xpEvents)
    .values({ userId: user.id, source: "focus_session", amount: XP_FOCUS_PER_SESSION });
  const [updatedUser] = await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${XP_FOCUS_PER_SESSION}` })
    .where(eq(users.id, user.id))
    .returning({ xp: users.xp });
  await db
    .update(users)
    .set({ level: levelForXp(updatedUser.xp) })
    .where(eq(users.id, user.id));

  const questXp = await maybeAwardDailyQuest(user.id);

  return NextResponse.json({
    xpAwarded: XP_FOCUS_PER_SESSION,
    totalXp: updatedUser.xp,
    level: levelForXp(updatedUser.xp),
    mascotLine: focusLine(),
    questXp,
  });
}
