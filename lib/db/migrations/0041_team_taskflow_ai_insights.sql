ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "taskflow_ai_insights_enabled" boolean NOT NULL DEFAULT false;
