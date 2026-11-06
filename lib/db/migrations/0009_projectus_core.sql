CREATE TABLE "projectus_phases" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"start_date" date,
	"end_date" date,
	"status" varchar(20) DEFAULT 'PLANEJADA' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectus_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"phase_id" integer,
	"title" varchar(200) NOT NULL,
	"description" text,
	"assignee_id" integer,
	"status" varchar(20) DEFAULT 'ABERTA' NOT NULL,
	"priority" varchar(20) DEFAULT 'MEDIA' NOT NULL,
	"start_date" date,
	"due_date" date,
	"effort_hours" integer,
	"progress" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectus_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"due_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'ABERTO' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectus_risks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"probability" integer DEFAULT 3 NOT NULL,
	"impact" integer DEFAULT 3 NOT NULL,
	"status" varchar(20) DEFAULT 'ABERTO' NOT NULL,
	"mitigation" text,
	"owner_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projectus_phases" ADD CONSTRAINT "projectus_phases_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_tasks" ADD CONSTRAINT "projectus_tasks_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_tasks" ADD CONSTRAINT "projectus_tasks_phase_id_projectus_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."projectus_phases"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_tasks" ADD CONSTRAINT "projectus_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_milestones" ADD CONSTRAINT "projectus_milestones_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_risks" ADD CONSTRAINT "projectus_risks_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projectus_risks" ADD CONSTRAINT "projectus_risks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
