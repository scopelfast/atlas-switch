CREATE TABLE IF NOT EXISTS "taskflow_task_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"uploaded_by_id" integer,
	"file_name_on_disk" varchar(200) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(120),
	"size_bytes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taskflow_task_attachments" ADD CONSTRAINT "taskflow_task_attachments_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "taskflow_task_attachments" ADD CONSTRAINT "taskflow_task_attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taskflow_task_attachments_task_id_idx" ON "taskflow_task_attachments" ("task_id");
