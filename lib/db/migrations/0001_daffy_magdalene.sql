CREATE TABLE "taskflow_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskflow_columns" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskflow_labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"name" varchar(60) NOT NULL,
	"color" varchar(20) DEFAULT 'slate' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskflow_task_labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"label_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskflow_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"column_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"priority" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp,
	"assignee_id" integer,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "taskflow_boards" ADD CONSTRAINT "taskflow_boards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskflow_columns" ADD CONSTRAINT "taskflow_columns_board_id_taskflow_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."taskflow_boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskflow_labels" ADD CONSTRAINT "taskflow_labels_board_id_taskflow_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."taskflow_boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskflow_task_labels" ADD CONSTRAINT "taskflow_task_labels_task_id_taskflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."taskflow_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskflow_task_labels" ADD CONSTRAINT "taskflow_task_labels_label_id_taskflow_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."taskflow_labels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD CONSTRAINT "taskflow_tasks_board_id_taskflow_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."taskflow_boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD CONSTRAINT "taskflow_tasks_column_id_taskflow_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."taskflow_columns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD CONSTRAINT "taskflow_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD CONSTRAINT "taskflow_tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;