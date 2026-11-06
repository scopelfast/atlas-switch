CREATE TABLE IF NOT EXISTS "taskflow_task_assignees" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taskflow_task_assignees" ADD CONSTRAINT "taskflow_task_assignees_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "taskflow_task_assignees" ADD CONSTRAINT "taskflow_task_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "taskflow_task_assignees_task_user_unique" ON "taskflow_task_assignees" ("task_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taskflow_task_assignees_task_id_idx" ON "taskflow_task_assignees" ("task_id");
--> statement-breakpoint
INSERT INTO "taskflow_task_assignees" ("task_id", "user_id", "position", "created_at")
SELECT "id", "assignee_id", 0, now()
FROM "taskflow_tasks"
WHERE "assignee_id" IS NOT NULL;
