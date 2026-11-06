CREATE TABLE IF NOT EXISTS "taskflow_interventions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"reported_status" varchar(200),
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "taskflow_interventions" ADD CONSTRAINT "taskflow_interventions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "taskflow_interventions" ADD CONSTRAINT "taskflow_interventions_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "taskflow_interventions" ADD CONSTRAINT "taskflow_interventions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "taskflow_interventions_user_open_unique" ON "taskflow_interventions" ("user_id") WHERE "ended_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taskflow_interventions_task_id_idx" ON "taskflow_interventions" ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taskflow_interventions_team_started_idx" ON "taskflow_interventions" ("team_id", "started_at");
