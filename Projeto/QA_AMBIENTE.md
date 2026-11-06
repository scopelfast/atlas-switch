Checklist de ambiente de testes – AtlasSwitch
=============================================

Objetivo: garantir que qualquer pessoa consiga subir o projeto localmente, popular o banco e validar o fluxo de login antes de testar os módulos.

1. Pré-requisitos locais
------------------------
- Node.js LTS 20.x (ou superior) + pnpm 9.x (`corepack enable`).
- Docker Desktop + Docker Compose **(recomendado)** para usar o Postgres local criado pelo script `db:setup`.  
  - Alternativa: ter uma URL de Postgres remota pronta.
- Stripe CLI (para gerar `STRIPE_WEBHOOK_SECRET`) – opcional em sandbox, mas necessário caso os fluxos de cobrança sejam testados.
- Credenciais de SMTP (opcional); se não houver, documentar que os envios falharão silenciosamente.

2. Clonar o projeto e instalar dependências
-------------------------------------------
```sh
git clone https://github.com/<org>/atlas-switch.git
cd atlas-switch
pnpm install
```

3. Configurar variáveis de ambiente
-----------------------------------
### 3.1 Opção guiada (`pnpm db:setup`)
Executa o script interativo, cria `.env` e sobe um Postgres via Docker:
```sh
pnpm db:setup
```
O script pede:
- Se deseja Postgres local ou remoto. Para local, ele cria um `docker-compose.yml` e sobe o container em `localhost:54322`.
- `STRIPE_SECRET_KEY` e secret do webhook (pode pular se não for usar Stripe neste momento; anote no final que o campo ficou vazio).
- Gera automaticamente `AUTH_SECRET`.

### 3.2 Opção manual
1. Copiar `.env.example` para `.env`.
2. Preencher:
   - `POSTGRES_URL` (ex.: `postgres://postgres:postgres@localhost:54322/postgres`).
   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (pode deixar placeholder se não testar Stripe).
   - `AUTH_SECRET` (use `openssl rand -hex 32` ou `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`).
   - `SMTP_*` caso vá testar convites ou notificações por e-mail.

4. Preparar banco de dados
--------------------------
Se usou a opção interativa com Docker, o container deve estar rodando. Caso contrário, garanta que o Postgres esteja acessível.

Executar migrações e seed:
```sh
pnpm db:migrate
pnpm db:seed
```
O seed cria:
- Utilizador **`platform_admin`** (operador da instância / Centro de Controlo): `teste@atlatswitch.com` (senha `Admin@123`). No time seed continua **`owner`** em `team_members` (dono do time de demonstração).
- Time “Time AtlasSwitch”.
- Dados iniciais em Chronos, Taskflow, Reunify, Projectus, ResourceHub, BillTrak, Bibliotheca, Notepad e Scriptum.

5. Subir a aplicação
--------------------
```sh
pnpm dev
```
Abrir `http://localhost:3003/login` (porta definida em `pnpm dev` no `package.json`; ajuste se alterar).

6. Validar fluxo de login básico
--------------------------------
1. Acessar `/login`.
2. Entrar com `teste@atlatswitch.com` e senha `Admin@123`.
3. Confirmar redirecionamento para `/dashboard`.
4. Verificar se:
   - Header exibe nome do usuário (ou e-mail) com avatar gerado.
   - Sidebar com módulos é renderizada sem erros.
   - `/dashboard/general` carrega e todos os cards mostram dados do seed.
5. Fazer logout (menu do avatar) e garantir redirecionamento para `/`.

Registrar qualquer erro (ex.: 500 de API, falha de conexão com DB, cookie não setado) para correção.

7. Observações importantes
--------------------------
- **Stripe/SMTP**: se não houver credenciais, documentar no relatório que fluxos de cobrança e e-mails estão desabilitados. Podemos adicionar flag futura para skip.
- **HTTPS/cookies**: em ambiente local, `http://localhost` funciona porque o cookie usa `secure: true`; browsers modernos aceitam `secure` em `localhost`. Em hosts customizados sem HTTPS o login falha.
- **Reexecução do seed**: o seed é idempotente – roda novamente para repor dados caso necessário. **Importante:** o time «Time AtlasSwitch» é reposto no plano **Enterprise** com **todos** os módulos (BillTrak, etc.); se viu «módulo indisponível para este plano», volte a correr `pnpm db:seed` após actualizar o repositório.

Após concluir este checklist, marque o item “Montar ambiente teste e validar login” como concluído e siga para os testes dos módulos.
