-- E1.1 — limite de contas «Administrador» no time por plano (add-on comercial = plano com slots > 1).
ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS max_team_admin_slots integer NOT NULL DEFAULT 1;
COMMENT ON COLUMN saas_plans.max_team_admin_slots IS 'Máximo de membros do time com role admin (exclui owner). E1.1.';

UPDATE saas_plans SET max_team_admin_slots = 2 WHERE name = 'Enterprise';
