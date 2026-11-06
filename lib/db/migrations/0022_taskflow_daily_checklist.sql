CREATE TABLE IF NOT EXISTS "taskflow_daily_checklist" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "task_id" integer NOT NULL,
  "checklist_date" date NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "checked" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "taskflow_daily_checklist" ADD CONSTRAINT "taskflow_daily_checklist_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "taskflow_daily_checklist" ADD CONSTRAINT "taskflow_daily_checklist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "taskflow_daily_checklist" ADD CONSTRAINT "taskflow_daily_checklist_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE cascade ON UPDATE no action;
