-- E8.18 — fornecedor ASR opcional para Reunify (AssemblyAI na nuvem; Vosk reservado para worker offline).

ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "reunify_asr_provider" varchar(20) DEFAULT 'none' NOT NULL;
