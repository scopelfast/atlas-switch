-- E8.16 — ligação opcional Google Calendar por utilizador: refresh token cifrado; leitura de eventos.

CREATE TABLE IF NOT EXISTS "user_google_calendar_links" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "google_email" varchar(255),
  "encrypted_refresh_token" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
