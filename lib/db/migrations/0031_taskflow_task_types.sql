CREATE TABLE "taskflow_task_type_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taskflow_task_type_definitions" ADD CONSTRAINT "taskflow_task_type_definitions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "taskflow_task_type_team_code_unique" ON "taskflow_task_type_definitions" USING btree ("team_id","code");
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD COLUMN "task_type" varchar(40) DEFAULT 'generic' NOT NULL;
