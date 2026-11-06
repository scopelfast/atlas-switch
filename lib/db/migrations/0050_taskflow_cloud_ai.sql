-- E8.11 — modelo na nuvem (OpenAI / Google Gemini API): opt-in por equipa, quota mensal, uso agregado.

ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "taskflow_cloud_ai_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "taskflow_cloud_ai_provider" varchar(16);
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "taskflow_cloud_ai_monthly_request_cap" integer DEFAULT 100 NOT NULL;

CREATE TABLE IF NOT EXISTS "taskflow_cloud_ai_usage" (
  "team_id" integer NOT NULL REFERENCES "public"."teams" ("id") ON DELETE CASCADE,
  "period_ym" varchar(7) NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "prompt_tokens" integer DEFAULT 0 NOT NULL,
  "completion_tokens" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "taskflow_cloud_ai_usage_pkey" PRIMARY KEY ("team_id","period_ym")
);

CREATE INDEX IF NOT EXISTS "taskflow_cloud_ai_usage_period_idx" ON "taskflow_cloud_ai_usage" ("period_ym");
