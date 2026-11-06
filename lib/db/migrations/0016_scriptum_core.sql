CREATE TABLE "scriptum_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"created_by_id" integer,
	"document_id" integer,
	"note_id" integer,
	"title" varchar(200) NOT NULL,
	"type" varchar(40) DEFAULT 'ARTIGO' NOT NULL,
	"status" varchar(20) DEFAULT 'RASCUNHO' NOT NULL,
	"goal_words" integer DEFAULT 1000 NOT NULL,
	"current_words" integer DEFAULT 0 NOT NULL,
	"due_date" date,
	"summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scriptum_chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'EM_PROGRESSO' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"content" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scriptum_projects" ADD CONSTRAINT "scriptum_projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scriptum_projects" ADD CONSTRAINT "scriptum_projects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scriptum_projects" ADD CONSTRAINT "scriptum_projects_document_id_bibliotheca_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."bibliotheca_documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scriptum_projects" ADD CONSTRAINT "scriptum_projects_note_id_notepad_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notepad_notes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scriptum_chapters" ADD CONSTRAINT "scriptum_chapters_project_id_scriptum_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."scriptum_projects"("id") ON DELETE cascade ON UPDATE no action;
