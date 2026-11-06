ALTER TABLE "chronos_agenda_items" RENAME COLUMN "time" TO "start_time";
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "end_time" varchar(10);
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "date" date DEFAULT CURRENT_DATE NOT NULL;
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "duration_minutes" integer;
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "description" text;
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "location" varchar(120);
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "reminder_minutes" integer;
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "recurrence" varchar(20);
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "timezone" varchar(64) DEFAULT 'America/Sao_Paulo';
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "source" varchar(20) DEFAULT 'MANUAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items" ADD COLUMN "status" varchar(20) DEFAULT 'AGENDADO' NOT NULL;
