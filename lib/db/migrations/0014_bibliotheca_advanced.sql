ALTER TABLE "bibliotheca_documents" ADD COLUMN "project_id" integer;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD COLUMN "task_id" integer;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD COLUMN "created_by_id" integer;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD COLUMN "status" varchar(20) DEFAULT 'ATIVO' NOT NULL;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD COLUMN "visibility" varchar(20) DEFAULT 'EQUIPE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD COLUMN "tags" text;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD COLUMN "description" text;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD COLUMN "file_url" text;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD COLUMN "file_type" varchar(30);
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD COLUMN "source" varchar(30) DEFAULT 'UPLOAD';
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD CONSTRAINT "bibliotheca_documents_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD CONSTRAINT "bibliotheca_documents_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bibliotheca_documents" ADD CONSTRAINT "bibliotheca_documents_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
