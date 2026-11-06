CREATE TABLE "saas_customer_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"health_score" integer DEFAULT 70 NOT NULL,
	"churn_risk" varchar(20) DEFAULT 'MEDIO' NOT NULL,
	"last_activity_at" timestamp,
	"usage_score" integer DEFAULT 0 NOT NULL,
	"plan_fit_score" integer DEFAULT 0 NOT NULL,
	"support_score" integer DEFAULT 0 NOT NULL,
	"recommendation" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_customer_health" ADD CONSTRAINT "saas_customer_health_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
