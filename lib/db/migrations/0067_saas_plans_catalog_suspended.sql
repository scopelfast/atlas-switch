-- Planos suspensos deixam de aparecer em novas associações (Empresas / team_plans), sem apagar histórico.
ALTER TABLE "saas_plans" ADD COLUMN IF NOT EXISTS "catalog_suspended" boolean DEFAULT false NOT NULL;
