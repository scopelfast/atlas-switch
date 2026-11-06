ALTER TABLE "taskflow_tasks" ADD COLUMN IF NOT EXISTS "recurrence_rule" varchar(16);
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD COLUMN IF NOT EXISTS "recurrence_series_key" varchar(40);
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD COLUMN IF NOT EXISTS "recurrence_occurrence_key" varchar(40);
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD COLUMN IF NOT EXISTS "recurrence_until" timestamptz;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "taskflow_tasks_recurrence_instance_unique" ON "taskflow_tasks" ("recurrence_series_key", "recurrence_occurrence_key") WHERE "recurrence_occurrence_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taskflow_tasks_recurrence_series_idx" ON "taskflow_tasks" ("recurrence_series_key") WHERE "recurrence_series_key" IS NOT NULL;
