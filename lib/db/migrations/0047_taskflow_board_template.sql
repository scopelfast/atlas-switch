-- E8.8 — modelos de processo: idempotência por pedido de cliente + rastreio de clonagem.
ALTER TABLE "taskflow_boards" ADD COLUMN IF NOT EXISTS "cloned_from_board_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'taskflow_boards_cloned_from_board_id_fk'
  ) THEN
    ALTER TABLE "taskflow_boards"
      ADD CONSTRAINT "taskflow_boards_cloned_from_board_id_fk"
      FOREIGN KEY ("cloned_from_board_id") REFERENCES "public"."taskflow_boards"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "taskflow_template_board_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL,
  "client_request_id" varchar(80) NOT NULL,
  "board_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "taskflow_template_board_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE,
  CONSTRAINT "taskflow_template_board_requests_board_id_taskflow_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."taskflow_boards"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "taskflow_template_board_requests_team_client_unique"
  ON "taskflow_template_board_requests" ("team_id", "client_request_id");

CREATE INDEX IF NOT EXISTS "taskflow_template_board_requests_board_id_idx"
  ON "taskflow_template_board_requests" ("board_id");
