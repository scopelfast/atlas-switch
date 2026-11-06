-- E8.9 — sprints leves (time) + hierarquia épico/subtarefa no mesmo quadro.
CREATE TABLE IF NOT EXISTS "taskflow_sprints" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL,
  "name" varchar(120) NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "taskflow_sprints_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "taskflow_sprints_team_id_idx" ON "taskflow_sprints" ("team_id");
CREATE INDEX IF NOT EXISTS "taskflow_sprints_team_start_idx" ON "taskflow_sprints" ("team_id", "start_at");

ALTER TABLE "taskflow_tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" integer;
ALTER TABLE "taskflow_tasks" ADD COLUMN IF NOT EXISTS "sprint_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'taskflow_tasks_parent_task_id_fk'
  ) THEN
    ALTER TABLE "taskflow_tasks"
      ADD CONSTRAINT "taskflow_tasks_parent_task_id_fk"
      FOREIGN KEY ("parent_task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'taskflow_tasks_sprint_id_fk'
  ) THEN
    ALTER TABLE "taskflow_tasks"
      ADD CONSTRAINT "taskflow_tasks_sprint_id_fk"
      FOREIGN KEY ("sprint_id") REFERENCES "public"."taskflow_sprints"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "taskflow_tasks_board_parent_idx" ON "taskflow_tasks" ("board_id", "parent_task_id");
CREATE INDEX IF NOT EXISTS "taskflow_tasks_sprint_id_idx" ON "taskflow_tasks" ("sprint_id") WHERE "sprint_id" IS NOT NULL;
