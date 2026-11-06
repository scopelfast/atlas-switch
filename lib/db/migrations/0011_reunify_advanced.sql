ALTER TABLE "reunify_meetings" RENAME COLUMN "time" TO "start_time";
--> statement-breakpoint
ALTER TABLE "reunify_meetings" ADD COLUMN "date" date DEFAULT CURRENT_DATE NOT NULL;
--> statement-breakpoint
ALTER TABLE "reunify_meetings" ADD COLUMN "end_time" varchar(10);
--> statement-breakpoint
ALTER TABLE "reunify_meetings" ADD COLUMN "duration_minutes" integer;
--> statement-breakpoint
ALTER TABLE "reunify_meetings" ADD COLUMN "location" varchar(120);
--> statement-breakpoint
ALTER TABLE "reunify_meetings" ADD COLUMN "summary" text;
--> statement-breakpoint
CREATE TABLE "reunify_agenda_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"owner" varchar(120),
	"duration_minutes" integer,
	"status" varchar(20) DEFAULT 'ABERTO' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reunify_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"owner" varchar(120),
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reunify_action_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"owner_id" integer,
	"due_date" date,
	"status" varchar(20) DEFAULT 'ABERTO' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reunify_agenda_items" ADD CONSTRAINT "reunify_agenda_items_meeting_id_reunify_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."reunify_meetings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reunify_decisions" ADD CONSTRAINT "reunify_decisions_meeting_id_reunify_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."reunify_meetings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reunify_action_items" ADD CONSTRAINT "reunify_action_items_meeting_id_reunify_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."reunify_meetings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reunify_action_items" ADD CONSTRAINT "reunify_action_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
