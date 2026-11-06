-- E8.17 — captação de reunião: ligação a gravação externa ou ficheiro carregado (sem ASR automático neste MVP).

CREATE TABLE IF NOT EXISTS "reunify_meeting_captures" (
  "id" serial PRIMARY KEY NOT NULL,
  "meeting_id" integer NOT NULL REFERENCES "public"."reunify_meetings"("id") ON DELETE CASCADE,
  "team_id" integer NOT NULL REFERENCES "public"."teams"("id") ON DELETE CASCADE,
  "kind" varchar(16) NOT NULL,
  "external_url" text,
  "stored_path" varchar(500),
  "original_name" varchar(255) NOT NULL,
  "mime_type" varchar(120),
  "size_bytes" integer NOT NULL DEFAULT 0,
  "created_by_id" integer REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "reunify_meeting_captures_kind_payload" CHECK (
    (
      "kind" = 'LINK'
      AND "external_url" IS NOT NULL
      AND trim("external_url") <> ''
      AND "stored_path" IS NULL
    )
    OR (
      "kind" = 'UPLOAD'
      AND "stored_path" IS NOT NULL
      AND trim("stored_path") <> ''
      AND "external_url" IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS "reunify_meeting_captures_meeting_id_idx" ON "reunify_meeting_captures" ("meeting_id");
CREATE INDEX IF NOT EXISTS "reunify_meeting_captures_team_id_idx" ON "reunify_meeting_captures" ("team_id");
