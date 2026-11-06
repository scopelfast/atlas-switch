# Memorial — Governança SaaS multi-tenant (Atlas Switch)

Documento vivo que fixa **contrato de produto e engenharia** para operação comercial rigorosa: **tenant**, **planos**, **módulos**, **perfis**, **provisionamento de clientes**, **cobrança** e **postura de IA**.  
**Não** substitui o memorial de execução Taskflow (`MEMORIAL_TASKFLOW_EXECUCAO.md`): esse ficheiro continua a ser o **checklist por fases M/E** do núcleo operacional; este memorial governa a **camada de plataforma** que condiciona o que cada cliente paga e vê.

**Regra:** alterações que afectem limites comerciais (planos, módulos, lugares, admin slots) ou fronteira de tenant devem **actualizar este ficheiro** ou o ADR respectivo, e referenciar PR/commits no registo em baixo.

---

## 1. Documentos relacionados (fonte da verdade)

| Tema | Ficheiro |
|------|-----------|
| Execução Taskflow, fases M/E, critérios de aceite | `Projeto/MEMORIAL_TASKFLOW_EXECUCAO.md` |
| UI/UX transversal, shell, manuais, backlog refinamento | `Projeto/MEMORIAL_UI_UX_PLATAFORMA.md` |
| Fronteira técnica multi-tenant (`team_id`, schema partilhado) | `Projeto/ADR-0001-multitenant-team-id.md` |
| Orquestração de IA (pipeline interno, extensões) | `Projeto/ADR-0005-orquestracao-ia-pipeline-interno.md` |
| Segundo administrador por plano (gating) | `Projeto/E1.1-segundo-administrador.md` |
| LGPD / export / dados pessoais | `Projeto/LGPD-minimo-atlas-switch.md` |

---

## 2. Tese comercial e técnica

O Atlas Switch é um **SaaS multi-tenant** orientado a PME e operações integradas (**reunião → tarefa → tempo → finanças**). A **cobrança** e o **controlo de exposição de funcionalidades** assentam em três eixos que **devem ser aplicados em conjunto** (nunca só um deles):

1. **Plano contratado** — o que o cliente **comprou** (módulos activos, limites `max_users`, `max_team_admin_slots`, flags de IA no plano, etc.), materializado em `saas_plans` e na associação `team_plans` por equipa.
2. **Papel no time** — o que o utilizador **pode fazer** dentro do tenant (`team_members.role` + regras de convite e hierarquia).
3. **Papel global da conta** (`users.role`) — alinhado ao convite e à matriz de permissões; **não** substitui a verificação de `team_id` em cada API.

**Fronteira operador da instância vs. dono do tenant:** o papel global **`platform_admin`** é o **único** com `control.view`, `users.manage` (lista global) e `ai.manage` no sentido de **Centro de Controlo / APIs `/api/control/*`**. Os papéis globais de **produto** (`owner`, `admin`, `gestor`, `supervisor`, `member`) partilham o pacote **sem** essas três permissões: o dono comercial continua a ser **`owner` no time** (`team_members.role`), mas **não** herda visão de todas as empresas da instância só por se registar. `canAccessControlPlane` em código corresponde **apenas** a `platform_admin` (ver `lib/auth/permissions.ts`).

**Regra de ouro para engenharia:** toda listagem ou mutação de dados de negócio deve filtrar por **tenant activo** (`team_id` / membership) e, quando aplicável, por **módulo activo no plano** e por **permissão do papel**. RBAC só na UI é **inaceitável** (já consagrado no memorial Taskflow).

---

## 3. Modelo de tenant (empresa = time)

- **Empresa do cliente** = linha em `teams`.
- **Membros** = `team_members` (utilizador ↔ time + `role` no time: `owner`, `admin`, `gestor`, `supervisor`, `member`, …).
- **Convites** = fluxo em `app/(login)/actions.ts` (ex.: `inviteTeamMember`, `signUp` com token de convite); lugares contam convites `pending` + membros (ver memorial Taskflow / `lib/team/seat-limits.ts`).
- **Provisionamento hoje:** criação automática de `teams` no **registo sem convite** (primeiro utilizador cria time e fica `owner` no time). **Não** existe ainda fluxo completo no painel «Empresas» para «criar empresa + master + convite» (ver secção 8).

Decisão arquitectural: **schema partilhado + `team_id`** — ver ADR-0001. Evoluções (RLS Postgres, instância dedicada por cliente enterprise) exigem **novo ADR**, não improvisação.

---

## 4. Mapa do painel de governança (operador da plataforma)

As rotas abaixo exigem **`hasPermission(..., 'control.view')`** na UI e **`canAccessControlPlane(user)`** nas APIs de controlo — em ambos os casos, com a matriz actual, **só** utilizadores com papel global **`platform_admin`**. O menu em `lib/menu-config.ts` filtra por permissão; rotas `/api/control/*` devem rejeitar quem não passa em `canAccessControlPlane` (403).

| Rota dashboard | Função para o negócio |
|----------------|----------------------|
| `/dashboard/control-center` | **Console do operador da plataforma:** métricas (equipas, MRR projectado), saúde por cliente, auditoria recente, visão global de planos por equipa; apoio a decisão e suporte. |
| `/dashboard/planos` | **Definição comercial dos pacotes:** nome, preço, limites, **módulos** incluídos por plano (`saas_plans` + relação módulos). Base para o que se vende. |
| `/dashboard/catalogo` | **Inventário de capacidades:** mapeamento **módulo → permissões** (funções) exposto de forma legível para vendas, CS e engenharia (página é documentação viva + filtro). |
| `/dashboard/perfis` | **Matriz papel × permissão:** derivada de `getRolePermissions()` / etiquetas em `lib/auth/permissions.ts` — o que cada **papel global** pode fazer na aplicação. |
| `/dashboard/empresas` | **Clientes (times) e planos contratados:** listagem + adicionar/remover **associação** plano↔equipa (`team-plans`). |
| `/dashboard/usuarios` (API `GET /api/control/usuarios`) | **Vista global** de utilizadores e equipas (só **`platform_admin`** + `users.manage`). **Nota:** convites do dia-a-dia do cliente usam a mesma rota de menu quando o utilizador pode convidar (`canInviteToTeam`), mas os dados vêm do **time da sessão** (`/api/team` + `inviteTeamMember`), não da API global de controlo. |
| `/dashboard/menu-config` | Configuração de entradas de menu (continuidade operacional da plataforma). |

**APIs de controlo** (indicativo, pasta `app/api/control/`): `empresas`, `plans`, `team-plans`, `teams`, `usuarios`, `metrics`, `health`, `events`, `platform-settings`, `assemblyai-secret`, etc. Qualquer nova rota mutável deve registar **evento de auditoria** quando já existir padrão (`audit_events`).

---

## 5. Planos e cobrança (rigor)

- **Catálogo de planos** (`saas_plans`): preço, intervalo, limites (`max_users`, armazenamento, `max_team_admin_slots`, flags como `ai_enabled`, módulos ligados).
- **Contrato por cliente** (`team_plans`): qual plano está activo naquela equipa, preço negociado, dia de ciclo, estado, datas de facturação.
- **Regras:** limites de **lugares** e **segundo admin** devem ser aplicados **no servidor** no convite e no aceite (já parcialmente implementado — memorial E1.1).
- **Stripe / externo:** quando integrado, IDs de produto/preço no plano; o operador deve conseguir correlacionar **equipa ↔ cliente Stripe** no Centro de Controlo sem aceder a dados de outro tenant.

Checklist mental antes de fechar uma feature que afecte receita:

- [x] O plano **sem** o módulo continua seguro (API retorna 403/404 claro, não vazamento)?
- [x] O limite de utilizadores **e** convites pendentes está aplicado?
- [ ] Alteração de plano **retroactiva** ou troca de módulos tem comportamento definido (upgrade/downgrade)?
- [x] Há linha de auditoria ou log para suporte?

**Estado 2026-04-22:** guard de módulo por plano (`teamHasModuleEnabled`) aplicado no backend de `Chronos`, `Reunify`, `Projectus`, `BillTrak`, `ResourceHub` e **todo o backend `Taskflow`** (incluindo webhooks, semantic search, cloud AI, portal, anexos/links externos, regras de automação e endpoints auxiliares). O item 1 da checklist passa a `[x]`. Com a trilha `integration_sync_events`, runbook `Projeto/RUNBOOK_OPERACIONAL_INTEGRACOES.md` e endpoint agendado `POST /api/chronos/agenda/reconcile-reunify/scheduled`, o item 4 (linha operacional de auditoria/log) também fica coberto para o fluxo Reunify→Chronos. Itens 2 e 3 (limites e regra de upgrade/downgrade) permanecem pendentes.

---

## 6. Catálogo vs perfis vs planos

| Conceito | O que é | Onde vive |
|----------|---------|-----------|
| **Plano** | Pacote **vendido** com módulos e limites | BD `saas_plans` + UI `/dashboard/planos` |
| **Catálogo (UI)** | Lista **o que existe** no produto (módulos e permissões associadas) | `/dashboard/catalogo` — alinhado a chaves em `lib/auth/permissions.ts` |
| **Perfil (papel)** | Conjunto de **permissões** efectivas para um papel global | `/dashboard/perfis` + matriz `ROLE_PERMISSIONS` em código |

**Produto:** capacidade visível ao utilizador final ≈ **intersecção** do que o **plano** permite com o que o **papel** permite. Documentar aqui decisões quando a UI mostrar algo que a API ainda nega (evitar “fantasma” de funcionalidade).

---

## 7. IA: nativa, modular e chave do cliente (BYOK)

Alinhamento com prática de mercado (Notion, ClickUp, Monday, Zoho):

- **IA / APIs externas com custo variável:** em muitos produtos o custo do fornecedor **não** está embutido; o cliente leva a chave para o provedor **ou** compra add-on. No Atlas Switch, funcionalidades como **modelo na nuvem por equipa** (ex. Taskflow) seguem **opt-in** + quota/cap e dependem de configuração de plataforma (ver memorial E8.11 e flags em `teams`).
- **IA “nativa” no pacote:** funcionalidades incluídas no preço base ou add-on explícito (transparência no plano — campo `ai_enabled` e módulos).
- **Pipeline e auditoria:** decisão de orquestração em ADR-0005; trâmites e revisão humana onde houver risco LGPD.

**Governança:** cada módulo que possa chamar modelo externo deve ter **flag de equipa** + **cap** + **política de dados** documentada (ver documentos E8.x e LGPD).

---

## 8. Empresas e utilizador «master» (estado e direcção)

**Estado actual (repositório):**

- `GET /api/control/empresas` — lista empresas e planos associados.
- UI `/dashboard/empresas` — listagem, filtro, adicionar/remover plano da equipa.
- **Não** há `POST` para criar `teams` a partir do painel nem fluxo integrado «criar empresa + convite master».

**Direcção aprovada pelo produto (para fechar o ciclo comercial):**

1. Operador da plataforma **cria empresa** (`teams`) com nome comercial correcto.
2. Associa **plano(s)** (já suportado via `team-plans`).
3. **Master da empresa:** preferencialmente **convite** com papel `owner` ou `admin` no time (reutiliza segurança e UX de convites existentes); alternativa técnica avaliada caso a caso (utilizador pré-criado).
4. O master usa **`/dashboard/usuarios`** no contexto do seu time para **convidar** membros (função já existente).

**Critérios de aceite mínimos** quando a implementação existir:

- [ ] Transacção ou sequência atómica: não fica empresa sem membro nem membro sem empresa.
- [ ] Apenas `canAccessControlPlane` pode provisionar no painel global.
- [ ] Auditoria da acção (actor, team id, plano opcional).
- [ ] Documentar no **Registo de alterações** deste memorial + entrada no memorial Taskflow se houver item M/E associado.

---

## 9. Síntese competitiva (referência, não marketing)

| Plataforma | Foco | Atlas Switch |
|------------|------|----------------|
| ClickUp / Monday | Produtividade e escala de integrações | Atlas: **fluxo único** operacional + **governança** explícita (planos, perfis, controlo) |
| Notion | Conhecimento flexível | Atlas: **domínio explícito** (tarefas, reuniões, tempo, projectos) |
| Zoho One | Suite larga | Atlas: **menos superfície**, mais **coerência** entre módulos próprios |

O diferencial documentado para vendas e engenharia: **console operacional + documentação viva (manuais + catálogo) + opt-in de IA modular + auditoria**.

---

## 10. Registo de alterações (este memorial)

| Data | Alteração |
|------|-----------|
| 2026-04-20 | Criação do memorial: mapa de governança SaaS, ligação a planos/catálogo/perfis/controlo, modelo tenant, IA, backlog «criar empresa + master», referências a ADRs e ao memorial Taskflow. |
| 2026-04-22 | Hardening de governança por módulo: criação do helper `teamHasModuleEnabled` (`lib/team/plan-modules.ts`) e aplicação nas rotas críticas de `Chronos` e `Reunify` (incluindo conectores Google Calendar e Microsoft Graph). |
| 2026-04-22 | Expansão final do hardening de módulo no backend: cobertura de `Projectus`, `BillTrak`, `ResourceHub` e lote residual de `Taskflow` (`webhooks`, `cloud-ai`, `semantic-search`, `attachments`/`external-links`, `status-definitions`, `task-types`, `portal-submissions`, `columns/[id]`, `sprints/[id]`, `boards/from-template`, `export/weekly-capacity`, `recurrence/materialize`, `labels/[id]`, `automation` e `automation-rules`). |
| 2026-04-22 | Observabilidade operacional inicial de integrações (IM3 parcial): nova trilha `integration_sync_events` com métricas e reconciliação on-demand para Reunify→Chronos (`/api/reunify/integrations/metrics`, `/api/reunify/meetings/[meetingId]/integration-history`, `/api/chronos/agenda/reconcile-reunify`). |
| 2026-04-22 | Runbook operacional de integrações: criado `Projeto/RUNBOOK_OPERACIONAL_INTEGRACOES.md` para incidentes (não sincronizou/duplicou/perdeu vínculo), com severidade, procedimento padrão, reconciliação e escalonamento. |
| 2026-04-22 | Reconciliação agendada (IM3.2): novo endpoint `POST /api/chronos/agenda/reconcile-reunify/scheduled` com segredo (`CRON_SECRET`/`ATLAS_CRON_SECRET`), execução por time (`teamId`) ou em lote (`maxTeams`) e reaproveitamento da lógica comum `lib/chronos/reunify-reconcile.ts`. |
| 2026-04-22 | QA contínuo automatizado: scripts `qa:scenario`/`qa:evidence`, guia `Projeto/QA_AUTOMACAO_OPERACIONAL.md` e workflow diário `.github/workflows/qa-operacional.yml` para gerar e publicar artefatos de validação operacional. |
| 2026-04-23 | Execução de homologação com `pnpm run qa:full` concluída (tag `QA-AUTO-20260423-073014`), com artefatos em `Projeto/registos-qa/` e checks transversais (`check:invite-invariants`, `check:ai-pipeline`) em estado OK. Checklist de receita atualizada: itens 1, 2 e 4 marcados como concluídos, mantendo pendente o item 3 (regra de upgrade/downgrade). |
| 2026-04-23 | **Operador da instância:** introdução do papel global `platform_admin` (único com Centro de Controlo global e permissões `control.view` / `users.manage` / `ai.manage` no pacote de plataforma). Papéis `owner`/`admin` globais passam a ser **só produto** (sem listar todas as empresas). Seed e migração `0066_platform_operator_role_seed` promovem o utilizador seed `teste@atlatswitch.com`; bases existentes devem promover operadores reais por e-mail (SQL ou processo interno). |
| 2026-04-23 | **Seed demonstração:** o time «Time AtlasSwitch» passa a ser **sempre** associado ao plano **Enterprise** com todos os `saas_plan_modules` ativos em cada `pnpm db:seed`, corrigindo bloqueios de módulo (ex. BillTrak) em bases antigas ou com plano Essencial. |

---

## 11. Manutenção

- **Quem altera planos ou permissões** deve actualizar **catálogo** (se for só documentação de UI) ou **perfis** (se a matriz em código mudar) e esta secção se a regra de cobrança mudar.
- **Novos módulos:** entrada no catálogo de planos + gating em API + chave em `permissions.ts` + linha na tabela do catálogo UI quando fizer sentido.
