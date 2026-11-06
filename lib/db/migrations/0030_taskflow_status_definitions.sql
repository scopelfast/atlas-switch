CREATE TABLE "taskflow_status_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"fixed_situation" varchar(24) NOT NULL,
	"color" varchar(32) DEFAULT 'slate' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taskflow_status_definitions" ADD CONSTRAINT "taskflow_status_definitions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "taskflow_status_team_code_unique" ON "taskflow_status_definitions" USING btree ("team_id","code");
--> statement-breakpoint
INSERT INTO "taskflow_status_definitions" ("team_id", "code", "name", "description", "fixed_situation", "color", "position", "created_at", "updated_at")
SELECT t.id, v.code, v.name, v.description, v.fixed_situation, v.color, v.pos, now(), now()
FROM "teams" t
CROSS JOIN (VALUES
	('open', 'Aberto', 'Tarefa em aberto', 'OPEN', 'indigo', 1),
	('in_progress', 'Em curso', 'Em execução', 'IN_PROGRESS', 'amber', 2),
	('blocked', 'Bloqueado', 'Aguardando desbloqueio', 'BLOCKED', 'rose', 3),
	('done', 'Concluído', 'Finalizada com sucesso', 'DONE', 'emerald', 4),
	('cancelled', 'Cancelado', 'Não será concluída', 'CANCELLED', 'slate', 5)
) AS v(code, name, description, fixed_situation, color, pos);
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD COLUMN "status_id" integer;
--> statement-breakpoint
UPDATE "taskflow_tasks" tt
SET "status_id" = sd.id
FROM "taskflow_boards" tb
INNER JOIN "taskflow_status_definitions" sd ON sd.team_id = tb.team_id AND sd.code = 'done'
WHERE tt.board_id = tb.id AND trim(both from tt.status) = 'DONE';
--> statement-breakpoint
UPDATE "taskflow_tasks" tt
SET "status_id" = sd.id
FROM "taskflow_boards" tb
INNER JOIN "taskflow_status_definitions" sd ON sd.team_id = tb.team_id AND sd.code = 'in_progress'
WHERE tt.board_id = tb.id AND trim(both from tt.status) = 'IN_PROGRESS';
--> statement-breakpoint
UPDATE "taskflow_tasks" tt
SET "status_id" = sd.id
FROM "taskflow_boards" tb
INNER JOIN "taskflow_status_definitions" sd ON sd.team_id = tb.team_id AND sd.code = 'blocked'
WHERE tt.board_id = tb.id AND trim(both from tt.status) = 'BLOCKED';
--> statement-breakpoint
UPDATE "taskflow_tasks" tt
SET "status_id" = sd.id
FROM "taskflow_boards" tb
INNER JOIN "taskflow_status_definitions" sd ON sd.team_id = tb.team_id AND sd.code = 'cancelled'
WHERE tt.board_id = tb.id AND trim(both from tt.status) = 'CANCELLED';
--> statement-breakpoint
UPDATE "taskflow_tasks" tt
SET "status_id" = sd.id
FROM "taskflow_boards" tb
INNER JOIN "taskflow_status_definitions" sd ON sd.team_id = tb.team_id AND sd.code = 'open'
WHERE tt.board_id = tb.id AND tt.status_id IS NULL;
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" DROP COLUMN "status";
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ALTER COLUMN "status_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "taskflow_tasks" ADD CONSTRAINT "taskflow_tasks_status_id_taskflow_status_definitions_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."taskflow_status_definitions"("id") ON DELETE no action ON UPDATE no action;
