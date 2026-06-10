import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  streakCount: integer("streak_count").default(0).notNull(),
  streakFreezeAvailable: boolean("streak_freeze_available").default(true).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: varchar("level", { length: 64 }).default("Novice").notNull(),
  plan: varchar("plan", { length: 32 }).default("free").notNull(),
});

export const drills = pgTable("drills", {
  id: text("id").primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  configJson: jsonb("config_json").notNull(),
});

export const trials = pgTable("trials", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  drillType: varchar("drill_type", { length: 64 }).notNull(),
  presentedAt: timestamp("presented_at", { withTimezone: true }).defaultNow().notNull(),
  guess: text("guess").notNull(),
  answer: text("answer").notNull(),
  correct: boolean("correct").notNull(),
  confidence: integer("confidence"),
  latencyMs: integer("latency_ms"),
});

export const rvTargets = pgTable("rv_targets", {
  id: text("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  attributeTagsJson: jsonb("attribute_tags_json").notNull(),
  active: boolean("active").default(true).notNull(),
});

export const rvSessions = pgTable("rv_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  targetId: text("target_id").notNull(),
  impressionsJson: jsonb("impressions_json").notNull(),
  sketchUrl: text("sketch_url"),
  confidence: integer("confidence"),
  selfScoreJson: jsonb("self_score_json"),
  revealedAt: timestamp("revealed_at", { withTimezone: true }),
});

export const focusSessions = pgTable("focus_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  duration: integer("duration").notNull(),
  level: varchar("level", { length: 64 }).notNull(),
  journalJson: jsonb("journal_json").notNull(),
});

export const fieldLogs = pgTable("field_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  datetime: timestamp("datetime", { withTimezone: true }).notNull(),
  location: text("location").notNull(),
  checklistJson: jsonb("checklist_json").notNull(),
  notes: text("notes"),
  mediaUrls: jsonb("media_urls").notNull(),
  anomalousFlag: boolean("anomalous_flag").default(false).notNull(),
});

export const xpEvents = pgTable("xp_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
