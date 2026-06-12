ALTER TABLE "focus_sessions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rv_sessions" ADD COLUMN "session_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "rv_sessions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rv_sessions_user_day_idx" ON "rv_sessions" USING btree ("user_id","session_date");