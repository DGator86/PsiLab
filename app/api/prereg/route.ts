import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { preregistrations, trials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { DRILLS, isDrillType } from "@/lib/drill";
import { binomialTwoSidedP, sprtVerdict } from "@/lib/stats";

const ALLOWED_N = [50, 100, 200, 500];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }
  const db = getDb();
  const rows = await db.query.preregistrations.findMany({
    where: eq(preregistrations.userId, user.id),
    orderBy: (t, { desc }) => [desc(t.startedAt)],
    limit: 10,
  });

  const enriched = [];
  for (const p of rows) {
    if (!isDrillType(p.drillType)) continue;
    const chance = DRILLS[p.drillType].chance;
    const stats = await db
      .select({ n: count() })
      .from(trials)
      .where(
        and(
          eq(trials.userId, user.id),
          eq(trials.drillType, p.drillType),
          isNotNull(trials.guessedAt),
          gte(trials.guessedAt, p.startedAt),
        ),
      );
    const hitRows = await db
      .select({ n: count() })
      .from(trials)
      .where(
        and(
          eq(trials.userId, user.id),
          eq(trials.drillType, p.drillType),
          eq(trials.correct, true),
          gte(trials.guessedAt, p.startedAt),
        ),
      );
    const done = Math.min(Number(stats[0]?.n ?? 0), p.nCommitted);
    const hits = Math.min(Number(hitRows[0]?.n ?? 0), done);
    enriched.push({
      id: p.id,
      drillType: p.drillType,
      nCommitted: p.nCommitted,
      status: p.status,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
      progress: done,
      hits,
      chance,
      pValue: done > 0 ? binomialTwoSidedP(hits, done, chance) : null,
      sprt: sprtVerdict(hits, done, chance),
    });
  }

  return NextResponse.json({ preregistrations: enriched });
}

/** Commit to N trials of a drill before seeing the outcome. One active per drill. */
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
  const drillType = typeof body.drillType === "string" ? body.drillType : "";
  const n = typeof body.n === "number" ? body.n : 0;
  if (!isDrillType(drillType) || !ALLOWED_N.includes(n)) {
    return NextResponse.json(
      { error: `Invalid preregistration (n must be one of ${ALLOWED_N.join(", ")})` },
      { status: 400 },
    );
  }

  const db = getDb();
  const active = await db.query.preregistrations.findFirst({
    where: and(
      eq(preregistrations.userId, user.id),
      eq(preregistrations.drillType, drillType),
      eq(preregistrations.status, "active"),
    ),
  });
  if (active) {
    return NextResponse.json(
      { error: "You already have an active preregistration for this drill" },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(preregistrations)
    .values({ userId: user.id, drillType, nCommitted: n })
    .returning();

  return NextResponse.json({ preregistration: created });
}
