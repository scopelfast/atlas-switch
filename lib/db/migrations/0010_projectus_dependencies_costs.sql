ALTER TABLE "projectus_projects" ADD COLUMN "budget_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "projectus_task_dependencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"depends_on_task_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectus_cost_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"phase_id" integer,
	"task_id" integer,
	"type" varchar(20) DEFAULT 'PLANEJADO' NOT NULL,
	"category" varchar(80) NOT NULL,
	"amount_cents" integer NOT NULL,
	"incurred_at" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projectus_task_dependencies" ADD CONSTRAINT "projectus_task_dependencies_task_id_projectus_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."projectus_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_task_dependencies" ADD CONSTRAINT "projectus_task_dependencies_depends_on_task_id_projectus_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."projectus_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_cost_items" ADD CONSTRAINT "projectus_cost_items_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_cost_items" ADD CONSTRAINT "projectus_cost_items_phase_id_projectus_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."projectus_phases"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_cost_items" ADD CONSTRAINT "projectus_cost_items_task_id_projectus_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."projectus_tasks"("id") ON DELETE set null ON UPDATE no action;
