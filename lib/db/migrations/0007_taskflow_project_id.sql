ALTER TABLE "taskflow_tasks" ADD COLUMN "project_id" integer;
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD CONSTRAINT "taskflow_tasks_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE set null ON UPDATE no action;
