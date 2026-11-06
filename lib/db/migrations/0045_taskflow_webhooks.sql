-- E8.5 — webhooks outbound (POST JSON) com deduplicação por endpoint + chave.
CREATE TABLE IF NOT EXISTS "taskflow_webhooks" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "name" varchar(100) NOT NULL,
  "target_url" text NOT NULL,
  "secret" varchar(128),
  "events" varchar(200) DEFAULT 'task.created,task.updated' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "taskflow_webhook_deliveries" (
  "id" serial PRIMARY KEY NOT NULL,
  "webhook_id" integer NOT NULL REFERENCES "taskflow_webhooks"("id") ON DELETE CASCADE,
  "dedupe_key" varchar(200) NOT NULL,
  "http_status" integer,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "taskflow_webhook_deliveries_webhook_dedupe_unique"
  ON "taskflow_webhook_deliveries" ("webhook_id", "dedupe_key");
