ALTER TABLE "reunify_action_items" ADD COLUMN IF NOT EXISTS "taskflow_task_id" integer;
DO $$
BEGIN
  ALTER TABLE "reunify_action_items"
    ADD CONSTRAINT "reunify_action_items_taskflow_task_id_fkey"
    FOREIGN KEY ("taskflow_task_id") REFERENCES "taskflow_tasks"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "reunify_action_items_taskflow_task_id_unique"
  ON "reunify_action_items" ("taskflow_task_id")
  WHERE "taskflow_task_id" IS NOT NULL;
