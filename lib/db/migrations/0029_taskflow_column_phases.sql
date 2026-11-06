ALTER TABLE "taskflow_columns" ADD COLUMN "phase_type" varchar(16) DEFAULT 'PRODUCTION' NOT NULL;
--> statement-breakpoint
ALTER TABLE "taskflow_columns" ADD COLUMN "max_stay_hours" integer;
--> statement-breakpoint
ALTER TABLE "taskflow_columns" ADD COLUMN "stripe_color" varchar(32);
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD COLUMN "column_entered_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "taskflow_tasks" SET "column_entered_at" = COALESCE("updated_at", "created_at") WHERE "column_entered_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ALTER COLUMN "column_entered_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ALTER COLUMN "column_entered_at" SET NOT NULL;
--> statement-breakpoint
UPDATE "taskflow_columns" SET "phase_type" = 'FINAL' WHERE LOWER("name") ~ '(conclu|cancel|done|final)';
--> statement-breakpoint
UPDATE "taskflow_columns" SET "phase_type" = 'INITIAL' WHERE LOWER("name") ~ '(backlog|planej|planeiam|pendente|inicial)' AND "phase_type" <> 'FINAL';
--> statement-breakpoint
UPDATE "taskflow_columns" SET "phase_type" = 'PRODUCTION' WHERE "phase_type" NOT IN ('INITIAL','PRODUCTION','FINAL');
--> statement-breakpoint
WITH "dups" AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "board_id" ORDER BY "position", "id") AS "rn"
  FROM "taskflow_columns"
  WHERE "phase_type" = 'INITIAL'
)
UPDATE "taskflow_columns" c SET "phase_type" = 'PRODUCTION' FROM "dups" d WHERE c."id" = d."id" AND d."rn" > 1;
