import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { fieldLogs, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { XP_SKYWATCH_LOG, levelForXp } from "@/lib/drill";
import { getCurrentKp } from "@/lib/kp";
import {
  DURATION_OPTIONS,
  MUNDANE_CHECKLIST,
  WEATHER_OPTIONS,
  skywatchLine,
} from "@/lib/skywatch";
import { checkAchievements } from "@/lib/awards";

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

  const location = typeof body.location === "string" ? body.location.slice(0, 200).trim() : "";
  if (!location) {
    return NextResponse.json({ error: "Location is required" }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 4000) : "";
  const weather =
    typeof body.weather === "string" && (WEATHER_OPTIONS as readonly string[]).includes(body.weather)
      ? body.weather
      : null;
  const groupSize =
    typeof body.groupSize === "number" ? Math.min(99, Math.max(1, Math.round(body.groupSize))) : 1;
  const durationMin =
    typeof body.durationMin === "number" && (DURATION_OPTIONS as readonly number[]).includes(body.durationMin)
      ? body.durationMin
      : 30;

  const rawChecklist = (body.checklist ?? {}) as Record<string, unknown>;
  const checklist: Record<string, boolean> = {};
  for (const item of MUNDANE_CHECKLIST) {
    checklist[item.id] = rawChecklist[item.id] === true;
  }
  const checklistComplete = MUNDANE_CHECKLIST.every((item) => checklist[item.id]);

  // The anomalous flag only unlocks once the full mundane checklist is done.
  const anomalousFlag = body.anomalous === true && checklistComplete;
  if (body.anomalous === true && !checklistComplete) {
    return NextResponse.json(
      { error: "Complete the mundane checklist before flagging anything anomalous" },
      { status: 400 },
    );
  }

  const kp = await getCurrentKp();
  const db = getDb();
  await db.insert(fieldLogs).values({
    userId: user.id,
    datetime: new Date(),
    location,
    checklistJson: { checklist, checklistComplete, weather, groupSize, durationMin, kp },
    notes,
    mediaUrls: [],
    anomalousFlag,
  });

  await db
    .insert(xpEvents)
    .values({ userId: user.id, source: "skywatch_log", amount: XP_SKYWATCH_LOG });
  const [u] = await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${XP_SKYWATCH_LOG}` })
    .where(eq(users.id, user.id))
    .returning({ xp: users.xp });
  await db.update(users).set({ level: levelForXp(u.xp) }).where(eq(users.id, user.id));

  const newAchievements = await checkAchievements(user.id);

  return NextResponse.json({
    logged: true,
    anomalousFlag,
    xpAwarded: XP_SKYWATCH_LOG,
    mascotLine: skywatchLine(),
    newAchievements,
  });
}
