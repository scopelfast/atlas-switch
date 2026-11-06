ALTER TABLE "chronos_agenda_items"
ADD COLUMN IF NOT EXISTS "participant_user_id" integer;
--> statement-breakpoint
ALTER TABLE "chronos_agenda_items"
ADD CONSTRAINT "chronos_agenda_items_participant_user_id_users_id_fk"
FOREIGN KEY ("participant_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "chronos_agenda_items_team_reunify_meeting_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chronos_agenda_items_team_reunify_meeting_unique"
ON "chronos_agenda_items" USING btree ("team_id","reunify_meeting_id")
WHERE ("reunify_meeting_id" is not null and "participant_user_id" is null);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chronos_agenda_items_team_reunify_meeting_participant_unique"
ON "chronos_agenda_items" USING btree ("team_id","reunify_meeting_id","participant_user_id")
WHERE ("reunify_meeting_id" is not null and "participant_user_id" is not null);
