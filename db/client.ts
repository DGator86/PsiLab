import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: NeonHttpDatabase<typeof schema> | null = null;

// Lazy init so the module can be imported (e.g. during `next build`)
// without DATABASE_URL being set.
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!cached) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    cached = drizzle(neon(databaseUrl), { schema });
  }
  return cached;
}
