-- E8.2 — opt-in por equipa: rascunho de acções a partir de texto/transcrição (revisão humana antes de gravar).
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "reunify_transcript_draft_enabled" boolean NOT NULL DEFAULT false;
