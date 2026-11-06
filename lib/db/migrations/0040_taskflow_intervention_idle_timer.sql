ALTER TABLE "taskflow_interventions" ADD COLUMN IF NOT EXISTS "next_idle_ping_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "taskflow_interventions" ADD COLUMN IF NOT EXISTS "idle_response_deadline_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "taskflow_interventions"
SET "next_idle_ping_at" = "started_at" + interval '2 hours'
WHERE "source" = 'TIMER' AND "ended_at" IS NULL AND "next_idle_ping_at" IS NULL;
