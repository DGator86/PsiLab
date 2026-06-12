import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { USER_COOKIE } from "@/lib/auth-cookie";

export type User = typeof users.$inferSelect;

/**
 * Returns the current user, creating the row on first contact.
 * Identity comes from the anonymous cookie set by the middleware.
 */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const id = store.get(USER_COOKIE)?.value;
  if (!id) return null;

  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (existing) return existing;

  await db.insert(users).values({ id }).onConflictDoNothing();
  return (await db.query.users.findFirst({ where: eq(users.id, id) })) ?? null;
}
