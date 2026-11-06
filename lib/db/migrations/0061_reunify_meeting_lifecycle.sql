ALTER TABLE "reunify_meetings"
ADD COLUMN IF NOT EXISTS "cancel_reason" text;
--> statement-breakpoint
ALTER TABLE "reunify_meetings"
ADD COLUMN IF NOT EXISTS "canceled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "reunify_meetings"
ADD COLUMN IF NOT EXISTS "canceled_by_user_id" integer;
--> statement-breakpoint
ALTER TABLE "reunify_meetings"
ADD COLUMN IF NOT EXISTS "rescheduled_from_meeting_id" integer;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reunify_meetings_canceled_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "reunify_meetings"
    ADD CONSTRAINT "reunify_meetings_canceled_by_user_id_users_id_fk"
    FOREIGN KEY ("canceled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reunify_meetings_rescheduled_from_meeting_id_reunify_meetings_id_fk'
  ) THEN
    ALTER TABLE "reunify_meetings"
    ADD CONSTRAINT "reunify_meetings_rescheduled_from_meeting_id_reunify_meetings_id_fk"
    FOREIGN KEY ("rescheduled_from_meeting_id") REFERENCES "public"."reunify_meetings"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
