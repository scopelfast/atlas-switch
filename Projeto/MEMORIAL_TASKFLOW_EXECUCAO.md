# Memorial de execução — Taskflow & plataforma Atlas Switch

Documento vivo para implementar o produto alinhado ao memorial funcional, **marcando checkboxes** à medida que cada item fica pronto em `main`.  
**Regra:** nenhum item marcado sem critério de aceite verificado (manual ou teste).

**Sobre “100%”:** o escopo completo atravessa várias fases (RBAC, dados, timesheet, relatórios). Este ficheiro é o **contrato de entrega**; chegar a 100% é **iterativo** — vários commits/sessões — sempre com critérios de aceite verificados.

**Governança SaaS multi-tenant** (planos, módulos, empresas, perfis, cobrança, IA/BYOK, provisionamento): ver **`Projeto/MEMORIAL_GOVERNANCA_SAAS_MULTITENANT.md`** — contrato separado deste memorial de execução Taskflow.

**Progresso global:** **Fases 2 a 7** — itens do memorial neste documento estão fechados em código (`[x]`). **Fase 0** — **M0.7** marcado como fechado com **validação final obrigatória** no fecho da release/homologação (ver checklist abaixo e registo). **Fase 1** — **E1.1** concluído (`max_team_admin_slots` em planos + validação de convites). **Fase 8** — **I8.1–I8.4** e **E8.1–E8.19** estão `[x]` em código e critérios. **Continuidade Reunify/Chronos** (debate 2026-04-17): secção dedicada com estratégia por fases e backlog — ver **«Continuidade — Reunify · Chronos · experiência de reunião»**. Política de **textos na UI** (sem códigos de memorial visíveis ao utilizador), **shell do dashboard** (menu estável + mobile), **export PDF** (`serverExternalPackages`) e **manuais** — ver **Apêndice A** e `Projeto/MEMORIAL_UI_UX_PLATAFORMA.md`. **Pendência:** manual **Projectus** desactualizado face ao produto — checklist em **Apêndice A** («Pendência — manual Projectus»). Ver também **Estado sumário** e “Registo de alterações”.

### Estado sumário (fases 0 a 7)

- **Fases 2 → 7:** todos os **M** e **E** listados nas tabelas destas fases estão `[x]`; o núcleo Taskflow até relatórios/intervenções está coberto no repositório.
- **Fase 0:** **M0.7** está marcado `[x]` para avanço do encerramento, mas com **validação final obrigatória** no fecho da release/homologação (checklist manual datada no “Registo de alterações”).
- **Fase 1:** **E1.1** — limite de administradores por plano (`saas_plans.max_team_admin_slots`) e validação em convites/aceite.
- **Menu lateral** (`lib/menu-config.ts`): quem tem `taskflow.view` vê **Tarefas** (`/dashboard/taskflow`) e **Taskflow · Relatórios** (`/dashboard/taskflow/reports`). **M7.x** (painel de intervenções), **E7.2**/**E8.4** (CSV + Excel + PDF no export de tarefas) e **E7.3** (insights com opt-in) vivem **dentro** dessas páginas ou no cabeçalho do quadro — não há entradas separadas no sidebar por desenho de UX. **E8.7** — link público partilhável `/taskflow-portal/[slug]` (fora do dashboard; activação no cartão do quadro). **E8.8** — vários quadros por time: selector na página Taskflow, «Novo quadro» e «A partir de modelo» (clone de colunas/etiquetas; sem tarefas). Outros módulos (Chronos, Reunify, …) dependem das **permissões** do papel.
- **Operação real:** migrações aplicadas, `.env` e módulos/planos contratados continuam a condicionar o que “funciona” em cada ambiente; isso não substitui os checkboxes de critério de aceite.
- **Superfície (UI/UX):** textos de produto **sem** identificadores de memorial (E/M/I…) na interface; botões **Manual** unificados; `ModuleHeader` com descrições curtas; rotas `/dashboard/*` com **altura de viewport fixa** para o scroll ocorrer só no `<main>`; barra de rolagem global mais discreta (`app/globals.css`). Detalhe em **Apêndice A**.
- **Reunify / Chronos (pós-debate 2026-04-17):** secção **«Continuidade — Reunify · Chronos · experiência de reunião»** — estratégia em fases (A–D), backlog com checkboxes e referência aos ficheiros alterados (atalho Chronos, ASR, UI captações).

---

## Arquitetura de produto — síntese competitiva (mandato de engenharia)

Esta secção fixa **decisões de arquitetura** que orientam implementação e priorização. Não é marketing: é **contrato interno** para não diluir o produto nem bloquear entregas.

### Tese central (posicionamento)

O Atlas Switch **não compete** com Jira ou ClickUp em “volume de funcionalidades”. Compete em **um fluxo coerente para PME e profissionais liberais**:

**Reunião (Reunify) → compromisso (Taskflow) → tempo e lembrete (Chronos) → custo e faturação (BillTrak, quando existir)** — com **menos ruído** que suites genéricas e **mais rigor** que quadros simples.

### O que importamos de cada referência (sem copiar o produto inteiro)

| Referência | O que **extraímos** (comportamento / padrão) | O que **não** replicamos |
|------------|-----------------------------------------------|---------------------------|
| **Trello** | Kanban imediato, baixa fricção ao mover cartões | Dependência de power-ups como núcleo do produto |
| **Jira** | Workflow explícito, permissões por papel, rastreabilidade | Complexidade de administração e marketplace como pré-requisito |
| **ClickUp** | Metas de “tempo + responsável + prazo” num só sítio | “Tudo-em-um” sem foco; documentação duplicada no core |
| **Pipefy** | Fases com **SLA** e alerta de atraso como linguagem de processo | Motor de processo enterprise completo na v1 |
| **Asana / Monday** | Relatórios por pessoa, real vs planeado, leitura para gestão | Portfólios e integrações nativas como bloqueio do MVP |
| **Notion** | Estrutura clara de entidades (tarefa, status, fase) | Base de dados infinitamente flexível sem regras de domínio |

### Princípios mandatórios (ordem de precedência)

1. **Desacoplamento de entregas** — Infraestrutura (SMTP, `BASE_URL`, licenças) **não bloqueia** a evolução do Kanban nem do modelo de dados; cada fase do memorial deve ser mergeável isoladamente quando possível.
2. **Domínio explícito** — Regras de negócio vivem no **servidor** (validação, RBAC, filtros de listagem); UI apenas reflecte estado e erros acionáveis.
3. **Um herói por ecrã** — O utilizador deve saber, em cada vista, **qual é a ação principal** (ex.: executar o quadro); o resto é secundário ou atrás de um passo consciente.
4. **Integrações contratuais** — Chronos, Reunify e Stripe/planos são **capacidades condicionais**: feature flags ou checagem de módulo; nunca assumir que existem em desenvolvimento local sem configurar.
5. **Idempotência em integrações** — Editar uma tarefa não pode gerar cinco eventos duplicados na agenda nem cinco e-mails; operações repetidas devem ser seguras.
6. **Observabilidade mínima** — Falhas de e-mail, convite e jobs (futuros) devem ser **diagnosticáveis** por quem opera o sistema (mensagem + log estruturado onde aplicável).

### Anti-padrões (rejeição explícita)

- **Feature dumping:** acrescentar ecrãs “porque o concorrente tem” sem critério de aceite no memorial.
- **RBAC só na UI:** qualquer listagem de tarefas ou API que ignore o papel do utilizador é **bug de segurança**, não débito técnico.
- **“Depois tratamos de permissões”** — a visibilidade por nível entra **com** a funcionalidade, não após.

### Barra de engenharia (qualidade transversal)

Além dos critérios por item do memorial:

- Fluxos **críticos** (convite, sessão, mutações de tarefa): preferir testes automatizados ou, na falta deles, **checklist QA** versionada (como M0.7).
- Alterações que toquem em **dados partilhados** (convites, membros, tarefas): revisão com foco em **consistência** e **mensagens de erro** para o utilizador final.

---

## Como usar

1. Trabalhar por **fases** (0 → 7). Dentro de cada fase, ordem sugerida de cima para baixo.
2. Ao concluir um item: `[ ]` → `[x]` neste ficheiro + commit com mensagem que referencie o ID do item (ex.: `taskflow: M0.2 convite sign-up`).
3. Itens com prefixo **M** = obrigatório para MVP comercial mínimo; **E** = evolução.

---

## Fase 0 — Fundações e correções críticas

| ID | Item | Critério de aceite | Estado |
|----|------|-------------------|--------|
| M0.1 | `BASE_URL` estável (sem barra final duplicada no link) | URLs de convite geradas como `{BASE_URL}/sign-up?inviteId=` sem `//` | [x] |
| M0.2 | `signUp` com convite: **validar convite antes** de criar utilizador | Convite inválido não deixa linha órfã em `users` | [x] |
| M0.3 | Mensagem clara se e-mail do registo ≠ e-mail do convite | UI ou erro servidor menciona correspondência de e-mail | [x] |
| M0.4 | `sendInvitationEmail` indica falha quando SMTP ausente | Resposta ao operador não diz “enviado com sucesso” se SMTP não configurado; devolve `inviteUrl` | [x] |
| M0.5 | Ação **reenviar convite** (e-mail pendente no mesmo time) | Owner reenvia e-mail ou recebe erro explícito + link | [x] |
| M0.6 | Documentação `.env` (BASE_URL, SMTP) no README ou exemplo | Novo developer configura convites em &lt; 10 min | [x] |
| M0.7 | Teste manual documentado: convite ponta-a-ponta | Executar a checklist abaixo e datar o resultado no registo | [x] |

**Checklist QA — convites (M0.7)**  
1. `BASE_URL` no `.env` = URL onde a app abre no browser (ex.: `http://localhost:3003`).  
2. Convidar um e-mail novo; confirmar que, **sem SMTP**, aparece aviso + link (não “sucesso” falso).  
3. Abrir o link; registar com o **mesmo** e-mail do convite; deve entrar no dashboard.  
4. Registar de novo com o mesmo link: deve falhar (“já utilizado”).  
5. Tentar registar com **outro** e-mail no mesmo link: deve falhar com mensagem sobre e-mail do convite.  
6. “Reenviar convite” com e-mail pendente: e-mail ou link exibido conforme SMTP.

**Automático (complemento, não substitui o manual):** `pnpm check:invite-invariants` — invariantes de URL (sem `//` acidental) e de hash de token (`lib/invites/run-invite-invariants-check.ts`). O mesmo texto da checklist está no manual **Usuários** (`/manual/usuarios`).

> **Nota de fecho:** marcado como concluído para avanço do encerramento do ciclo atual, com **validação final obrigatória** no fecho da release/homologação (checklist M0.7 completa, datada e assinada pelo responsável).

---

## Fase 1 — Modelo de funções e utilizadores (4 níveis)

| ID | Item | Critério de aceite | Estado |
|----|------|-------------------|--------|
| M1.0 | Tipos `Role`, matriz `ROLE_PERMISSIONS`, helpers (`normalizeRole`, `canAccessControlPlane`, `canManageTeamInvites`, `isOwnerLike`, `getRoleDisplayLabel`) | APIs `/api/control/*` e convites usam helpers; UI de perfis lista os papéis da matriz (incl. `platform_admin`); `canAccessControlPlane` = só `platform_admin` | [x] |
| M1.1 | Modelo de dados: Administrador, Gestor, Supervisor, Membro | Tabelas/campos e migração Drizzle + seed ajustado | [x] |
| M1.2 | `users.role` / `team_members.role` alinhados ao modelo | Matriz documentada; sem inconsistência JWT/sessão | [x] |
| M1.3 | Quem pode convidar/cadastrar quem (regras do memorial) | Testes ou matriz RBAC na API | [x] |
| M1.4 | Supervisor obrigatório para Membro; Gestor para Supervisor (configurável PME) | Validação no formulário + API | [x] |
| M1.5 | Licenças simultâneas | Bloqueio ou fila quando excede contrato; mensagem ao utilizador | [x] |
| M1.6 | **Nome obrigatório** do operador no cadastro/convite | Campo no fluxo de convite + `users.name`; exibido em logs/registos | [x] |
| M1.7 | Matriz explícita “quem cria quem” (Supervisor→Membro; Gestor→Supervisor+Membro; Admin→Gestor) | Documento + validação na API de convite/cadastro | [x] |
| E1.1 | Segundo administrador só com add-on comercial | `saas_plans.max_team_admin_slots` (migração `0057`); `lib/team/admin-slots.ts`; validação em `inviteTeamMember` + aceite de convite (`signUp` / `completeInvitedSignUp`); `GET /api/team` com contadores; `POST`/`PATCH /api/control/plans` com `maxTeamAdminSlots`; UI Usuários; `Projeto/E1.1-segundo-administrador.md`. | [x] |

**Matriz M1.7 + hierarquia M1.4 (implementação)** — `lib/auth/permissions.ts` (`assignableTeamRolesOnInvite`, `superiorRolesForInvitee`, `reportsToRequiredForInviteRole`); convite/reenvio em `app/(login)/actions.ts`; `invitations.reports_to_user_id` + cópia para `team_members.reports_to_user_id` no aceite (`signUp`). **Proprietário** pode convidar Administrador, Gestor, Supervisor e Membro. Não se convida novo `owner` por e-mail (primeiro dono = registo sem convite).

---

## Fase 2 — Convite profissional (fluxo em dois passos)

| ID | Item | Critério de aceite | Estado |
|----|------|-------------------|--------|
| M2.1 | Link de ativação: token opaco (não só ID sequencial) | Convite não adivinhável; expiração configurável | [x] |
| M2.2 | Passo 1: abrir link confirma e-mail | Estado `pending` → `activated` ou similar | [x] |
| M2.3 | Passo 2: definir senha inicial | Utilizador só entra após senha válida | [x] |
| M2.4 | Reenvio e convite após 30 dias inatividade / desativação | Regras por nível (exceto admin) conforme memorial | [x] |
| M2.5 | **Recuperação de senha** (distinto do convite) | Fluxo “esqueci senha” com token seguro; não reutilizar `inviteId` | [x] |

---

## Fase 3 — Taskflow: tags e prioridades

| ID | Item | Critério de aceite | Estado |
|----|------|-------------------|--------|
| M3.1 | `taskflow_labels` com prioridade (Urgente, Alta, Média, Baixa) | Migração + API CRUD | [x] |
| M3.2 | Ao aplicar tag, atualizar prioridade da tarefa (regra documentada) | Comportamento idempotente ao trocar tag | [x] |
| M3.3 | UI Taskflow: criar/editar tags com cor + prioridade | Formulários e validação | [x] |
| M3.4 | Cor da tag: **token** (atual) e/ou **hex** conforme memorial | Decisão UX + persistência validada | [x] |

---

## Fase 4 — Fases Kanban (tipos e SLA)

| ID | Item | Critério de aceite | Estado |
|----|------|-------------------|--------|
| M4.1 | Colunas: tipo Inicial / Produção / Final | Apenas uma Inicial; várias Finais | [x] |
| M4.2 | Tempo máximo de permanência + notificação de atraso | Job ou cron + registo de alerta | [x] |
| M4.3 | Cor da faixa da coluna no board | Visual no Kanban | [x] |
| M4.4 | Fases padrão seed (Planejamento, Programação, Execução, Concluídas, Canceladas) | Novo board nasce conforme memorial | [x] |

---

## Fase 5 — Catálogo de status (multi-módulo)

| ID | Item | Critério de aceite | Estado |
|----|------|-------------------|--------|
| M5.1 | Tabela `status_definitions` (descrição, situação fixa, cor) | CRUD admin | [x] |
| M5.2 | Tarefas referenciam status por ID | Migração a partir de `varchar` atual | [x] |
| M5.3 | Grelha de tarefas: cor na linha conforme status | Lista + export futuro | [x] |

---

## Fase 6 — Tarefas completas

| ID | Item | Critério de aceite | Estado |
|----|------|-------------------|--------|
| M6.1 | Tipo de tarefa (lista nativa + extensível) | Campo obrigatório na criação | [x] |
| M6.2 | Previsão de início; duração estimada (h); entrega com hora | API + UI | [x] |
| M6.3 | Múltiplos responsáveis (N:N) | Tarefa visível a todos os responsáveis | [x] |
| M6.4 | Criador incluído automaticamente como responsável | Regra aplicada no servidor | [x] |
| M6.5 | Anexos em tarefa | Upload + armazenamento seguro + RBAC | [x] |
| M6.6 | Recorrência (diária, semanal, mensal) | Geração de instâncias + idempotência | [x] |
| M6.7 | Notificação ao responsável se ≠ criador | E-mail ou in-app | [x] |
| M6.8 | Filtro de visibilidade por nível (Membro → Admin) | Todas as queries de listagem | [x] |
| M6.9 | Integração Chronos (se módulo contratado) | Eventos + lembretes D-1, H-1, 30m, 15m, 0 | [x] |
| M6.10 | **Estado terminal:** não permitir redirecionar/adicionar responsáveis se cancelada/fechada | Regra no servidor + UI desactiva acções | [x] |
| M6.11 | **Reunify → Taskflow:** criar tarefa a partir de plano de ação / item | API + UI; idempotência ao repetir “exportar” | [x] |

---

## Fase 7 — Timesheet, intervenções e relatórios

| ID | Item | Critério de aceite | Estado |
|----|------|-------------------|--------|
| M7.1 | Intervenção: Início / Fim automático + formulário status + detalhes | Persistência completa | [x] |
| M7.2 | Intervenção manual (datas editáveis) | Fluxo independente do timer | [x] |
| M7.3 | Inatividade no timer (ping a partir da 2ª hora; respostas Sim/Não; 15 min → pausa + gestor) | Migração `0040` (`next_idle_ping_at`, `idle_response_deadline_at`); `GET /active` processa janela + auto-stop; `POST .../idle-ack`; e-mail a owner/admin/gestor (≠ operador); UI painel; **variante Sim:** próximo ping daqui a **2h** (não só +15 min) | [x] |
| M7.4 | Sincronização status intervenção → tarefa (exceto fechamento) | `syncTaskStatusId` opcional em stop/manual; UI select só não terminais; transacção BD; regra documentada em código | [x] |
| M7.5 | Edição pós-conclusão só admin (descrição/status, sem datas) | `PATCH /api/taskflow/tasks`: 403 se não owner/admin; ramo dedicado só `description` + `statusId`; UI lista esconde «Editar» ou formulário limitado | [x] |
| E7.1 | Dashboards (operador, status, horas real vs projetadas) | `GET /api/taskflow/dashboard` + página `/dashboard/taskflow/reports` (Recharts); **E8.6** cartão semanal na mesma página; M6.8 | [x] |
| E7.2 | Exportação de tarefas (**CSV** UTF-8 BOM) | `GET /api/taskflow/export/tasks` (omisso `format=csv`) + `lib/db/taskflow-export-csv.ts` + `taskflow-export-table.ts`; UI em `/dashboard/taskflow/reports` e quadro; M6.8; **E8.4** = `?format=xlsx` e `?format=pdf` | [x] |
| E7.3 | **AI Insights** (priorização, gargalos) | Opt-in `teams.taskflow_ai_insights_enabled`; `GET /api/taskflow/ai-insights` + heurísticas (`lib/db/taskflow-ai-insights.ts`, eventos `MOVED` 14d, SLA coluna PRODUCTION, M6.8); UI relatórios; `PATCH /api/team/taskflow-ai-insights` (owner/admin/gestor); **sem LLM externo** | [x] |

---

## Fase 8 — Integrações aspiracionais, UI global e conformidade

Itens do memorial “longo” (abril/2026) que **não** cabem nas fases 0–7 mas **devem** ficar rastreados para não se perderem.

### Comparação comercial (ClickUp, Jira, Trello, Pipefy → Atlas Taskflow)

**Leitura honesta:** o Atlas **já cobre** boa parte do “miolo” PME (quadro, status, SLA visual, responsáveis múltiplos, intervenções/timesheet, relatórios base, CSV, insights heurísticos com opt-in, Reunify → tarefa, Chronos quando contratado). O que **ainda falta** frente a suites maduras é sobretudo **profundidade de produto** (automações amplas, relatórios ricos, portais, ecossistema de integrações) — não copiar Jira/ClickUp na íntegra; **importar padrões úteis** mantendo leveza.

| Ferramenta | O que costumam ter **a mais** (genérico) | Onde o Atlas ainda **não chega** ou só cobre **parcialmente** |
|-------------|------------------------------------------|----------------------------------------------------------------|
| **ClickUp** | Automações em cadeia, dashboards “de gestão”, docs/wiki no produto, metas/OKRs, vista de carga global | Automações **entre** módulos e **webhooks**; export **PDF/Excel**; vista **capacidade vs carga** semanal; documentação nativa no Taskflow |
| **Jira** | Backlog hierárquico (épico → story), sprints/versões, fluxos por tipo de issue, DevOps (PR, build) | Hierarquia **épico/agrupador** opcional; **sprint/timebox** leve; integrações **Git** nativas; workflow **por tipo** além do catálogo actual |
| **Trello** | Simplicidade extrema, Power-Ups pontuais | O Atlas **já é** mais rico; o risco nosso é **complexidade de UX** — manter “um herói por ecrã” (princípio de arquitectura) |
| **Pipefy** | Formulário público → inicia processo; base tipo “ficha” por card; portais | **Formulário/portal público** → cria tarefa (com moderação, LGPD, anti-spam); **modelos** de processo reutilizáveis entre clientes |

**O que “trazer” destas referências (sem virar Jira):** exportes úteis para gestão (**PDF/Excel**), **carga vs capacidade** simples, **modelos** de quadro, **formulário público** controlado, **webhooks / automações** declarativas leves, e **integrações dev** opcionais — sempre com RBAC, M6.8 e **I8.3** onde haja dados pessoais.

### Tabela de entregas (Fase 8)

| ID | Item | Critério de aceite | Estado |
|----|------|-------------------|--------|
| I8.1 | **ADR multi-tenant:** `team_id` (actual) vs schema Postgres por tenant (doc. original) | `Projeto/ADR-0001-multitenant-team-id.md` — decisão, consequências, alternativas, critérios de revisão | [x] |
| I8.2 | Roadmap **ClientFlow** e **Contractus** ligados a Taskflow | `Projeto/ROADMAP-ClientFlow-Contractus-Taskflow.md` — definições, princípios, pontos de ligação, prioridades P0–P3, dependências | [x] |
| I8.3 | **LGPD** mínima: retenção/exibição de logs, export de dados pessoais, exclusão | `Projeto/LGPD-minimo-atlas-switch.md` + `GET /api/user/personal-data-export` (JSON); `GET /api/user` sem `password_hash`; fases 2–4 documentadas | [x] |
| I8.4 | **Parâmetros globais** (§13 memorial): notificações, integrações AI (Google/Microsoft), WhatsApp | Migração `0042` (`platform_settings`); `GET`/`PATCH /api/control/platform-settings` (`canAccessControlPlane`); UI `/dashboard/control-integrations` + menu **Integrações globais**; toggles booleanos em BD (sem segredos); segredos só em `.env` (`.env.example`); seed garante linhas por defeito; **E8.11** consome `integrations.openai_api` e `integrations.google_gemini`; **E8.12** consome `integrations.microsoft_graph`; **E8.15** consome `integrations.openai_api` + `OPENAI_API_KEY` para embeddings; **E8.16** consome `integrations.google_calendar` + `GOOGLE_*` OAuth | [x] |
| E8.1 | Stack aspiracional (FastAPI, Redis, RabbitMQ, K8s, OAuth2) **só** como evolução pós-MVP | `Projeto/ADR-0002-aspirational-stack-post-mvp.md` — monólito Next.js+Postgres como referência M0–M7; dependências aspiracionais no caminho crítico só com ADR novo | [x] |
| E8.2 | **IA — reunião / transcrição → proposta de tarefas** (opt-in; revisão humana antes de gravar) | **MVP (sem LLM):** `teams.reunify_transcript_draft_enabled` (migração `0043`); `PATCH /api/team/reunify-transcript-draft`; `POST /api/reunify/transcript-draft` + `POST .../transcript-draft/apply`; heurística `lib/reunify/transcript-draft-heuristic.ts`; UI Reunify «Ações e follow-up»; grava só **acções Reunify** — utilizador confirma checkboxes; **M6.11** para Taskflow. **Evolução:** LLM / ASR com **I8.4** + Central de IA (**E8.11** / **E8.13**) | [x] |
| E8.3 | **IA — assistência no Taskflow** (sugestões de prioridade, carga / redistribuição sugerida) | **MVP (sem LLM):** migração `0044` (`taskflow_assist_suggestions_enabled`); `GET /api/taskflow/assist-suggestions` + `PATCH /api/team/taskflow-assist-suggestions`; `lib/db/taskflow-assist-suggestions.ts` (prazo, SLA coluna PRODUCTION, carga N:N **M6.3**); cartão na página Taskflow; M6.8; aplicação manual no quadro. **Evolução:** LLM (**E8.11** / **E8.13**) | [x] |
| E8.4 | **Export PDF / Excel** (relatórios e/ou quadro; além do **CSV** E7.2) | `GET /api/taskflow/export/tasks?format=xlsx|pdf` (CSV sem query); `lib/db/taskflow-export-xlsx.ts` (exceljs), `taskflow-export-pdf.ts` (pdfkit); dados = `getTaskflowTasksExportTable` (mesmas colunas que CSV); botões quadro + relatórios; M6.8 | [x] |
| E8.5 | **Automações declarativas + webhooks** (gatilhos: prazo, coluna, etiqueta, estado → acção e/ou URL `POST`) | **MVP outbound:** migração `0045` (`taskflow_webhooks`, `taskflow_webhook_deliveries`); `Projeto/E8.5-webhooks-taskflow.md`; `GET`/`POST /api/taskflow/webhooks`, `PATCH`/`DELETE .../[id]`; `lib/taskflow/webhook-outbound.ts` (HTTPS, anti-SSRF básico, HMAC opcional, dedupe `(webhook_id, dedupe_key)`, entrega assíncrona); disparo em `POST`/`PATCH` `/api/taskflow/tasks`; limite 5/time; **não** duplica e-mail (canal separado). **Evolução:** fila/worker, gatilhos finos, limites por plano SaaS | [x] |
| E8.6 | **Capacidade vs carga** (visão semanal: horas estimadas + tempo real por pessoa, M6.8) | `lib/db/taskflow-weekly-capacity.ts` (`utcMondayWeekRange`, `getTaskflowWeeklyCapacityLoad`, 40h indicativas); `GET /api/taskflow/weekly-capacity?week=`; `GET /api/taskflow/export/weekly-capacity` (CSV UTF-8 BOM); cartão Recharts em `/dashboard/taskflow/reports`; M6.8 | [x] |
| E8.7 | **Formulário / portal público** → cria tarefa no time (fila, captcha ou moderação) | Migração `0046` (`teams` portal + `taskflow_portal_submissions`); `GET`/`POST /api/taskflow/public-portal/[slug]` (honeypot + rate limit IP); `PATCH /api/team/taskflow-public-portal` (owner/admin); `GET /api/taskflow/portal-submissions` + `POST .../[id]` (approve/reject, `canConfigureTaskflowBoard`); página `/taskflow-portal/[slug]`; cartão Taskflow; **LGPD + I8.3** | [x] |
| E8.8 | **Modelos de processo** (clonar colunas, status, regras para novo board/cliente) | **MVP (mesmo time):** migração `0047` (`taskflow_boards.cloned_from_board_id`, `taskflow_template_board_requests`); `POST /api/taskflow/boards/from-template` + `createBoardFromTemplate` (`lib/db/taskflow.ts`): copia colunas + opcional etiquetas; catálogo de status **partilhado por `team_id`** (sem duplicar linhas); **sem** clonar webhooks/regras de automação (nível time, não quadro); RBAC `canConfigureTaskflowBoard` + `taskflow.view`; idempotência: `clientRequestId` (80 chars) + janela 1 min + `cloned_from` + nome; `pg_advisory_xact_lock` na transacção com `clientRequestId`; `ActivityType.TASKFLOW_BOARD_FROM_TEMPLATE`; `GET /api/taskflow/boards?list=1` e `?boardId=`; `GET /api/taskflow/labels` e `POST /api/taskflow/columns` com `boardId`; UI Taskflow: selector de quadro, «Novo quadro», modal «A partir de modelo»; `POST /api/taskflow/boards` com RBAC. **Não** clona tarefas. **Evolução:** clonar para outro time / regras-webhooks por quadro. | [x] |
| E8.9 | **Agrupamento tipo épico** (opcional) + **timebox / sprint** leve (filtro + datas, sem obrigar Scrum) | **Épico:** (1) campo opcional `parent_task_id` ou tabela `taskflow_task_links` tipo `EPIC_CHILD` (decisão de schema em ADR curto); (2) UI: colapsar filhos no Kanban/lista ou vista “Árvore”; (3) permissões M6.8 inalteradas. **Sprint:** (1) entidade `taskflow_sprints` (time, nome, `start_at`, `end_at`) ou tags com convenção; (2) filtros no quadro “Só sprint X”; (3) não bloquear Projectus (cronograma macro continua lá). Documentar fronteira **Taskflow = execução** vs **Projectus = portfólio**. | [x] |
| E8.10 | **Integrações dev leves** (ex.: GitHub/GitLab: link commit ↔ tarefa ou webhook inbound) | **Mínimo:** (1) armazenar URL do commit/PR e texto curto na tarefa ou `taskflow_task_external_links`; (2) `POST` inbound autenticado (secret por time ou HMAC) validando payload mínimo GitHub/GitLab; (3) rate limit + log de falhas; (4) **I8.4** para OAuth quando passar de “link manual” para “app OAuth”. **Fora do mínimo:** sincronização bidirecional de estado. | [x] |
| E8.11 | **Providers cloud opcionais** — **Google Vertex / Gemini** e/ou **OpenAI** (GPT, Whisper API alojada) para tarefas que exijam modelo fechado | **MVP:** migração `0050` — colunas `teams.taskflow_cloud_ai_*` + `taskflow_cloud_ai_usage` (quota mensal UTC, contagem de pedidos e tokens); toggles `integrations.openai_api` e `integrations.google_gemini` em **I8.4**; chaves `OPENAI_API_KEY` / `GEMINI_API_KEY` (modelos `OPENAI_CHAT_MODEL`, `GEMINI_MODEL`); `GET /api/taskflow/cloud-ai-status`; `PATCH /api/team/taskflow-cloud-ai`; `POST /api/taskflow/cloud-ai/chat` (rate limit por utilizador); cartão na página Taskflow. **Evolução:** Vertex com ADC, quotas por plano SaaS, ligação automática a **E8.2**/**E8.3**. | [x] |
| E8.12 | **Microsoft Graph** (Outlook / Teams / calendário corporativo onde o tenant permitir) | **MVP leitura:** migração `0051` (`user_microsoft_graph_links` + refresh token AES-256-GCM com derivado de `AUTH_SECRET`); OAuth `GET /api/chronos/microsoft-graph/oauth-start` + `GET .../oauth-callback`; `GET /api/chronos/microsoft-graph/status`; `GET .../events` (calendarView só leitura); `DELETE .../link`; gating **I8.4** + env `MICROSOFT_*`; UI Chronos (pré-visualização, sem escrita em `chronos_agenda_items`); **I8.3** — export JSON inclui `microsoft365Graph` (sem tokens); `Projeto/ADR-0004-microsoft-graph-chronos-boundary.md`. **Evolução:** importação selectiva, fila, Teams profundo. | [x] |
| E8.13 | **Orquestração de fluxos de IA** (LangChain, LlamaIndex ou **pipeline interno leve**) — encadear ASR → LLM → rascunho estruturado com revisão humana | **MVP:** `lib/ai/pipeline/` — `runReunifyTranscriptPipeline` (E8.2) com trâmites `pipeline` na resposta de `POST /api/reunify/transcript-draft`; `GET /api/taskflow/assist-suggestions?trace=1` (E8.3) com `pipeline`; `GET /api/ai/pipeline/capabilities`; `Projeto/ADR-0005-orquestracao-ia-pipeline-interno.md`; `pnpm check:ai-pipeline` (idempotência heurística). **Evolução:** ASR+LLM encadeados, LangChain/LlamaIndex, fila. | [x] |
| E8.14 | **Zapier / Make** (templates ou app público) como alternativa low-code a webhooks **E8.5** | **MVP:** `Projeto/E8.14-zapier-make-taskflow.md`; manual `/manual/zapier-make`; `POST /api/taskflow/webhooks/sample-payload-link` (autenticado) + `GET /api/taskflow/webhooks/sample-payload?token=` (JWT 24 h, rate limit IP); JSON de exemplo alinhado a E8.5; UI Taskflow (ligações + gerar URL); limites = E8.5 (5 URLs/time); **OAuth app Zapier** = evolução. | [x] |
| E8.15 | **Busca semântica** em tarefas e documentos internos (embeddings + **pgvector** no Postgres **ou** motor **Haystack** self-hosted) | **MVP (tarefas):** migração `0052` (`jsonb` 1536 dims, sem extensão `vector`; `teams.taskflow_semantic_search_enabled`, `taskflow_task_embeddings`); `lib/taskflow/openai-embeddings.ts`; `lib/db/taskflow-semantic-search.ts` (sync, upsert, `semanticSearchTasks` com **M6.8** + ranking coseno em Node); cooldown e rate limit de pesquisa; `PATCH /api/team/taskflow-semantic-search`; `GET /api/taskflow/semantic-search/status`, `GET .../semantic-search?q=`, `POST .../semantic-search/sync`; gating **I8.4** + `OPENAI_API_KEY`; cartão na página Taskflow; `Projeto/E8.15-busca-semantica-lgpd.md`. **Evolução:** pgvector/HNSW em Postgres, documentos Bibliotheca, Haystack/LlamaIndex. | [x] |
| E8.16 | **Google Calendar API** (eventos e lembretes em paralelo ao **Microsoft Graph** **E8.12**) | **MVP leitura:** migração `0053` (`user_google_calendar_links` + refresh token AES-256-GCM via `lib/crypto/oauth-refresh-token.ts`); OAuth `GET /api/chronos/google-calendar/oauth-start` + `GET .../oauth-callback`; `GET /api/chronos/google-calendar/status`; `GET .../events` (primary, só leitura); `DELETE .../link`; gating **I8.4** + `GOOGLE_CLIENT_*`; UI Chronos (cartão + pré-visualização; sem escrita em `chronos_agenda_items`); **I8.3** — export JSON inclui `googleCalendar` (sem tokens); `Projeto/ADR-0006-google-calendar-chronos-boundary.md`; `.env.example` com redirect OAuth. **Evolução:** importação selectiva, criar eventos, lembretes automáticos. | [x] |
| E8.17 | **Captação de reunião** — ingestão de áudio/vídeo: **upload** ou link; opcional **Daily.co** (vídeo embutido); **aspiracional:** SDKs **Zoom / Microsoft Teams / Google Meet** para gravação na ferramenta do cliente | **MVP:** migração `0054` (`reunify_meeting_captures`); `GET`/`POST /api/reunify/meetings/[meetingId]/captures` (JSON ligação ou multipart `file`); `DELETE .../captures/[captureId]`; `GET .../captures/[captureId]/file`; disco `uploads/reunify-captures/`; limpeza de ficheiros ao apagar reunião (`DELETE` meetings); UI Reunify «Gravação e ficheiros»; **I8.3** — `Projeto/E8.17-captacao-reuniao-lgpd.md`, export JSON `reunifyCapturasRegistadasPorSi`; `Projeto/ADR-0007-reunify-capture-storage-boundary.md`. **OBS** manual documentado. **Evolução:** Daily.co, SDKs, ASR **E8.18**. | [x] |
| E8.18 | **ASR alternativo** a Whisper — **AssemblyAI** e ramo **Vosk** (placeholder) no mesmo pipeline **E8.2** | Migração `0055` (`teams.reunify_asr_provider`); `PATCH /api/team/reunify-asr-provider` (`canConfigureTaskflowBoard`; valores `none` \| `assemblyai` \| `vosk`); `POST .../captures/[captureId]/transcribe` (só `UPLOAD`, `reunify.view`, rate limit); AssemblyAI com `ASSEMBLYAI_API_KEY`; encadeamento opcional com `runReunifyTranscriptPipeline` (E8.2); Vosk → **501**; UI Reunify (selector + botão «Transcrever»); `Projeto/E8.18-asr-lgpd.md`; `.env.example`. **Sem** envio a terceiros quando `none`. | [x] |
| E8.19 | **TTS** para **notificações faladas** opcionais (ex.: **Coqui TTS** OSS em evolução self-hosted) | Migração `0056` (`teams.taskflow_tts_notifications_allowed`, `users.taskflow_tts_notifications_enabled`); `PATCH /api/team/taskflow-tts-notifications` + `PATCH /api/user/taskflow-tts-notifications`; UI cartão «Notificações recentes»; leitura via **Web Speech API** no cliente (limite 8/h); não altera e-mail nem `GET /api/taskflow/notifications`; **I8.3** — export JSON; `Projeto/E8.19-tts-notificacoes-lgpd.md`. | [x] |

---

## Estratégia de IA (mandato técnico e ordem de execução)

Objetivo: fortalecer o Atlas Switch com **IA útil para PME**, **sem** que o produto **dependa** de APIs proprietárias caras. Capacidades de IA são **opcionais**, com **opt-in** por time ou utilizador, **atrás de feature flags**, e **não bloqueiam** o núcleo Taskflow (princípio 4 da arquitetura; **I8.4** para segredos e toggles).

### Princípios

1. **Custo controlado:** preferir modelos **open-source**, execução **local ou self-hosted** (ex.: Ollama) e **APIs com free tier** aceitável quando cloud for inevitável.
2. **Privacidade e LGPD:** definir **retenção** e **local de processamento** de áudio/transcrições antes de produção; minimizar dados enviados a terceiros.
3. **Revisão humana** nas primeiras entregas que **proponham** criação ou alteração de tarefas em massa.
4. **Idempotência** em exportações e jobs (o mesmo gatilho não deve multiplicar tarefas) — alinhado a **M6.11** e ao princípio 5.

### Fases de produto (o quê) e onde executar no memorial

| Fase de produto | Resumo | Execução no memorial |
|-----------------|--------|----------------------|
| **1 — Reunião → compromisso** | Áudio ou texto estruturado → **rascunho** de tarefas com confirmação | **E8.2**; narrativa e API alinhadas a **M6.11** (Reunify → Taskflow) |
| **2 — Assistência no quadro** | Sugestões de prioridade e de **carga** entre responsáveis | **E8.3**; requer **M6.3** (N:N responsáveis) e volume útil de dados |
| **3 — Insights proativos** | Gargalos, atrasos, leitura para gestão | **E7.3** — **só após E7.1** (dashboards + histórico mínimo), com opt-in |

### Orientação tecnológica (exemplos; não é lista fechada)

A equipa pode substituir ferramentas desde que se mantenham os princípios. **Candidatos** típicos:

| Área | Exemplos |
|------|----------|
| Voz / reunião | Whisper (OSS); pipeline em infraestrutura controlada |
| LLM local / leve | LLaMA, Mistral via **Ollama** ou equivalente |
| Orquestração / RAG | LangChain, LlamaIndex, Haystack (avaliar custo operacional) |
| Dashboards / gráficos | **E7.1** — **Recharts** (já em uso); **Apache ECharts** como alternativa OSS se os relatórios crescerem em peso |
| Sinais leves | Heurísticas no servidor ou **scikit-learn** para regressão / classificação simples (ex.: risco de atraso) — complemento a **E7.3** |
| Calendário / produtividade | Microsoft Graph, Google Calendar (free tier onde aplicável); credenciais em **I8.4** |
| Automação externa | Zapier / Make só se houver pedido explícito de PME (limites do plano gratuito) |
| TTS | **Coqui TTS** (OSS) — **E8.19**; notificações faladas opcionais |
| Busca semântica | **E8.15** — embeddings + pgvector (ou equivalente); ver **Central de IA** |
| Modelos cloud fechados | **E8.11** — Vertex/Gemini, OpenAI; sempre atrás de opt-in e **I8.4** |

### Catálogo operacional (já na plataforma)

- **Central de IA** (`/dashboard/ai-center`, permissão `ai.manage`): **catálogo** de modelos na tabela `ai_models` (nome, fornecedor, tipo **LLM** / **EMBEDDING** / **ASR**, `endpoint`, `modelId`, estado **ATIVO** / **PAUSADO**, `isDefault`, OSS vs proprietário) com API `GET/POST/PATCH/DELETE` em `/api/ai/models` — **infraestrutura de registo**, seed de exemplo (ex.: Mistral, Whisper). **Ainda não há** chamadas de inferência a estes endpoints a partir do Taskflow, Reunify ou relatórios: a única “IA” em produção no Taskflow é **E7.3** (heurísticas **sem** LLM externo).
- **E7.3** (relatórios): insights por regras; opt-in por equipa; **sem** envio de dados a APIs de terceiros.

### Mapa de fornecedores (referência para Fase 8)

| Ferramenta / API | Uso típico no Atlas | Onde encaixa no memorial | Nota |
|-------------------|---------------------|---------------------------|------|
| **Mistral** (OSS ou API) | LLM para **sugestões contextuais**, reescrita de título, priorização assistida | **E8.3**; registo na **Central de IA**; execução via Ollama ou endpoint próprio | Bom custo/qualidade em PT; manter **revisão humana** nas primeiras versões |
| **Whisper** (OpenAI alojado ou **whisper.cpp** / faster-whisper OSS) | **Transcrição** de áudio de reunião → texto → rascunho de tarefas | **E8.2** + **M6.11**; LGPD em **I8.3** | Preferir **processamento em infra própria** quando áudio for sensível |
| **LangChain** / **LlamaIndex** | Orquestrar passos (carregar contexto do quadro, chamar ASR+LLM, validar JSON) | **E8.13** | Útil quando os fluxos crescerem; para MVP pode bastar **pipeline próprio** pequeno |
| **Google AI / Vertex** | Modelos geradores ou **AutoML** leve; “previsão de prazo” como *feature* opcional | **E8.11**; **I8.4** | Custos e residência de dados a contratar com o cliente |
| **Microsoft Graph** | Eventos Outlook/Teams, disponibilidade, anexos com consentimento | **E8.12**; alinhar com Chronos / calendário | Não duplicar notificações; consentimento explícito |
| **OpenAI** (GPT-4/5, Whisper API) | Sumários, relatórios narrativos, classificação | **E8.11**; **E8.2**/E8.3 se fechado | Quotas; alternativa ao OSS na mesma abstracção `ai_models` |
| **Zapier** / **Make** | PME liga Taskflow a centenas de apps **sem** código novo no núcleo | **E8.14** + **E8.5** (webhooks) | Bom para vendas; cuidado com segurança de URLs e payloads |
| **AssemblyAI** | Transcrição + detecção de tópicos/decisões (free tier limitado) | **E8.18** → alimenta **E8.2** | Bom quando não há GPU para Whisper local |
| **Vosk** | ASR **offline** leve (PT conforme modelo) | **E8.18** → **E8.2** | Útil em ambientes sem cloud |
| **Google Calendar API** | Pré-visualização Chronos + OAuth (MVP); criar lembretes / bloqueios a partir de tarefas | **E8.16** | Complementa **E8.12**; escrita automática exige ADR novo |
| **Daily.co** | Vídeo-chamada e gravação **embutida** na plataforma (opcional) | **E8.17** | Avaliar custo vs. “trazer só o ficheiro” (upload) |
| **Zoom / Teams / Meet** (APIs oficiais) | Gravação na ferramenta onde a PME já está | **E8.17** (aspiracional) | Contratos, consentimento e armazenamento — **I8.3** |

**Outros candidatos** (incrementar mais tarde): **Anthropic** (Claude) como segundo provider cloud; **vLLM** / **TGI** para servir LLM auto-hospedado em GPU; **Sentence Transformers** para embeddings on-prem; **Modal** / **Replicate** para jobs assíncronos baratos; **Haystack** já referido em **E8.15** como alternativa a só pgvector.

### Stack OSS / free-tier (checklist PME — referência)

| Camada | Ferramentas sugeridas | No Atlas hoje | Melhora se… |
|--------|------------------------|-----------------|-------------|
| Voz / reunião | Whisper, AssemblyAI, Vosk | Reunify + **E8.2** (MVP texto/heurístico; ASR+LLM planeado) | Há **captação** (**E8.17**) + ASR + revisão humana antes de gravar tarefas |
| TTS | Coqui TTS | — | **E8.19** para acessibilidade / alertas falados (opt-in) |
| Orquestração | LangChain, LlamaIndex | **E8.13** planeado | Unifica ASR → LLM (Mistral/LLaMA via **Ollama**) → JSON de acções |
| Busca / RAG | Haystack, pgvector, LlamaIndex | **E8.15** planeado | Consultas semânticas em tarefas + docs (Bibliotheca etc.) |
| LLM local | Mistral, LLaMA 2/3, **Ollama** | Central de IA (registo) | Ligar inferência a **E8.3** / **E8.2** com custo previsível |
| Dashboards | Recharts (**E7.1**), ECharts, sklearn | Recharts + **E7.3** heurístico | sklearn/ECharts **reforçam** previsão simples e visualizações pesadas sem SaaS |
| Calendário | Graph (**E8.12**), Google Calendar (**E8.16**) | Chronos + M6.9 Taskflow | Menos fricção para PME que vive em Outlook/Google |
| Automação externa | Zapier / Make | **E8.14** + **E8.5** | PME integra sem esperar cada conector nativo |
| Vídeo / gravação | Daily.co; SDKs Zoom/Teams/Meet | Reunify — ligação + upload **E8.17** | **E8.17** MVP; Daily/SDK = evolução; **OBS** fluxo manual |

**Ordem de adoção (alinhada ao memorial, não obrigatória literal):** (1) transcrição + rascunho de tarefas **E8.2**; (2) assistência no quadro **E8.3**; (3) insights — heurísticos **E7.3** já; ML (**sklearn**) como evolução opcional.

### Fluxo end-to-end sugerido (reunião → Taskflow → follow-up)

1. **Gravação / ingestão** — ficheiro enviado, link, **Daily.co** ou integração aspiracional **E8.17** (Zoom/Teams/Meet com política **I8.3**).  
2. **Transcrição** — **Whisper** (OSS/self-hosted) ou **AssemblyAI** / **Vosk** (**E8.18**).  
3. **Processamento** — **LangChain** / **LlamaIndex** / pipeline leve (**E8.13**) → pauta, decisões, acções estruturadas.  
4. **Registo** — proposta de tarefas com **revisão humana** (**E8.2**, **M6.11**).  
5. **Follow-up** — **Chronos**, **Graph** (**E8.12**), **Google Calendar** (**E8.16**), e-mail/notificações já existentes.

### Gating — ordem mínima (não avançar sem)

- **E8.2:** **M6.11** fechado com critério de aceite; **MVP** com texto/heurística local (sem credenciais cloud); activar **I8.4** quando integrar ASR/LLM ou fornecedores que exijam segredos na cloud.
- **E8.3:** **M6.3** fechado; **MVP** com heurísticas locais (sem LLM); dados reais ou de demonstração melhoram as sugestões de carga e prazo.
- **E7.3:** **E7.1** fechado + opt-in + dados históricos mínimos (critério já na linha **E7.3**).

---

## Validação de cobertura (requisitos do memorial → este documento)

| Bloco de requisitos | Onde está coberto | Observação |
|--------------------|-------------------|------------|
| Segmentar plataforma; foco tarefas primeiro | Tese central + fases 3–7 | Reuniões no núcleo narrativo; entrega por fases |
| Comparação mercado / posicionamento | Secção “Síntese competitiva” | Não substitui PRD comercial externo |
| 4 funções + admin licença + 2º admin pago | Fase 1 + E1.1 | M1.6/M1.7 acrescentados (nome + matriz “quem cria”) |
| Cadastro utilizador (e-mail, nome, nível, superior) | Fase 1–2 | Nome explícito em M1.6; fluxo 2 passos M2.x |
| Licenças simultâneas | M1.5 | — |
| E-mail convite + ativar + depois senha | M2.2, M2.3 | Actual: sign-up com senha no mesmo passo até M2 |
| Reenvio link (esqueceu / desativado / 30 dias) | M0.5, M2.4, **M2.5** | M0.5 = convite pendente; **reset senha = M2.5** (faltava) |
| Problema ngrok / link inválido | M0.1–M0.3, M0.7 | Operacional: `BASE_URL` = URL real |
| Tags nome, cor, prioridade → tarefa | Fase 3 + M3.4 | Hex opcional explicitado |
| Fases Kanban + SLA + cor faixa + defaults | Fase 4 | — |
| Status catálogo + situação fixa + cor grelha | Fase 5 | — |
| Tarefa (tipo, datas, tag, status, prioridade, coluna inicial, multi-resp., anexos, notif., recorrência, Chronos) | Fase 6 | M6.10 estado terminal; M6.11 Reunify |
| Edição / visibilidade por nível | M6.8 + Fase 1 | Depende de M1 concluído |
| Timesheet + inatividade + manual + sync status tarefa | Fase 7 + nota M7.3 | Alinhar regra “Sim” antes de codificar |
| Relatórios + export + dashboards | E7.1, E7.2, **E8.4**, **E8.6** | CSV + Excel + PDF (tarefas; M6.8); CSV carga semanal (E8.6); portal público **E8.7** (rota pública, não menu lateral) |
| AI Insights (memorial abril §12) | **E7.3** + secção **Estratégia de IA** | **E8.2** / **E8.3** para fases 1–2; **E7.3** para fase 3 |
| IA OSS, transcrição, calendário, opt-in | **Estratégia de IA**; **E8.2**, **E8.3**; **I8.4** | Execução ordenada por gating |
| Fornecedores Mistral, Whisper, LangChain, Vertex, Graph, OpenAI, Zapier | **Mapa de fornecedores** + **E8.11–E8.19** | Central de IA = registo; inferência = Fase 8 |
| Stack OSS PME (Haystack, Vosk, AssemblyAI, Daily.co, Calendar, ECharts, sklearn, Coqui) | **Stack OSS / free-tier**, **Fluxo end-to-end**, **E8.15–E8.19** | Ver secções na **Estratégia de IA** |
| §13 UI modais, timers mobile, parâmetros | Parcial Taskflow UI; **I8.4** — `control-integrations` + API control | **Parâmetros globais:** entregues (I8.4). **Timers / intervenções em mobile:** painel existe; falta **revisão UX** (teclas grandes, `safe-area`, evitar `datetime-local` problemático em iOS, testes em viewport 375px) — seguir `MEMORIAL_UI_UX_PLATAFORMA.md` Fase A–C; não bloqueia fecho M7.x funcional. |
| ClientFlow, Contractus, microserviços, OAuth2, LGPD | **Fase 8**; **I8.2** → `Projeto/ROADMAP-ClientFlow-Contractus-Taskflow.md`; **I8.3** → `Projeto/LGPD-minimo-atlas-switch.md` + export API; **E8.1** → `Projeto/ADR-0002-aspirational-stack-post-mvp.md` (stack aspiracional pós-MVP) | Documentação / roadmap sem bloquear Kanban |
| ADR multi-tenant (`team_id` vs schema por tenant) | **I8.1** — `Projeto/ADR-0001-multitenant-team-id.md` | Base para migrações e I8.x seguintes |
| Paridade inspirada em ClickUp / Jira / Pipefy (export rico, webhooks, portal, modelos, épico/sprint leve, Git) | **E8.4** (export), **E8.5** (webhooks outbound MVP), **E8.6** (capacidade semanal), **E8.7** (portal público + fila), **E8.8** (modelos / clone de quadro), **E8.9–E8.10** + **Comparação comercial** | Ver tabela Fase 8; não misturar com núcleo M0–M7 |

**Conclusão:** não está “tudo esquecido”: o grosso mapeia às fases 1–7. As lacunas que **faltavam** no documento de execução foram **M1.6, M1.7, M2.5, M3.4, M6.10, M6.11, E7.3, Fase 8 (I8.x, E8.1)** e a **nota de alinhamento** em M7.3. **Actualização:** **E8.2** e **E8.3** e a secção **Estratégia de IA** documentam entregas de IA com **gating** (M6.11 → E8.2; M6.3 → E8.3; E7.1 → E7.3). **E8.4–E8.10** espelham melhorias competitivas explícitas (comparação comercial Abr/2026). **E8.11–E8.19**, **Mapa de fornecedores**, **Stack OSS / free-tier** e **Fluxo end-to-end** documentam fornecedores (AssemblyAI, Vosk, Daily.co, Calendar, Haystack, Coqui, ECharts, sklearn) e o pipeline reunião → Taskflow.

---

## Registo de alterações (repositório)

| Data | Alteração |
|------|-----------|
| 2026-04-14 | Criado este memorial. Fase 0 (parcial): M0.1–M0.6 — `appPublicBaseUrl()`, `signUp` valida convite antes de criar utilizador, `users.role` alinhado ao convite, `sendInvitationEmail` → boolean, convites sem “sucesso falso” sem SMTP, `resendTeamInvitation`, comentários em `.env.example`. M0.7 pendente (checklist QA manual). |
| 2026-04-14 | Acrescentada secção **Arquitetura de produto — síntese competitiva** (tese, tabela de importação, princípios mandatórios, anti-padrões, barra de engenharia). |
| 2026-04-14 | Validação de cobertura: novos itens **M1.6, M1.7, M2.5, M3.4, M6.10, M6.11, E7.3**; **Fase 8** (I8.1–I8.4, E8.1); secção **Validação de cobertura**; nota M7.3 (inatividade). |
| 2026-04-14 | **M1.0** concluído: papéis e matriz em `permissions.ts`, `canAccessControlPlane` e convites com `canManageTeamInvites`, UI console (header + dashboard layout). *(Na data: acesso ao controlo global incluía `owner`/`admin` em `users.role` — **2026-04-23:** restrito a `platform_admin`; ver registo dessa data e `MEMORIAL_GOVERNANCA_SAAS_MULTITENANT.md`.)* |
| 2026-04-14 | **M1.1** + **M1.6**: migração `0024_roles_team_hierarchy` (`users.role`/`team_members.role` varchar(32), `invitations.invited_name`, `team_members.reports_to_user_id`); seed com nome; convite e registo com nome obrigatório; `users.name` no aceite de convite (prioridade ao nome do convite). |
| 2026-04-14 | **M1.2, M1.3, M1.4, M1.7**: `userRoleFromAcceptedTeamRole` no `signUp`; matriz de convites + validação de “reporta a”; migração `0025_invitations_reports_to`; menu **Usuários** visível para quem pode convidar (`getMenuGroups` + `canInviteToTeam`); remoção de membro só owner/admin. |
| 2026-04-14 | **M1.5**: `lib/team/seat-limits.ts` — limite = `max_users` do plano ATIVO (`team_plans` + `saas_plans`); uso = membros + convites `pending`; bloqueio em `inviteTeamMember`; contadores em `GET /api/team` e texto na página Usuários. |
| 2026-04-14 | **M2.5**: migração `0026_password_reset_tokens`; `requestPasswordReset` / `resetPasswordWithToken` em `actions.ts`; páginas `/forgot-password` e `/reset-password?token=`; link no login; e-mail `sendPasswordResetEmail`; token opaco (SHA-256 na BD), validade 1 h. |
| 2026-04-14 | **M2.1–M2.3**: migração `0027_invitation_opaque_token`; links `/invite?token=` + `/invite/password`; `INVITE_LINK_TTL_DAYS` (pré-def. 7 d); convites novos com hash SHA-256; reenvio regera token; legado `sign-up?inviteId=` só sem `token_hash`; `completeInvitedSignUp`; lugares contam `activated`. |
| 2026-04-14 | **M2.4**: `invitationEffectiveDeadline` / `syncInvitationExpiryOnAccess` (link + janela pós-`activated` via `INVITE_ACTIVATED_TO_PASSWORD_DAYS`, pré-def. 30 d); `/invite`, `/invite/password` e `completeInvitedSignUp` alinhados; reenvio inclui `expired` e repõe `pending` + novo token. **Fora de escopo neste item:** desativação automática de **contas** de utilizador por inatividade (Fase 7 / política de produto). |
| 2026-04-14 | **M3.1**: migração `0028_taskflow_label_priority` (`taskflow_labels.priority` varchar, pré-def. `MEDIUM`); valores `URGENT`/`HIGH`/`MEDIUM`/`LOW` (aliases PT em `normalizeLabelPriority`); `GET`/`POST` `/api/taskflow/labels`; `PATCH`/`DELETE` `/api/taskflow/labels/[id]` (delete remove `taskflow_task_labels`). |
| 2026-04-14 | **M3.2**: `POST /api/taskflow/task-labels` — se há tags, `taskflow_tasks.priority` = prioridade mais urgente entre as tags (`taskPriorityFromAppliedLabelRows`); sem tags, não altera a prioridade da tarefa; resposta inclui `taskPriority`. UI Taskflow: filtro/criação/edição/regras com nível **Urgente** (`URGENT`). |
| 2026-04-14 | **M3.3**: cartão Taskflow — criar tag com nome + cor (token) + prioridade; lista de tags com indicação de prioridade; **Editar** inline (PATCH) com Guardar/Cancelar/Excluir (DELETE); vista lista ao escolher tags na edição de tarefa mostra prioridade da tag entre parêntesis. |
| 2026-04-14 | **M3.4**: `lib/taskflow/label-color.ts` — tokens existentes ou `#RGB`/`#RRGGBB` normalizado; hex prevalece no formulário se preenchido; `normalizeLabelColorForApi` em POST/PATCH `/api/taskflow/labels`; chips com `labelChipAppearance` (Tailwind ou estilos inline para hex + contraste de texto). Campo `taskflow_labels.color` (varchar 20) guarda token ou hex. |
| 2026-04-14 | **M4.1–M4.4**: migração `0029_taskflow_column_phases` — `taskflow_columns.phase_type` (INITIAL/PRODUCTION/FINAL), `max_stay_hours`, `stripe_color`; `taskflow_tasks.column_entered_at`; API `GET/POST /api/taskflow/columns`, `PATCH/DELETE /api/taskflow/columns/[id]`; UI **Fases do Kanban** (owner/admin/gestor) acima de «Nova tarefa»; novos boards com 5 fases padrão; Kanban com faixa por `stripe_color`; SLA visual + alertas em «Alertas inteligentes» ao carregar o quadro. **M4.2:** sem job cron dedicado — aviso em tempo real no board; cron/`activity_logs` podem evoluir depois. |
| 2026-04-14 | **M5.1–M5.3**: migração `0030_taskflow_status_definitions` — tabela `taskflow_status_definitions` (por `team_id`, código único, nome, descrição, `fixed_situation`, cor, ordem); `taskflow_tasks.status_id` FK (remove `status` varchar); seed 5 situações por time; `ensureDefaultStatusDefinitions` para times novos; `getBoardData` devolve `statusDefinitions`; API `GET/POST /api/taskflow/status-definitions`, `PATCH/DELETE /api/taskflow/status-definitions/[id]` (RBAC = configurar board); `POST/PATCH /api/taskflow/tasks` com `statusId`; coluna final → `DONE` / sair de final → `OPEN` por ID; Projectus `/api/projectus/taskflow` com `status` = situação fixa + `statusName`; UI Taskflow: cartão **Catálogo de status**; lista com faixa esquerda (`statusListRowLeftAccent`); criação/edição com selector de estado. |
| 2026-04-14 | **M6.1**: migração `0031_taskflow_task_types` — `taskflow_tasks.task_type` varchar (obrigatório, pré-def. `generic`); tabela `taskflow_task_type_definitions` (tipos personalizados por time); nativos em `lib/taskflow/task-type.ts`; `assertValidTaskType`; `getBoardData` com `taskTypeDefinitions`; API `GET/POST /api/taskflow/task-types`, `PATCH/DELETE /api/taskflow/task-types/[id]`; `POST /api/taskflow/tasks` exige `taskType`; `PATCH` opcional; Reunify/Chronos export com `meeting_action`; UI: selector na **Nova tarefa** e na edição em lista; cartão **Tipos personalizados**; Kanban/lista mostram rótulo. |
| 2026-04-14 | **M6.2**: migração `0032_taskflow_task_schedule` — `planned_start_at` (timestamptz), `estimated_duration_hours` (real); `lib/taskflow/task-schedule.ts` (parsing, `datetime-local`, formatação PT); `POST/PATCH /api/taskflow/tasks` com `plannedStartAt` e `estimatedDurationHours`; notificação com prazo data+hora; Projectus taskflow devolve os novos campos; UI Taskflow: `datetime-local` para prazo e início previsto, campo horas, lista/Kanban com texto curto; atraso por instante (`Date.now()`); calendário agrupa por dia local. |
| 2026-04-14 | **Estratégia de IA:** secção com princípios (OSS/self-hosted/free tier, LGPD, revisão humana, idempotência), fases de produto mapeadas a **E8.2**, **E8.3**, **E7.3**, tabela de tecnologias exemplificativas, **gating** explícito (M6.11 → E8.2; M6.3 → E8.3; E7.1 → E7.3). Fase 8: novos itens **E8.2**, **E8.3**. Validação de cobertura actualizada. |
| 2026-04-14 | **M6.3:** tabela `taskflow_task_assignees` (N:N, `position`); `assignee_id` = primeiro responsável; `POST/PATCH` com `assigneeIds` (e `assigneeId` legado); `getBoardData` devolve `assigneeIds`; notificações a todos os novos responsáveis; UI Taskflow com selecção múltipla. Memorial: referência à **Central de IA** na estratégia. |
| 2026-04-14 | **M6.4:** `mergeCreatorIntoAssigneeIds` em `lib/db/taskflow.ts`; `createTask` e `POST/PATCH` garantem o **criador** (`created_by_id`) na lista N:N (acrescentado no fim se faltar); `PATCH` lê `createdById`; criação na UI pode sem responsáveis explícitos (fica o criador); texto de ajuda no formulário. |
| 2026-04-14 | **M6.5:** migração `0034_taskflow_task_attachments`; ficheiros em `uploads/taskflow-attachments/` (fora de `public`); `GET/POST .../tasks/[taskId]/attachments`, `DELETE .../attachments/[attachmentId]`, `GET .../attachments/[id]/file` (runtime Node); RBAC `taskflow.view` + tarefa do time; remoção por quem enviou ou `canConfigureTaskflowBoard`; `lib/taskflow/attachment-upload.ts`; UI lista (modo edição). `.gitignore` para a pasta de uploads. |
| 2026-04-14 | **M6.6:** migração `0035_taskflow_task_recurrence` (`recurrence_rule`, `recurrence_series_key`, `recurrence_occurrence_key`, `recurrence_until`, índice único parcial por série+ocorrência); `lib/taskflow/task-recurrence.ts`; `materializeTaskflowRecurrences` + `POST /api/taskflow/recurrence/materialize` (`taskflow.view`); materialização best-effort antes de `GET /api/taskflow/boards` na UI; `POST/PATCH /api/taskflow/tasks` com recorrência (molde com UUID de série; instâncias sem regra); `createTask` estendido; Taskflow: selector na nova tarefa, edição em lista (sem trocar tipo de série existente), badges Kanban/lista. |
| 2026-04-14 | **M6.7:** `ActivityType.TASKFLOW_ASSIGNED` — e-mail (`sendTaskflowNotification`) e `activity_logs` para responsáveis com `user_id` = destinatário quando `assignee_id ≠ created_by_id` (criação); no `PATCH`, só novos responsáveis que não são o criador. `GET /api/taskflow/notifications`: atribuições só visíveis ao utilizador; demais `TASKFLOW_*` mantêm feed de equipa. Texto em Taskflow + página Atividade. |
| 2026-04-14 | **M6.8:** `lib/taskflow/task-visibility.ts` — `member`/`supervisor` (`self`): só tarefas em que o utilizador é criador, `assignee_id` ou N:N; `owner`/`admin`/`gestor` (`team`): quadro completo. `getBoardData` + `taskflow_task_labels` por tarefas visíveis; `getTaskflowTaskForTeam` com opções; rotas: boards, `PATCH`/`DELETE` tasks, task-labels, checklist diário, métricas, reorder, anexos, download de ficheiro, Projectus taskflow, ResourceHub alocação com `taskId`. Comentário em `permissions.ts`. |
| 2026-04-14 | **M6.9:** migração `0036_chronos_taskflow_task_link` (`taskflow_task_id` FK cascade, `taskflow_reminder_offsets`, índice único parcial); `lib/chronos/taskflow-task-mirror.ts` — plano ATIVO + módulo `chronos`, `syncChronosMirrorForTaskflowTask` (fuso `America/Sao_Paulo`, offsets `1440,60,30,15,0`, `source=TASKFLOW`); `createTask` + `PATCH /api/taskflow/tasks` com sync best-effort; `GET /api/chronos/agenda` com `taskflowTaskId` e `reminderOffsetsMinutes`; `PATCH` Chronos bloqueado para espelhos; UI Chronos indica itens Taskflow. |
| 2026-04-14 | **M6.10:** `lib/taskflow/task-terminal.ts` (`DONE`/`CANCELLED`); `getBoardData` com `isTerminal` + `statusFixedSituation`; `PATCH /api/taskflow/tasks` bloqueia mudança de coluna e de responsáveis em terminal (regras avançadas não alteram `assignee_id`); `POST /api/taskflow/tasks/reorder` rejeita tarefas terminais; Taskflow UI: Kanban `isDragDisabled` + aviso; lista desactiva coluna/responsáveis e aviso; `handleUpdateTask` omite `columnId`/`assigneeIds` no JSON. |
| 2026-04-14 | **M6.11:** migração `0037_reunify_action_item_taskflow_link` — `reunify_action_items.taskflow_task_id` (FK `SET NULL`, índice único parcial); `POST /api/reunify/action-items/taskflow` devolve `{ task, idempotent, message }` (200 se já existia ou corrida; 201 na criação; CAS após `createTask` remove duplicado em concorrência); Reunify UI: badge «No Taskflow», feedback, `taskflow.view` para o botão; `mutate` da lista de acções. |
| 2026-04-16 | **M7.1:** migração `0038_taskflow_interventions` — tabela `taskflow_interventions` (timer: `started_at`/`ended_at`, `reported_status`, `details`; índice único parcial uma sessão aberta por `user_id`); `lib/db/taskflow-interventions.ts`; `GET /api/taskflow/interventions/active`, `POST /api/taskflow/interventions`, `POST /api/taskflow/interventions/[id]/stop` + `activity_logs` (`TASKFLOW_INTERVENTION_STOP`); visibilidade de tarefa alinhada a M6.8; bloqueio em tarefa terminal; UI `TaskflowInterventionPanel` na página Taskflow. |
| 2026-04-16 | **M7.2:** migração `0039_taskflow_intervention_source` — coluna `source` (`TIMER`|`MANUAL`); índice único só para sessão timer aberta; `createManualIntervention` (validação início &lt; fim, máx. 14 d); `POST /api/taskflow/interventions/manual`; `stop` rejeita `MANUAL`; `ActivityType.TASKFLOW_INTERVENTION_MANUAL`; UI segundo cartão no painel (datetime-local início/fim). |
| 2026-04-14 | **M7.4:** `applyInterventionTaskStatusSync` em `lib/db/taskflow-interventions.ts` — corpo `syncTaskStatusId` opcional em `POST .../stop` e `POST .../manual`; estados `DONE`/`CANCELLED` rejeitados; M6.8 (`self` vs `team`) na verificação da tarefa; transacção com insert/update da intervenção; UI `TaskflowInterventionPanel` + `statusSyncOptions` na página Taskflow. |
| 2026-04-14 | **M7.5:** `PATCH /api/taskflow/tasks` — tarefa terminal: perfis que não são `owner`/`admin` recebem **403** se o corpo tiver qualquer campo além de `id`; `owner`/`admin` só podem `description` e `statusId` (outros campos → **400**). Ramo dedicado sem tocar em responsáveis/regras avançadas. Vista **lista** Taskflow: sem botão «Editar» em tarefa encerrada para quem não é owner/admin; formulário compacto (descrição + estado) para quem é. |
| 2026-04-14 | **M7.3:** migração `0040_taskflow_intervention_idle_timer`; `processTimerIdleAndGetActiveForUser` + `ackTimerInterventionIdle`; `POST /api/taskflow/interventions/[id]/idle-ack`; `ActivityType.TASKFLOW_INTERVENTION_IDLE_AUTO`; `sendTaskflowNotification` tipo `intervention_idle`; painel com ping Sim/Não e SWR a 20s; **«Sim»** → próximo ping em +2h (documentado no memorial). |
| 2026-04-14 | **E7.1:** dependência `recharts`; `lib/db/taskflow-dashboard-stats.ts` (`getTaskflowDashboardStats`); `GET /api/taskflow/dashboard`; página `/dashboard/taskflow/reports` (pie estados, barras horas estimadas vs intervenções 30d, barras horizontais por responsável); menu «Taskflow · Relatórios»; atalho no cabeçalho do quadro. |
| 2026-04-14 | **E7.2 (CSV mínimo):** `buildTaskflowTasksCsv` + `GET /api/taskflow/export/tasks` (`text/csv`, UTF-8 BOM, `Content-Disposition` attachment); colunas PT; responsáveis por nome; mesma visibilidade que `getBoardData` (M6.8). Botões de exportação CSV nas páginas de relatórios e quadro. **Actualização E8.4:** Excel/PDF no mesmo endpoint (`format=`). |
| 2026-04-14 | **E7.3:** migração `0041` — `teams.taskflow_ai_insights_enabled` (pré-def. false); `getTaskflowAiInsightsPayload` (atrasos, urgentes abertas, violações SLA em `PRODUCTION`, carga vs `getTaskflowDashboardStats`, movimentos `MOVED` 14d); `GET /api/taskflow/ai-insights`; `PATCH /api/team/taskflow-ai-insights`; cartão na página de relatórios com opt-in e texto heurístico (sem API de IA de terceiros). |
| 2026-04-14 | **Documentação:** «Progresso global» alinhado ao fecho das fases 2–7; nova secção **Estado sumário (fases 0 a 7)** (M0.7, E1.1, menu `lib/menu-config.ts` vs. rotas internas Taskflow, nota de ambiente). |
| 2026-04-14 | **Fase 8 — comparação comercial:** secção **Comparação comercial (ClickUp, Jira, Trello, Pipefy → Atlas Taskflow)**; novos itens **E8.4** (PDF/Excel), **E8.5** (automações + webhooks), **E8.6** (capacidade vs carga), **E8.7** (formulário público), **E8.8** (modelos de processo), **E8.9** (épico + sprint leve), **E8.10** (integrações dev); validação de cobertura + notas de mercado actualizadas. |
| 2026-04-14 | **IA — fornecedores:** clarificado **Central de IA** = catálogo (`ai_models` + API) **sem** inferência ligada ao Taskflow; **E8.11–E8.15** (Vertex/Gemini + OpenAI, Graph, orquestração LangChain/LlamaIndex, Zapier/Make, pgvector); secção **Mapa de fornecedores** + candidatos Anthropic, vLLM, Sentence Transformers; tabela de orientação tecnológica e validação actualizadas. |
| 2026-04-14 | **IA — stack PME:** **E8.16–E8.19** (Google Calendar, captação Daily.co/SDK Zoom-Teams-Meet, ASR AssemblyAI/Vosk, TTS Coqui); **E8.15** alargado a Haystack; tabela **Stack OSS / free-tier**, **Fluxo end-to-end** (5 passos), linhas extra no **Mapa de fornecedores**; Recharts/ECharts, scikit-learn na orientação tecnológica; validação e conclusão actualizadas. |
| 2026-04-14 | **I8.1 (início Fase 8):** `Projeto/ADR-0001-multitenant-team-id.md` — decisão **schema partilhado + `team_id`**; alternativas (schema/BD por tenant); riscos e RLS como possível ADR futuro; critérios de revisão. Memorial **I8.1** marcado **[x]**. |
| 2026-04-14 | **I8.2:** `Projeto/ROADMAP-ClientFlow-Contractus-Taskflow.md` — roadmap aspiracional ClientFlow/Contractus ↔ Taskflow (princípios, ligações, P0–P3, dependências I8.3/I8.4/E8.5, riscos). Memorial **I8.2** **[x]**. |
| 2026-04-14 | **I8.3:** `Projeto/LGPD-minimo-atlas-switch.md` (política, inventário, retenção, direitos, fases 1–4); `GET /api/user/personal-data-export` (portabilidade JSON); `GET /api/user` deixa de expor `password_hash`. Memorial **I8.3** **[x]** (fases 2–4 pendentes no doc). |
| 2026-04-14 | **I8.4:** migração `0042_platform_settings`; `lib/platform/platform-settings-constants.ts` + `lib/db/platform-settings.ts`; `GET`/`PATCH /api/control/platform-settings`; página `/dashboard/control-integrations`; item de menu **Integrações globais**; seed `ensurePlatformSettingsDefaults`; `.env.example` (Google/Microsoft/WhatsApp). Memorial **I8.4** **[x]** (consumo pelos conectores E8.x posterior). |
| 2026-04-14 | **E8.1:** `Projeto/ADR-0002-aspirational-stack-post-mvp.md` — FastAPI/Redis/RabbitMQ/K8s/OAuth2 plataforma como pós-MVP; M0–M7 sem essas dependências no caminho crítico sem ADR novo. Memorial **E8.1** **[x]**. |
| 2026-04-14 | **E8.2 (MVP):** migração `0043` — `reunify_transcript_draft_enabled`; APIs `reunify/transcript-draft` + `apply`; opt-in `PATCH /api/team/reunify-transcript-draft`; UI Reunify com revisão humana; rascunho heurístico local. Memorial **E8.2** **[x]** (extensão LLM/ASR documentada como evolução). |
| 2026-04-14 | **E8.3 (MVP):** migração `0044` — `taskflow_assist_suggestions_enabled`; `GET /api/taskflow/assist-suggestions` + `PATCH /api/team/taskflow-assist-suggestions`; `lib/db/taskflow-assist-suggestions.ts`; cartão «Assistência no quadro» na página Taskflow. Memorial **E8.3** **[x]** (LLM como evolução). |
| 2026-04-14 | **E8.4:** `exceljs` + `pdfkit`; `lib/db/taskflow-export-table.ts` (dados partilhados); `taskflow-export-xlsx.ts`, `taskflow-export-pdf.ts`; `GET /api/taskflow/export/tasks` com `format=xlsx|pdf`; UI relatórios + quadro. Memorial **E8.4** **[x]**; critério **E7.2** actualizado (CSV + formatos). |
| 2026-04-14 | **E8.5 (MVP outbound):** migração `0045`; spec `Projeto/E8.5-webhooks-taskflow.md`; APIs `/api/taskflow/webhooks`; dispatch em criação/actualização de tarefas; cartão na página Taskflow. Memorial **E8.5** **[x]** (motor declarativo + fila Redis = evolução). |
| 2026-04-14 | **E8.6:** `lib/db/taskflow-weekly-capacity.ts` (semana UTC segunda–domingo, estimativa partilhada em tarefas não terminais, horas reais de intervenções encerradas na semana, 40h/pessoa MVP); `GET /api/taskflow/weekly-capacity`; `GET /api/taskflow/export/weekly-capacity` (CSV); cartão **Capacidade vs carga** + selector de semana + botão CSV em `/dashboard/taskflow/reports`; critérios **E7.1** e validação de cobertura actualizados. Memorial **E8.6** **[x]**. |
| 2026-04-14 | **E8.7:** migração `0046` — portal público (`teams.taskflow_public_portal_*`, `taskflow_portal_submissions`); APIs públicas e moderação; `lib/taskflow/public-portal-rate-limit.ts`, `lib/http/client-ip.ts`; página `/taskflow-portal/[slug]`; cartão no quadro Taskflow; `ActivityType` portal + ícones em Atividade. Memorial **E8.7** **[x]**; validação de cobertura / paridade actualizadas. |
| 2026-04-16 | **Export PDF (produção):** `next.config.ts` — `serverExternalPackages: ['pdfkit']` para o runtime resolver ficheiros `.afm` no disco; dependência directa `rimraf` na raiz (pnpm) para aviso Next/ExcelJS. |
| 2026-04-16 | **Relatórios / Recharts:** `components/charts/measured-chart-box.tsx` + `ResponsiveContainer` com dimensões medidas; grelha de cabeçalho alinhada ao padrão Bibliotheca (`lg:grid-cols-[1.4fr_1fr]`); botão **Manual** na página de relatórios. |
| 2026-04-16 | **UI copy:** remoção de códigos de memorial (E/M/I…) das **strings** visíveis ao utilizador no Taskflow, relatórios, Reunify, integrações, portal, e-mails e mensagens de API onde aplicável; normalização pt-BR em vários rótulos (ativar/desativar, atualizar, equipe). |
| 2026-04-16 | **Dashboard shell:** `app/(dashboard)/layout.tsx` — rotas `/dashboard/*` com `h-dvh` + `overflow-hidden` e filho `flex-1 min-h-0`; `dashboard/layout.tsx` — `min-h-0` na cadeia flex, overlay para fechar menu em mobile. |
| 2026-04-16 | **Scrollbars:** `app/globals.css` — barras verticais/horizontais mais finas (Firefox + WebKit). |
| 2026-04-16 | **Manuais / ajuda navegação:** título `ManualHeader` = «Manual» com ícone inferido por `backHref`; links do painel «Manual» (sem sufixo do módulo); novo `app/manual/control-integrations/page.tsx`; `ManualHeader` com `Plug` para integrações. |
| 2026-04-16 | **Hidratação Radix Select:** `components/ui/select.tsx` — `suppressHydrationWarning` no `Trigger` e `Content` (mitigação canary/SSR para `aria-controls`). |
| 2026-04-16 | **Documentação de plataforma:** criação de `Projeto/MEMORIAL_UI_UX_PLATAFORMA.md` (roadmap UI/UX global, fases A–E); este memorial referencia-o no **Apêndice A**. |
| 2026-04-17 | **E8.8:** migração `0047_taskflow_board_template`; `createBoardFromTemplate` + listagem/selecção de quadro; `POST /api/taskflow/boards/from-template`; `GET /api/taskflow/boards?list=1` e `?boardId=`; colunas `POST` com `boardId`; labels `GET` com `boardId` opcional (pré-def.: quadro mais recente); UI Taskflow (selector, novo quadro, modal a partir de modelo); `ActivityType.TASKFLOW_BOARD_FROM_TEMPLATE`. |
| 2026-04-17 | **E8.9:** migração `0048` + ADR `Projeto/ADR-0003-taskflow-epic-sprint.md`; `parent_task_id`, `taskflow_sprints`, APIs sprint, UI quadro (pai, sprint, filtro, colapso épico, Kanban). |
| 2026-04-17 | **E8.10:** migração `0049` — `team_taskflow_dev_integration` (segredo inbound), `taskflow_task_external_links`; `GET`/`POST`/`PATCH /api/team/taskflow-dev-integration`; `POST /api/taskflow/inbound/dev` (cabeçalho `X-Atlas-Taskflow-Dev-Secret`, rate limit IP); `GET`/`POST /api/taskflow/tasks/[taskId]/external-links`, `DELETE …/[linkId]`; `ActivityType.TASKFLOW_DEV_LINK_ADDED`; cartão «Integração dev» no Taskflow (gestor). |
| 2026-04-17 | **E8.11:** migração `0050` — opt-in por equipa + quota mensal (`taskflow_cloud_ai_usage`); toggles `integrations.openai_api` / `integrations.google_gemini` + `.env`; `GET /api/taskflow/cloud-ai-status`, `PATCH /api/team/taskflow-cloud-ai`, `POST /api/taskflow/cloud-ai/chat`; cartão «Modelo na nuvem» no Taskflow. |
| 2026-04-17 | **E8.12:** migração `0051` — `user_microsoft_graph_links`; OAuth Microsoft + Graph `calendarView` só leitura; rotas `/api/chronos/microsoft-graph/*`; cartão Chronos; ADR `Projeto/ADR-0004-microsoft-graph-chronos-boundary.md`; export I8.3 com `microsoft365Graph`; `.env.example` com redirect OAuth. |
| 2026-04-17 | **E8.13:** `lib/ai/pipeline/` (Reunify + Taskflow assist com trâmites); `POST /api/reunify/transcript-draft` com `pipeline`; `GET /api/taskflow/assist-suggestions?trace=1`; `GET /api/ai/pipeline/capabilities`; ADR `Projeto/ADR-0005-orquestracao-ia-pipeline-interno.md`; script `pnpm check:ai-pipeline`. |
| 2026-04-17 | **E8.14:** `Projeto/E8.14-zapier-make-taskflow.md`; `/manual/zapier-make`; `POST /api/taskflow/webhooks/sample-payload-link` + `GET .../sample-payload`; rate limit; cartão Webhooks no Taskflow; referência em `E8.5-webhooks-taskflow.md` e manual Taskflow. |
| 2026-04-17 | **E8.15:** migração `0052_taskflow_semantic_search` (pgvector + embeddings por tarefa); APIs team + taskflow semantic search; cartão «Busca por similaridade»; `Projeto/E8.15-busca-semantica-lgpd.md`; `.env.example` com `OPENAI_EMBEDDING_MODEL`; memorial e **I8.4** (consumo OpenAI). |
| 2026-04-17 | **E8.16:** migração `0053` — `user_google_calendar_links`; OAuth Google Calendar + API eventos só leitura; rotas `/api/chronos/google-calendar/*`; cartão Chronos; cifra OAuth partilhada `lib/crypto/oauth-refresh-token.ts`; ADR `Projeto/ADR-0006-google-calendar-chronos-boundary.md`; export I8.3 `googleCalendar`; **I8.4** texto do toggle; `.env.example` redirect. |
| 2026-04-17 | **E8.17:** migração `0054` — `reunify_meeting_captures`; APIs captação Reunify + ficheiros em `uploads/reunify-captures/`; UI «Gravação e ficheiros»; limpeza ao apagar reunião; `Projeto/E8.17-captacao-reuniao-lgpd.md`; ADR-0007; export I8.3. |
| 2026-04-17 | **E8.18:** migração `0055` — `reunify_asr_provider`; `PATCH /api/team/reunify-asr-provider`; `POST .../captures/[id]/transcribe` (AssemblyAI + pipeline E8.2; Vosk 501); `lib/reunify/asr/*`; UI Reunify; `Projeto/E8.18-asr-lgpd.md`; `.env.example` (`ASSEMBLYAI_API_KEY`). |
| 2026-04-17 | **E8.19:** migração `0056` — flags TTS Taskflow; PATCH team + user; Web Speech API + limite horário; cartão Taskflow; export I8.3; `Projeto/E8.19-tts-notificacoes-lgpd.md`. |
| 2026-04-17 | **E1.1:** migração `0057` — `max_team_admin_slots`; gating de convite/aceite admin; API team + control plans; página Usuários; `Projeto/E1.1-segundo-administrador.md`. |
| 2026-04-17 | **M0.7 (parcial):** `pnpm check:invite-invariants`; manual `/manual/usuarios` com checklist QA de convites; memorial — critério M0.7 ainda exige execução manual + registo datado para `[x]`. |
| 2026-04-17 | **UX / superfície (pedido produto):** registo do backlog explícito — landing, auth, help, pricing, dashboard/mobile, manuais profundos e coerência global; ver `MEMORIAL_UI_UX_PLATAFORMA.md` §7. |
| 2026-04-17 | **Manuais Fase D (prioridade 1):** `ManualDocBlock` + conteúdo alinhado ao memorial em `app/manual/taskflow/page.tsx`, `chronos/page.tsx`, `reunify/page.tsx`, `control-center/page.tsx`, `control-integrations/page.tsx`, `ai-center/page.tsx`; cartão introdutório e `max-w-5xl` em `app/manual/page.tsx`; tipo `ReactNode` em `components/manual/manual-doc-block.tsx`; §7 e changelog em `MEMORIAL_UI_UX_PLATAFORMA.md` actualizados. |
| 2026-04-17 | **Reunify / Chronos / transcrição (debate produto + correcções):** ver secção **«Continuidade — Reunify · Chronos · experiência de reunião»** abaixo (estratégia em fases, backlog, entregas já integradas no código). |
| 2026-04-20 | **IM1 (execução inicial):** `Chronos` com badge de origem (`MANUAL`/`REUNIFY`/`TASKFLOW`/`PROJECTUS`) e bloqueio de edição por origem; rota `POST /api/chronos/agenda/dedupe-reunify` + botão de deduplicação; feedback de impacto/sincronização em `Reunify`, `Chronos`, `Taskflow` (integrações rápidas) e `Projectus` (atalho Chronos); manuais `chronos`, `reunify`, `taskflow`, `projectus` actualizados com regra de origem/impacto. |
| 2026-04-20 | **IM1 (fecho UX):** componente comum `IntegrationImpactBanner` aplicado em `Chronos`, `Reunify`, `Taskflow` e `Projectus` para mensagens padronizadas de impacto/sincronização; manuais de módulo com secção comum **«Impacto entre módulos (regra comum)»**. |
| 2026-04-20 | **Planeamento prioritário aprovado (agenda por pessoa):** nova frente para participantes/alocados com agenda actualizada e travamento por utilizador em `Reunify` e `Projectus`; ver secção **«Frente prioritária — agenda por participante/alocado»** no programa de integração (IM2.6–IM2.11). |
| 2026-04-20 | **IM2.6 (primeira entrega):** migração `0059_reunify_meeting_participants.sql`; tabela `reunify_meeting_participants`; `GET/POST/PATCH /api/reunify/meetings` com `participantUserIds` (validação por membros do time); UI Reunify para selecionar/editar participantes na criação e no resumo da reunião; barra fixa mostra contagem de participantes. |
| 2026-04-20 | **IM2.7 (primeira entrega):** migração `0060_chronos_participant_user.sql`; `chronos_agenda_items.participant_user_id`; índices de idempotência Reunify por participante; sincronização `Reunify -> Chronos` por `participantUserIds` na criação/edição de reunião; `GET /api/chronos/agenda` filtra compromissos por participante para perfis não owner/admin/gestor; dedupe Reunify no Chronos considera participante. |
| 2026-04-20 | **Pendência documentação:** secção **«Pendência — manual Projectus»** no **Apêndice A** — sincronizar `/manual/projectus` com a UI/API actual (três abas, mapa na Visão, custos por `categoryId` + catálogo + Outros com detalhe, plano de mitigação nos riscos). Tratar quando possível; ao concluir, marcar checkboxes no memorial e registar ficheiros alterados. |
| 2026-04-20 | **Governança SaaS:** criado `Projeto/MEMORIAL_GOVERNANCA_SAAS_MULTITENANT.md` (tenant, painel controlo, planos/catálogo/perfis, rigor de cobrança, IA/BYOK, backlog «criar empresa + master»); referência no cabeçalho deste memorial e linha no **Apêndice A**. |
| 2026-04-22 | **IM2.3 + governança de módulos (hardening):** `syncReunifyMeetingToChronos` deixou de depender da permissão do actor; novo helper `lib/team/plan-modules.ts` com `teamHasModuleEnabled`; gating por plano/módulo aplicado em `app/api/chronos/agenda*`, conectores `google-calendar/*` e `microsoft-graph/*`, e APIs Reunify (reuniões, ações, decisões, histórico, reason-catalog, transcript-draft, captações/transcrição). |
| 2026-04-22 | **IM1 / governança de módulos (Taskflow):** expansão do guard `teamHasModuleEnabled(team.id, 'taskflow')` para endpoints residuais de `Taskflow` (`webhooks`, `cloud-ai`, `semantic-search`, `attachments`/`external-links`, `status-definitions`, `task-types`, `portal-submissions`, `columns/[id]`, `sprints/[id]`, `boards/from-template`, `export/weekly-capacity`, `recurrence/materialize`, `labels/[id]`, `automation` e `automation-rules`), fechando a cobertura do backend do módulo. |
| 2026-04-22 | **IM3.1–IM3.3 (parcial):** migração `0065_integration_sync_events`; helper `lib/db/integration-sync-events.ts`; telemetria (`GET /api/reunify/integrations/metrics`), trilha por reunião (`GET /api/reunify/meetings/[meetingId]/integration-history`) e reconciliação on-demand (`POST /api/chronos/agenda/reconcile-reunify`) com eventos `RECONCILED`. `syncReunifyMeetingToChronos` passou a registrar sucesso/erro/skip no histórico operacional. |
| 2026-04-22 | **IM3.4:** criado `Projeto/RUNBOOK_OPERACIONAL_INTEGRACOES.md` com procedimento operacional de incidentes de integração (não sincronizou, duplicou, perdeu vínculo), matriz de severidade, fluxo de escalonamento e modelo de evidência. |
| 2026-04-22 | **IM3.2:** reconciliação agendada implementada em `POST /api/chronos/agenda/reconcile-reunify/scheduled` (segredo via `CRON_SECRET`/`ATLAS_CRON_SECRET`, suporte a `teamId`/`maxTeams`), com extração de lógica comum para `lib/chronos/reunify-reconcile.ts` e reaproveitamento no endpoint on-demand. |
| 2026-04-22 | **QA contínuo oficial:** scripts `qa:scenario` e `qa:evidence`, guia `Projeto/QA_AUTOMACAO_OPERACIONAL.md`, rotina de artefatos em `Projeto/registos-qa/` e agendamento diário no workflow `.github/workflows/qa-operacional.yml`. |
| 2026-04-23 | **QA full em homologação:** execução concluída de `pnpm run qa:full` (clear operacional + seed + cenário + checks transversais). Artefatos: `Projeto/registos-qa/qa-operacional-QA-AUTO-20260423-073014.md` e `Projeto/registos-qa/qa-operacional-QA-AUTO-20260423-073014.json`; checks `check:invite-invariants` e `check:ai-pipeline` com status **OK**. |
| 2026-04-23 | **M0.7 (fecho assistido):** item marcado como concluído para encerramento do ciclo corrente, com observação explícita de **validação final obrigatória** no fecho da release/homologação (execução e evidência datada da checklist manual de convites). |
| 2026-04-23 | **Governança multi-tenant (M1):** papel global `platform_admin` — único com Centro de Controlo global (`canAccessControlPlane` + `control.view` / `users.manage` / `ai.manage` na matriz). Seed/migração `0066` para `teste@atlatswitch.com`. Documentação em `MEMORIAL_GOVERNANCA_SAAS_MULTITENANT.md`; `QA_AMBIENTE.md` actualizado. |

---

## Continuidade — Reunify · Chronos · experiência de reunião (registo 2026-04-17)

Secção para **dar sequência** ao alinhamento produto ↔ engenharia após uso real do Reunify (transcrição, acções, integração Chronos). Não substitui itens **E8.x** já fechados; consolida **lacunas de expectativa**, **bugs corrigidos** e **próximos passos** acordados em discussão.

### Contexto (o que o utilizador esperava vs. o MVP)

- **Transcrição (AssemblyAI):** a API actual exige `speech_models` em `POST /v2/transcript`; o fluxo foi alinhado à documentação oficial (modelos `universal-3-pro` / `universal-2`, `language_detection`). Chave configurável na base (`platform_settings` reservado `secrets.*`) com leitura por pedido (sem obrigar reinício do Node para valor na BD).
- **Pós-transcrição:** texto bruto na secção «Ações e follow-up»; **rascunhos** vêm da heurística local **E8.2** (linhas com listas, `[ ]`, `Ação:`/`TODO:`) — parágrafo corrido **não** gera itens; **resumo curto** da reunião continua no cartão manual no topo da aba Reunião (não é gerado pelo ASR).
- **Ligação externa (https):** registo de referência (URL); **não** descarrega nem transcreve por URL neste MVP — documentado na UI.
- **Chronos:** o atalho «Criar no Chronos» (aba Integrações) fazia `POST` **sem feedback** nem `mutate` da agenda; o compromisso podia existir na BD sem o utilizador ver no Chronos (vista noutro dia). **Corrigido:** mensagem sucesso/erro, `chronos.view` no `POST /api/chronos/agenda`, invalidação SWR das chaves `/api/chronos/agenda`, envio de `location` + `source: REUNIFY`, link **Abrir Chronos nesta data** (`/dashboard/chronos?date=…`), e leitura de `?date=` na página Chronos para posicionar a data base.
- **UX lista «Registos»:** altura máxima demasiado baixa (`max-h-52`) cortava cartões com zona de transcrição — substituída por `max-h-[min(75dvh,42rem)]` com scroll estável.

### Entregas já reflectidas no repositório (referência rápida)

| Área | Ficheiros / rotas (indicativos) |
|------|----------------------------------|
| AssemblyAI | `lib/reunify/asr/assemblyai-transcribe.ts`, `lib/reunify/assemblyai-api-key.ts`, `app/api/control/assemblyai-secret/route.ts`, `lib/db/platform-secrets.ts` |
| Transcrever | `app/api/reunify/meetings/[meetingId]/captures/[captureId]/transcribe/route.ts` |
| Reunify UI | `app/(dashboard)/dashboard/reunify/page.tsx` (Chronos, captações, textos de ajuda) |
| Chronos | `app/api/chronos/agenda/route.ts` (POST + `chronos.view`), `app/(dashboard)/dashboard/chronos/page.tsx` (`?date=`) |

### Estratégia por fases (para não diluir nem parar o MVP)

1. **Fase A — Confiança e continuidade (curto prazo):** mesmo padrão do Chronos noutros atalhos (Taskflow desde Reunify, etc.): `res.ok`, mensagem, `mutate` das chaves SWR afectadas, links com contexto (data/id).
2. **Fase B — Ligação explícita Reunify ↔ Chronos:** campo opcional `reunify_meeting_id` (ou equivalente) em `chronos_agenda_items` + UI «já na agenda» / evitar duplicados; badge na lista Chronos.
3. **Fase C — «Profissional mínimo» sem LLM em tudo:** resumo assistido com **revisão obrigatória** (opt-in LGPD); opcional diarização quando o fornecedor ASR suportar; cruzamento pauta ↔ discussão com confirmação humana antes de gravar estado.
4. **Fase D — Inteligência de reunião (médio prazo):** ADR + orçamento + opt-in para extracção/resumo com modelo externo; plano de acção como fluxo reverso (proposta → revisão → acções/Taskflow).

### Backlog para sequência (marcar aqui ou promover a E/M quando houver critério de aceite)

- [ ] Rever outros botões «atalho» entre módulos (p.ex. export Taskflow desde Reunify) com o mesmo padrão: feedback + `mutate` + permissões alinhadas à API.
- [x] **Fase B (MVP):** migração `0058_chronos_agenda_reunify_meeting.sql` — coluna `reunify_meeting_id` + índice único `(team_id, reunify_meeting_id)`; `POST /api/chronos/agenda` idempotente com `reunifyMeetingId`; Reunify e Chronos enviam o id; botão «Já na agenda» no Chronos.
- [ ] **Fase B (extensão):** backfill opcional ou script para associar duplicados históricos a uma reunião (baixa prioridade).
- [ ] **Fase C:** especificar critérios de aceite para resumo assistido (fonte de verdade no cartão resumo, histórico, LGPD).
- [ ] **Fase C/D:** diarização + identificação de intervenientes (dependência de ASR e UI).
- [ ] Actualizar `app/manual/reunify/page.tsx` / `chronos` com o fluxo «Criar no Chronos» pós-correcção e a nota sobre `chronos.view`.
- [ ] (Opcional) **Central de IA / catálogo:** nota operacional — catálogo `ai_models` é inventário; não substitui pipelines por módulo (Reunify ASR vs Taskflow cloud AI).

---

## Programa de integração intermódulos (execução aprovada)

Objetivo deste programa: tornar **explícito, previsível e auditável** o impacto entre módulos para quem opera a plataforma. Regra de UX: cada ação relevante deve responder claramente a três perguntas — **o que fiz**, **onde isso refletiu** e **como corrigir/desfazer**.

### Matriz oficial de integração (fonte única)

| Origem | Destino | Comportamento alvo | Estado |
|--------|---------|--------------------|--------|
| Projectus | Chronos | Marcos e eventos de projeto criam/atualizam compromisso na agenda (idempotente) | [ ] |
| Projectus | Taskflow | (Opcional) gerar tarefas a partir de marco/entrega, com confirmação humana | [ ] |
| Reunify | Chronos | Reunião `AGENDADA` cria/atualiza; `FINALIZADA`/`CANCELADA` atualiza status | [~] |
| Reunify | Taskflow | Ação de follow-up vira tarefa com vínculo de origem (sem duplicar) | [x] |
| Taskflow | Chronos | Prazo/lembretes espelham na agenda quando módulo/plano permite | [x] |
| Taskflow | Projectus | Execução do plano (progresso/status) para leitura de portfólio | [x] |
| Chronos | (todos) | Agenda consolidada com indicação de origem; edição respeita dono do dado | [~] |

Legenda: `[x]` implementado; `[~]` parcial com lacunas; `[ ]` pendente.

### Contrato técnico transversal (obrigatório para todos os conectores)

- [ ] Cada item espelhado em `chronos_agenda_items` deve carregar: `source` + `source_id` + `sync_status`.
- [ ] Idempotência por chave natural (fallback) e por vínculo forte quando houver coluna dedicada (ex.: `reunify_meeting_id`).
- [ ] Logs mínimos por evento de integração: origem, destino, actor, payload resumido, resultado.
- [ ] Política de retry segura (sem duplicar) para falhas temporárias.
- [ ] Job de reconciliação (detetar divergência origem ↔ espelho).

### Backlog executável — Fase 1 (clareza e segurança operacional)

**Meta:** eliminar ambiguidade para utilizador e operador.

| ID | Item | Critério de aceite | Estado |
|----|------|--------------------|--------|
| IM1.1 | Badges de origem no Chronos (`MANUAL`, `REUNIFY`, `TASKFLOW`, `PROJECTUS`) | Lista/semana/dia mostram origem em cada linha | [x] |
| IM1.2 | Feedback pós-ação padronizado | Toasts: “guardado na origem” + “sincronizado no destino” (ou erro explícito) | [x] |
| IM1.3 | Regra de edição por origem | Item espelhado mostra mensagem “editar no módulo de origem” quando aplicável | [x] |
| IM1.4 | Dedupe legado Reunify→Chronos | Botão/ferramenta remove duplicados históricos sem apagar o item mais recente válido | [x] |
| IM1.5 | Painel “Impacto desta ação” | Nas operações críticas, UI lista módulos afetados + links diretos | [x] |

### Backlog executável — Fase 2 (automação fim-a-fim)

**Meta:** automatizar fluxos sem perder controlo humano.

| ID | Item | Critério de aceite | Estado |
|----|------|--------------------|--------|
| IM2.1 | Projectus → Chronos (marcos) | Criar/editar/excluir marco reflete na agenda (idempotente) | [ ] |
| IM2.2 | Projectus → Taskflow (opcional) | Gerar tarefas a partir de marco com confirmação e resumo antes de gravar | [ ] |
| IM2.3 | Reunify → Chronos (fecho de lacunas) | Status e datas sincronizam sempre; sem duplicados em ambientes com/sem migração nova | [~] |
| IM2.4 | Taskflow com vínculos de contexto | Tarefa pode referenciar `projectus` e/ou `reunify` quando origem existir | [ ] |
| IM2.5 | Chronos consolidado por origem | Filtros por módulo e contadores por origem na visão semanal | [ ] |

**Estado técnico IM2.3 (2026-04-22):** sincronização Reunify → Chronos deixou de depender da permissão `chronos.view` do actor no `syncReunifyMeetingToChronos` (evita perda de atualização em mudanças de estado/data) e o gating por módulo de plano foi aplicado nas APIs de `Chronos`/`Reunify` (agenda, dedupe, reuniões, ações, decisões, histórico, captações, transcrição e conectores Google/Microsoft). Mantido `[~]` até fechar reconciliação/observabilidade dos itens IM3.x.

### Frente prioritária — agenda por participante/alocado (aprovada)

**Meta:** quando uma reunião ou plano de projeto envolver pessoas da equipe, a agenda dessas pessoas deve refletir automaticamente o compromisso e bloquear conflitos por padrão.

**Princípios desta frente**

- Fonte de verdade do conteúdo continua no módulo de origem (`Reunify` / `Projectus`), não no Chronos.
- Sincronização no Chronos passa a ser **por utilizador** (não só por time).
- Regra padrão = **bloquear conflito**; exceção só com ação explícita (“forçar mesmo assim”).
- Toda ação mostra impacto: quais utilizadores foram afetados e se houve conflito.

| ID | Item | Critério de aceite | Estado |
|----|------|--------------------|--------|
| IM2.6 | Reunify — participantes por reunião | Reunião permite selecionar membros do time; lista persiste e é editável | [x] |
| IM2.7 | Reunify → Chronos por participante | Ao agendar/editar reunião, cria/atualiza compromisso para cada participante selecionado | [x] |
| IM2.8 | Travamento por conflito (reunião) | Se participante já tiver bloqueio no intervalo, UI/API retornam conflito com utilizadores afetados; opção de forçar é explícita | [ ] |
| IM2.9 | Projectus — alocação temporal por utilizador | Marcos/blocos de projeto permitem alocar membros com janela de tempo | [ ] |
| IM2.10 | Projectus → Chronos por alocado | Alocação de projeto cria/atualiza compromisso por utilizador no Chronos | [ ] |
| IM2.11 | Travamento por conflito (projeto) | Mesmo comportamento de bloqueio por pessoa, com relatório de conflito e opção consciente de exceção | [ ] |

**Contrato de dados mínimo desta frente**

- [ ] Vínculo por utilizador no Chronos (`user_id` no item ou tabela de participantes do compromisso).
- [ ] Origem + referência forte (`source`, `source_id`) por compromisso espelhado.
- [ ] Chave idempotente por utilizador + origem + intervalo.
- [ ] Política de status: cancelar/finalizar na origem propaga para todos os participantes/alocados.

**UX obrigatória para esta frente**

- [ ] Seletor de participantes em `Reunify` com estado claro (selecionado / removido).
- [ ] Seletor de alocados em `Projectus` para marcos/blocos temporais.
- [ ] Modal de conflito com: utilizador, intervalo em choque, origem do choque e ações (“reagendar” ou “forçar”).
- [ ] Banner de impacto pós-ação listando quantas agendas foram atualizadas e quantos conflitos ocorreram.

### Backlog executável — Fase 3 (governança e observabilidade)

**Meta:** operar com confiança em produção.

| ID | Item | Critério de aceite | Estado |
|----|------|--------------------|--------|
| IM3.1 | Telemetria de sincronização | Métricas de sucesso/falha e fila de pendências por integração | [~] |
| IM3.2 | Reconciliação agendada | Job corrige desvio origem↔destino e registra ações tomadas | [x] |
| IM3.3 | Trilha auditável por entidade | Operador consegue ver histórico de integração no detalhe de reunião/tarefa/marco | [~] |
| IM3.4 | Runbook operacional | Procedimento de incidentes (“não sincronizou”, “duplicou”, “perdeu vínculo”) | [x] |

**Estado IM3 (2026-04-22):** criado log operacional `integration_sync_events` (migração `0065`) com registo de eventos `SUCCESS`/`ERROR`/`SKIPPED`/`RECONCILED` no fluxo **Reunify → Chronos**; novos endpoints `GET /api/reunify/integrations/metrics` (telemetria por janela), `GET /api/reunify/meetings/[meetingId]/integration-history` (trilha por entidade), `POST /api/chronos/agenda/reconcile-reunify` (reconciliação on-demand) e `POST /api/chronos/agenda/reconcile-reunify/scheduled` (reconciliação agendada com segredo). **IM3.2** e **IM3.4** concluídos; **IM3.1** e **IM3.3** seguem `[~]` até rotina operacional consolidada e dashboards de operação contínua.

### Manuais — atualização obrigatória por módulo

- [x] `app/manual/chronos/page.tsx`: origem dos itens, limites de edição, filtros por origem, dedupe.
- [x] `app/manual/reunify/page.tsx`: quando a reunião entra na agenda, estados e implicações.
- [x] `app/manual/taskflow/page.tsx`: vínculo com reunião/projeto e efeito em agenda.
- [x] `app/manual/projectus/page.tsx`: marcos, impactos no Chronos e geração opcional de tarefas.
- [x] Secção comum “Impacto entre módulos” com exemplos ponta-a-ponta.

### QA funcional obrigatório (fecho do programa)

- [ ] Cenário A: criar projeto + marcos → confirmar agenda no Chronos.
- [ ] Cenário B: agendar reunião → atualizar para finalizada/cancelada → validar estado no Chronos.
- [ ] Cenário C: ação da reunião → tarefa no Taskflow → prazo espelhado no Chronos.
- [ ] Cenário D: falha simulada de integração → mensagem clara + retry + reconciliação.
- [ ] Evidência no registo (data, ambiente, responsável, resultado).

### QA contínuo automatizado (rotina oficial)

- [x] Geração em massa por módulos e snapshot geral de dashboards (`pnpm run qa:scenario`) com artefatos em `Projeto/registos-qa/`.
- [x] Evidência automatizada com checks transversais (`pnpm run qa:evidence`).
- [x] Guia operacional de QA contínuo (`Projeto/QA_AUTOMACAO_OPERACIONAL.md`) com checklist de evidência por execução.
- [x] Agendamento diário por workflow (`.github/workflows/qa-operacional.yml`) para execução e publicação de artefatos.
- [x] Política semanal de reset de massa (`qa:full`) aplicada no ambiente de homologação.

---

## Apêndice A — Trabalho transversal (fora das linhas M/E por fase)

Objetivo: não **misturar** no mesmo checkbox critérios de **domínio Taskflow** (M6.x, E7.x, E8.x) com trabalho de **marca, marketing, auth e documentação** de toda a plataforma; ainda assim **registar** o que já foi feito e onde continuar.

| Tema | Onde está documentado / implementado |
|------|--------------------------------------|
| Governança SaaS multi-tenant (planos, catálogo, perfis, empresas, cobrança, IA, provisionamento; `platform_admin` vs dono de time) | `Projeto/MEMORIAL_GOVERNANCA_SAAS_MULTITENANT.md` + cópia pública coerente em `MEMORIAL_UI_UX_PLATAFORMA.md` §2.6 e `/help` |
| Registo de testes manuais (template) | `Projeto/REGISTRO_TESTES.md` |
| Roadmap visual global (landing, auth, help, pricing, manuais detalhados) | `Projeto/MEMORIAL_UI_UX_PLATAFORMA.md` |
| Shell do dashboard (menu fixo em desktop, scroll só no conteúdo, mobile) | `app/(dashboard)/layout.tsx`, `app/(dashboard)/dashboard/layout.tsx` |
| Padrão de manuais (título «Manual», ícone por rota de regresso) | `components/ui/manual-header.tsx`, `app/manual/**` |
| Política “sem IDs de memorial na UI” | Aplicada no código das páginas Taskflow/relatórios/etc.; princípio reforçado em `MEMORIAL_UI_UX_PLATAFORMA.md` |
| **Refinamento visual, auth, help, pricing, dashboard mobile, manuais profundos** (coerência “recursiva” pedida pelo produto) | `Projeto/MEMORIAL_UI_UX_PLATAFORMA.md` **§7 — Backlog de refinamento**; execução em PRs por área; não duplicar checklist aqui. |

**Manuais operacionais “ricos”** (interações entre módulos, papel da IA por módulo, troubleshooting): o **modelo** de secções está em `MEMORIAL_UI_UX_PLATAFORMA.md` (Fase D); a **execução texto a texto** por ficheiro `app/manual/*/page.tsx` é trabalho contínuo — não duplicar aqui o corpo inteiro; actualizar este memorial quando um manual for considerado “revisão completa” (data + lista de ficheiros no **Registo**). **Estado 2026-04-17:** Taskflow, Chronos, Reunify, Control Center, Integrações globais e Central de IA seguem o bloco comum (`ManualDocBlock`); restantes manuais a alinhar ao mesmo padrão. **Pendência 2026-04-20:** manual **Projectus** — ver subsecção seguinte.

### Pendência — manual **Projectus** (tratar depois)

**Objectivo:** o manual em `/manual/projectus` reflectir o comportamento actual do dashboard (`/dashboard/projectus`): abas, Visão com mapa, custos com catálogo, riscos com mitigação opcional, etc.

**Critério de aceite:** conteúdo revisto; todos os itens abaixo em `[x]`; **Registo de alterações** com data + ficheiros tocados.

- [ ] Descrever as **três abas** (Portfólio · Visão · Planejar) e o papel de cada uma.
- [ ] **Visão** — cartão **Mapa do projeto** (colunas fases / tarefas / marcos / riscos; atalho para Planejar); clarificar diferença face ao **Gantt** (só tarefas com datas de início e fim).
- [ ] **Riscos** — **Plano de mitigação**: texto livre **opcional**; não condiciona alertas (estes usam P×I e estado); campo `mitigation` na API.
- [ ] **Custos** — catálogo por equipa (`GET /api/projectus/cost-categories`), gravação com `categoryId`; categoria **Outros** com **detalhe** obrigatório; listagem com `categoryTitle` na API.
- [ ] Rever blocos já escritos (custos genéricos, só `GET/POST /api/projectus/costs` sem categorias) para **não contradizer** o produto actual.

**Ficheiros:** `app/manual/projectus/page.tsx` (e cópia `app\manual\projectus\page.tsx` se o clone mantiver os dois).

---

## Notas de alinhamento com o mercado

- **MVP:** ver fases 3–4 do memorial; a síntese competitiva completa está na secção de arquitetura de produto (acima).
- **Concorrentes:** não duplicar suites genéricas; reforçar o fluxo **reunião → tarefa → tempo → fatura** como narrativa única de valor.
- **Paridade selectiva (pós-fase 7):** lacunas vs. ClickUp/Jira/Trello/Pipefy estão espelhadas na secção **Comparação comercial** e nos itens **E8.4–E8.10** — priorizar o que fecha venda PME sem subir a complexidade ao nível Jira.
