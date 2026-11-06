CREATE TABLE "notepad_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"created_by_id" integer,
	"project_id" integer,
	"task_id" integer,
	"document_id" integer,
	"title" varchar(200) NOT NULL,
	"content" text,
	"folder" varchar(120) DEFAULT 'Geral' NOT NULL,
	"tags" text,
	"status" varchar(20) DEFAULT 'ATIVA' NOT NULL,
	"visibility" varchar(20) DEFAULT 'EQUIPE' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"source" varchar(30) DEFAULT 'MANUAL',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notepad_notes" ADD CONSTRAINT "notepad_notes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notepad_notes" ADD CONSTRAINT "notepad_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notepad_notes" ADD CONSTRAINT "notepad_notes_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notepad_notes" ADD CONSTRAINT "notepad_notes_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notepad_notes" ADD CONSTRAINT "notepad_notes_document_id_bibliotheca_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."bibliotheca_documents"("id") ON DELETE set null ON UPDATE no action;
