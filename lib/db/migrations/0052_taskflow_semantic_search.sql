-- E8.15 — busca semântica em tarefas (embeddings OpenAI; opt-in por equipa).
-- Embeddings em jsonb (array de 1536 números) para funcionar em qualquer Postgres sem extensão vector.
-- Em produção com pgvector instalado, pode evoluir-se para tipo vector + índice HNSW noutra migração.

ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "taskflow_semantic_search_enabled" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "taskflow_task_embeddings" (
  "task_id" integer PRIMARY KEY NOT NULL REFERENCES "public"."taskflow_tasks"("id") ON DELETE CASCADE,
  "team_id" integer NOT NULL REFERENCES "public"."teams"("id") ON DELETE CASCADE,
  "embedding" jsonb NOT NULL,
  "source_text" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "taskflow_task_embeddings_embedding_shape" CHECK (
    jsonb_typeof("embedding") = 'array'
    AND jsonb_array_length("embedding") = 1536
  )
);

CREATE INDEX IF NOT EXISTS "taskflow_task_embeddings_team_id_idx" ON "taskflow_task_embeddings" ("team_id");
