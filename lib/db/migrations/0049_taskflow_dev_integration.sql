-- E8.10 — ligações dev (commit/PR) por tarefa + segredo inbound por time (sem expor em GET /api/team genérico).

CREATE TABLE IF NOT EXISTS "team_taskflow_dev_integration" (
  "team_id" integer PRIMARY KEY NOT NULL REFERENCES "public"."teams" ("id") ON DELETE CASCADE,
  "inbound_secret" varchar(80) NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "taskflow_task_external_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "public"."teams" ("id") ON DELETE CASCADE,
  "task_id" integer NOT NULL REFERENCES "public"."taskflow_tasks" ("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL DEFAULT 'manual',
  "url" text NOT NULL,
  "title" varchar(240),
  "external_ref" varchar(120),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "taskflow_task_external_links_task_id_idx" ON "taskflow_task_external_links" ("task_id");
CREATE INDEX IF NOT EXISTS "taskflow_task_external_links_team_id_idx" ON "taskflow_task_external_links" ("team_id");
