import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const uuid = () => crypto.randomUUID();

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(uuid),
  // Nullable: anonymous (cookie-based) users have no email until they link one.
  email: varchar("email", { length: 255 }).unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  streakCount: integer("streak_count").default(0).notNull(),
  streakFreezeAvailable: boolean("streak_freeze_available").default(true).notNull(),
  // Last calendar day (UTC) the user completed the daily session; drives streak logic.
  lastCompletedDate: date("last_completed_date"),
  xp: integer("xp").default(0).notNull(),
  level: varchar("level", { length: 64 }).default("Novice").notNull(),
  plan: varchar("plan", { length: 32 }).default("free").notNull(),
});

export const drills = pgTable("drills", {
  id: text("id").primaryKey().$defaultFn(uuid),
  type: varchar("type", { length: 64 }).notNull(),
  configJson: jsonb("config_json").notNull(),
});

export const trials = pgTable(
  "trials",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    drillType: varchar("drill_type", { length: 64 }).notNull(),
    presentedAt: timestamp("presented_at", { withTimezone: true }).defaultNow().notNull(),
    // Commit-reveal: the answer is chosen and committed server-side before the guess.
    // commitHash = sha256(`${answer}:${commitSalt}`) is sent to the client up front;
    // answer + salt are revealed after the guess so the client can verify.
    answer: text("answer").notNull(),
    commitSalt: text("commit_salt").notNull(),
    commitHash: text("commit_hash").notNull(),
    guess: text("guess"),
    correct: boolean("correct"),
    confidence: integer("confidence"),
    latencyMs: integer("latency_ms"),
    guessedAt: timestamp("guessed_at", { withTimezone: true }),
  },
  (t) => [
    index("trials_user_presented_idx").on(t.userId, t.presentedAt),
    index("trials_user_guessed_idx").on(t.userId, t.guessedAt),
  ],
);

export const rvTargets = pgTable("rv_targets", {
  id: text("id").primaryKey().$defaultFn(uuid),
  imageUrl: text("image_url").notNull(),
  attributeTagsJson: jsonb("attribute_tags_json").notNull(),
  active: boolean("active").default(true).notNull(),
});

export const rvSessions = pgTable(
  "rv_sessions",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    targetId: text("target_id")
      .notNull()
      .references(() => rvTargets.id),
    // One daily target per user (UTC).
    sessionDate: date("session_date").notNull(),
    impressionsJson: jsonb("impressions_json").notNull(),
    sketchUrl: text("sketch_url"),
    confidence: integer("confidence"),
    selfScoreJson: jsonb("self_score_json"),
    revealedAt: timestamp("revealed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("rv_sessions_user_idx").on(t.userId),
    uniqueIndex("rv_sessions_user_day_idx").on(t.userId, t.sessionDate),
  ],
);

export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    duration: integer("duration").notNull(),
    level: varchar("level", { length: 64 }).notNull(),
    journalJson: jsonb("journal_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("focus_sessions_user_idx").on(t.userId)],
);

export const fieldLogs = pgTable(
  "field_logs",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    datetime: timestamp("datetime", { withTimezone: true }).notNull(),
    location: text("location").notNull(),
    checklistJson: jsonb("checklist_json").notNull(),
    notes: text("notes"),
    mediaUrls: jsonb("media_urls").notNull(),
    anomalousFlag: boolean("anomalous_flag").default(false).notNull(),
  },
  (t) => [index("field_logs_user_idx").on(t.userId)],
);

export const xpEvents = pgTable(
  "xp_events",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    source: varchar("source", { length: 64 }).notNull(),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("xp_events_user_idx").on(t.userId, t.createdAt)],
);
