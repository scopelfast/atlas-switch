CREATE TABLE "resourcehub_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'DISPONIVEL' NOT NULL,
	"capacity_hours_per_week" integer DEFAULT 40 NOT NULL,
	"cost_rate_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resourcehub_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resourcehub_resource_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	"level" integer DEFAULT 3 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resourcehub_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"project_id" integer,
	"task_id" integer,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"hours_per_week" integer DEFAULT 8 NOT NULL,
	"status" varchar(20) DEFAULT 'ATIVO' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resourcehub_resources" ADD CONSTRAINT "resourcehub_resources_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resourcehub_resource_skills" ADD CONSTRAINT "resourcehub_resource_skills_resource_id_resourcehub_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resourcehub_resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resourcehub_resource_skills" ADD CONSTRAINT "resourcehub_resource_skills_skill_id_resourcehub_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."resourcehub_skills"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resourcehub_allocations" ADD CONSTRAINT "resourcehub_allocations_resource_id_resourcehub_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resourcehub_resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resourcehub_allocations" ADD CONSTRAINT "resourcehub_allocations_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resourcehub_allocations" ADD CONSTRAINT "resourcehub_allocations_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE set null ON UPDATE no action;
