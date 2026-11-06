ALTER TABLE "taskflow_tasks" ADD COLUMN "planned_start_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD COLUMN "estimated_duration_hours" real;
