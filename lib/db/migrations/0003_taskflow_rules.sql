CREATE TABLE "taskflow_automation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"auto_assign_creator" boolean DEFAULT false NOT NULL,
	"auto_high_priority_on_due" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taskflow_automation_rules" ADD CONSTRAINT "taskflow_automation_rules_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
