CREATE TABLE "saas_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"billing_interval" varchar(20) DEFAULT 'MONTHLY' NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_storage_gb" integer DEFAULT 50 NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_plan_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"module_key" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'ATIVO' NOT NULL,
	"negotiated_price_cents" integer,
	"billing_cycle_day" integer DEFAULT 5 NOT NULL,
	"next_invoice_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"actor_user_id" integer,
	"module" varchar(50) NOT NULL,
	"action" varchar(120) NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_plan_modules" ADD CONSTRAINT "saas_plan_modules_plan_id_saas_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."saas_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_plans" ADD CONSTRAINT "team_plans_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_plans" ADD CONSTRAINT "team_plans_plan_id_saas_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."saas_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
