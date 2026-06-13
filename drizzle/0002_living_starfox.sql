CREATE TABLE "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" varchar(64) NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arv_predictions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_date" date NOT NULL,
	"reveal_date" date NOT NULL,
	"outcome" text NOT NULL,
	"commit_salt" text NOT NULL,
	"commit_hash" text NOT NULL,
	"target_a_id" text NOT NULL,
	"target_b_id" text NOT NULL,
	"impressions_text" text,
	"choice" text,
	"chosen_at" timestamp with time zone,
	"correct" boolean,
	"revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_states" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"sleep" varchar(16),
	"caffeine" varchar(16),
	"mood" varchar(16),
	"meditated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pk_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"intention" varchar(16) NOT NULL,
	"bits_total" integer NOT NULL,
	"ones_total" integer NOT NULL,
	"z_score" real NOT NULL,
	"rounds_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preregistrations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"drill_type" varchar(64) NOT NULL,
	"n_committed" integer NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "rv_sessions_user_day_idx";--> statement-breakpoint
ALTER TABLE "rv_sessions" ADD COLUMN "mode" varchar(32) DEFAULT 'rv' NOT NULL;--> statement-breakpoint
ALTER TABLE "rv_sessions" ADD COLUMN "decoy_ids_json" jsonb;--> statement-breakpoint
ALTER TABLE "rv_sessions" ADD COLUMN "judged_target_id" text;--> statement-breakpoint
ALTER TABLE "rv_sessions" ADD COLUMN "judge_correct" boolean;--> statement-breakpoint
ALTER TABLE "rv_sessions" ADD COLUMN "judged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rv_targets" ADD COLUMN "kind" varchar(32) DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "trials" ADD COLUMN "kp" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mascot" varchar(32) DEFAULT 'nox' NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arv_predictions" ADD CONSTRAINT "arv_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arv_predictions" ADD CONSTRAINT "arv_predictions_target_a_id_rv_targets_id_fk" FOREIGN KEY ("target_a_id") REFERENCES "public"."rv_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arv_predictions" ADD CONSTRAINT "arv_predictions_target_b_id_rv_targets_id_fk" FOREIGN KEY ("target_b_id") REFERENCES "public"."rv_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_states" ADD CONSTRAINT "daily_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pk_sessions" ADD CONSTRAINT "pk_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preregistrations" ADD CONSTRAINT "preregistrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_user_key_idx" ON "achievements" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "arv_user_idx" ON "arv_predictions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "arv_user_day_idx" ON "arv_predictions" USING btree ("user_id","created_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_states_user_day_idx" ON "daily_states" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "pk_sessions_user_idx" ON "pk_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "prereg_user_idx" ON "preregistrations" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "rv_sessions_user_day_mode_idx" ON "rv_sessions" USING btree ("user_id","session_date","mode");