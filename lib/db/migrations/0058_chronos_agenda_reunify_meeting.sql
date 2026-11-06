-- Ligação opcional Chronos ↔ Reunify: um compromisso por reunião por time (evita duplicar ao clicar várias vezes).
ALTER TABLE "chronos_agenda_items"
  ADD COLUMN IF NOT EXISTS "reunify_meeting_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chronos_agenda_items_reunify_meeting_id_reunify_meetings_id_fk'
  ) THEN
    ALTER TABLE "chronos_agenda_items"
      ADD CONSTRAINT "chronos_agenda_items_reunify_meeting_id_reunify_meetings_id_fk"
      FOREIGN KEY ("reunify_meeting_id") REFERENCES "public"."reunify_meetings"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "chronos_agenda_items_team_reunify_meeting_unique"
  ON "chronos_agenda_items" ("team_id", "reunify_meeting_id")
  WHERE "reunify_meeting_id" IS NOT NULL;
