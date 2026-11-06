-- E8.12 — ligação opcional Microsoft 365 (Graph) por utilizador: refresh token cifrado; leitura de calendário.

CREATE TABLE IF NOT EXISTS "user_microsoft_graph_links" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "graph_email" varchar(255),
  "encrypted_refresh_token" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
