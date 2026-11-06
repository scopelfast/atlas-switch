-- E8.7 — portal público: pedidos na fila; owner/admin activa; coluna de destino.
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "taskflow_public_portal_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "taskflow_public_portal_slug" varchar(40);
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "taskflow_public_portal_column_id" integer;

DO $$
BEGIN
  ALTER TABLE "teams"
    ADD CONSTRAINT "teams_taskflow_public_portal_column_id_fkey"
    FOREIGN KEY ("taskflow_public_portal_column_id") REFERENCES "taskflow_columns"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "teams_taskflow_public_portal_slug_unique"
  ON "teams" ("taskflow_public_portal_slug")
  WHERE "taskflow_public_portal_slug" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "taskflow_portal_submissions" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "title" varchar(500) NOT NULL,
  "description" text,
  "submitter_name" varchar(120),
  "submitter_email" varchar(255),
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "task_id" integer REFERENCES "taskflow_tasks"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "taskflow_portal_submissions_team_status_idx"
  ON "taskflow_portal_submissions" ("team_id", "status");
