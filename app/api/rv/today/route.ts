import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rvSessions, rvTargets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { utcDateString } from "@/lib/drill";
import { sessionCode } from "@/lib/rv";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }

  const today = utcDateString();
  const db = getDb();

  const session = await db.query.rvSessions.findFirst({
    where: and(eq(rvSessions.userId, user.id), eq(rvSessions.sessionDate, today)),
  });

  if (!session) {
    return NextResponse.json({
      state: "pending",
      code: sessionCode(user.id, today),
    });
  }

  const target = await db.query.rvTargets.findFirst({
    where: eq(rvTargets.id, session.targetId),
  });

  return NextResponse.json({
    state: session.selfScoreJson ? "scored" : "revealed",
    code: sessionCode(user.id, today),
    impressions: session.impressionsJson,
    confidence: session.confidence,
    selfScore: session.selfScoreJson,
    target: target
      ? { imageUrl: target.imageUrl, tags: target.attributeTagsJson }
      : null,
  });
}
