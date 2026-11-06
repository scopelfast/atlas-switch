-- E8.3 — opt-in por equipa: sugestões heurísticas de prioridade e redistribuição (sem LLM externo).
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "taskflow_assist_suggestions_enabled" boolean NOT NULL DEFAULT false;
