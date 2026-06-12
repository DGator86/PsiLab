CREATE TABLE "drills" (
	"id" text PRIMARY KEY NOT NULL,
	"type" varchar(64) NOT NULL,
	"config_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"datetime" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"checklist_json" jsonb NOT NULL,
	"notes" text,
	"media_urls" jsonb NOT NULL,
	"anomalous_flag" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"duration" integer NOT NULL,
	"level" varchar(64) NOT NULL,
	"journal_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rv_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_id" text NOT NULL,
	"impressions_json" jsonb NOT NULL,
	"sketch_url" text,
	"confidence" integer,
	"self_score_json" jsonb,
	"revealed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rv_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"attribute_tags_json" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"drill_type" varchar(64) NOT NULL,
	"presented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answer" text NOT NULL,
	"commit_salt" text NOT NULL,
	"commit_hash" text NOT NULL,
	"guess" text,
	"correct" boolean,
	"confidence" integer,
	"latency_ms" integer,
	"guessed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"streak_freeze_available" boolean DEFAULT true NOT NULL,
	"last_completed_date" date,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" varchar(64) DEFAULT 'Novice' NOT NULL,
	"plan" varchar(32) DEFAULT 'free' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" varchar(64) NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "field_logs" ADD CONSTRAINT "field_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rv_sessions" ADD CONSTRAINT "rv_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rv_sessions" ADD CONSTRAINT "rv_sessions_target_id_rv_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."rv_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trials" ADD CONSTRAINT "trials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_logs_user_idx" ON "field_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "focus_sessions_user_idx" ON "focus_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rv_sessions_user_idx" ON "rv_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trials_user_presented_idx" ON "trials" USING btree ("user_id","presented_at");--> statement-breakpoint
CREATE INDEX "trials_user_guessed_idx" ON "trials" USING btree ("user_id","guessed_at");--> statement-breakpoint
CREATE INDEX "xp_events_user_idx" ON "xp_events" USING btree ("user_id","created_at");