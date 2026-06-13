import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { MASCOTS, isMascotId } from "@/lib/mascot";

/** Mascot packs are the Pro seam: Nox is free, the others need a paid plan. */
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
  const mascot = typeof body.mascot === "string" ? body.mascot : "";
  if (!isMascotId(mascot)) {
    return NextResponse.json({ error: "Unknown mascot" }, { status: 400 });
  }
  if (MASCOTS[mascot].pro && user.plan === "free") {
    return NextResponse.json(
      { error: `${MASCOTS[mascot].name} is part of a Pro pack. The seam exists; the payments don't yet.` },
      { status: 402 },
    );
  }

  const db = getDb();
  await db.update(users).set({ mascot }).where(eq(users.id, user.id));
  return NextResponse.json({ mascot });
}
