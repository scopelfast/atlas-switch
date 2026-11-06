CREATE TABLE "taskflow_task_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"from_column_id" integer,
	"to_column_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taskflow_task_events" ADD CONSTRAINT "taskflow_task_events_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE no action ON UPDATE no action;
