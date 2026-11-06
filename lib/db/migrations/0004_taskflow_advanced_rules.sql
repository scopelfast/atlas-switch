CREATE TABLE "taskflow_advanced_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"due_in_days" integer,
	"priority_equals" varchar(20),
	"assignee_missing" boolean DEFAULT false NOT NULL,
	"action_set_priority" varchar(20),
	"action_assign_creator" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taskflow_advanced_rules" ADD CONSTRAINT "taskflow_advanced_rules_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
