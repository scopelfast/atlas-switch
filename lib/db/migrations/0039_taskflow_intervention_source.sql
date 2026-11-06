ALTER TABLE "taskflow_interventions" ADD COLUMN IF NOT EXISTS "source" varchar(16) NOT NULL DEFAULT 'TIMER';
--> statement-breakpoint
DROP INDEX IF EXISTS "taskflow_interventions_user_open_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "taskflow_interventions_user_timer_open_unique" ON "taskflow_interventions" ("user_id") WHERE "ended_at" IS NULL AND "source" = 'TIMER';
