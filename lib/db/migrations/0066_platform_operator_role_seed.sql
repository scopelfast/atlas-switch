-- Promove o utilizador seed / operador da instância para `platform_admin` (Centro de Controlo global).
-- Ajuste a lista de e-mails conforme a sua instância antes de aplicar em produção.
update users
set role = 'platform_admin', updated_at = now()
where lower(email) = lower('teste@atlatswitch.com')
  and role in ('owner', 'admin');
