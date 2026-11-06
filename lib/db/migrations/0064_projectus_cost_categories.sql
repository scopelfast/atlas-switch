CREATE TABLE "projectus_cost_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(120) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projectus_cost_categories_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "projectus_cost_categories_team_id_code_unique" ON "projectus_cost_categories" USING btree ("team_id","code");
--> statement-breakpoint
INSERT INTO "projectus_cost_categories" ("team_id", "code", "label", "active", "position", "created_at", "updated_at")
SELECT t.id, v.code, v.label, true, v.pos, now(), now()
FROM "teams" t
CROSS JOIN (
	VALUES
		('PESSOAL', 'Pessoal e encargos', 10),
		('SOFTWARE', 'Software e licenças', 20),
		('INFRA', 'Infraestrutura e cloud', 30),
		('VIAGENS', 'Viagens e estadias', 40),
		('CONSULTORIA', 'Consultoria externa', 50),
		('MATERIAL', 'Material e equipamento', 60),
		('IMPOSTOS', 'Impostos e taxas', 70),
		('PLANEJAMENTO', 'Planejamento e levantamento', 80),
		('OPERACIONAL', 'Operacional', 90),
		('OUTROS', 'Outros', 100)
) AS v(code, label, pos);
--> statement-breakpoint
ALTER TABLE "projectus_cost_items" ADD COLUMN "category_id" integer;
--> statement-breakpoint
ALTER TABLE "projectus_cost_items" ADD COLUMN "category_detail" varchar(200);
--> statement-breakpoint
ALTER TABLE "projectus_cost_items" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "projectus_cost_items" ADD CONSTRAINT "projectus_cost_items_category_id_projectus_cost_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."projectus_cost_categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
UPDATE "projectus_cost_items" ci
SET "category_id" = cc.id
FROM "projectus_projects" p
INNER JOIN "projectus_cost_categories" cc ON cc.team_id = p.team_id AND cc.code <> 'OUTROS'
WHERE p.id = ci.project_id
	AND ci.category_id IS NULL
	AND lower(trim(ci.category)) = lower(trim(cc.label));
--> statement-breakpoint
UPDATE "projectus_cost_items" ci
SET
	"category_id" = (
		SELECT cc.id
		FROM "projectus_cost_categories" cc
		INNER JOIN "projectus_projects" p ON p.id = ci.project_id AND cc.team_id = p.team_id
		WHERE cc.code = 'OUTROS'
		LIMIT 1
	),
	"category_detail" = left(trim(ci.category), 200)
WHERE ci.category_id IS NULL;
--> statement-breakpoint
UPDATE "projectus_cost_items" ci
SET "category" = CASE
	WHEN cc.code = 'OUTROS' AND ci.category_detail IS NOT NULL AND trim(ci.category_detail) <> ''
		THEN left(cc.label || ': ' || trim(ci.category_detail), 80)
	ELSE left(cc.label, 80)
END
FROM "projectus_cost_categories" cc
WHERE cc.id = ci.category_id;
--> statement-breakpoint
ALTER TABLE "projectus_cost_items" ALTER COLUMN "category_id" SET NOT NULL;
