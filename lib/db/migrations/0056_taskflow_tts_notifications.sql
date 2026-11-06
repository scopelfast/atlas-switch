-- E8.19 — notificações faladas opcionais (opt-in equipa + utilizador; não afecta e-mail nem feed).
ALTER TABLE teams ADD COLUMN IF NOT EXISTS taskflow_tts_notifications_allowed boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS taskflow_tts_notifications_enabled boolean NOT NULL DEFAULT false;
