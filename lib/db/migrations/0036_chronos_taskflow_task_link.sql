ALTER TABLE "chronos_agenda_items" ADD COLUMN IF NOT EXISTS "taskflow_task_id" integer;
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN IF NOT EXISTS "taskflow_reminder_offsets" varchar(80);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chronos_agenda_items" ADD CONSTRAINT "chronos_agenda_items_taskflow_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("taskflow_task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chronos_agenda_items_team_taskflow_task_unique" ON "chronos_agenda_items" ("team_id", "taskflow_task_id") WHERE "taskflow_task_id" IS NOT NULL;
