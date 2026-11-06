# Roadmap — ClientFlow & Contractus ligados ao Taskflow

| Campo | Valor |
|--------|--------|
| **Documento** | Integração aspiracional (Fase 8 — **I8.2**) |
| **Data** | 2026-04-14 |
| **Relaciona com** | `Projeto/MEMORIAL_TASKFLOW_EXECUCAO.md`, `Projeto/ADR-0001-multitenant-team-id.md` |

## 1. Definições (produto)

| Módulo | Papel na narrativa Atlas (“reunião → tarefa → tempo → fatura”) | Estado no repositório (Abr/2026) |
|--------|-------------------------------------------------------------------|----------------------------------|
| **Taskflow** | Compromissos operacionais (Kanban, intervenções, relatórios) | **Implementado** (fases 3–7 do memorial) |
| **Reunify** | Reuniões e planos de acção | **Implementado**; ligação explícita a tarefas (**M6.11**) |
| **Projectus** | Projetos, marcos, riscos, custos; visão `taskflow` parcial | **Implementado**; continua a ser o “parent” natural de trabalho por projeto |
| **ClientFlow** (aspiracional) | **CRM / pipeline comercial** — oportunidades, contas, propostas, histórico com cliente | **Não** existe módulo homónimo no código; nome reservado no memorial longo |
| **Contractus** (aspiracional) | **Contratos e obrigações** — prazos contratuais, renovações, SLA comercial | **Não** existe módulo homónimo no código |
| **BillTrak** | Faturação / finanças operacionais | **Parcial** no código; narrativa “tempo → fatura” no memorial |

**ClientFlow** e **Contractus** são, neste roadmap, **módulos de domínio futuros** — não bloqueiam o Taskflow. A integração desenhada abaixo usa **`team_id`** e APIs existentes como contrato (alinhado ao **ADR-0001**).

## 2. Princípios de integração com o Taskflow

1. **Uma tarefa continua a pertencer a um board** (`taskflow_tasks` → `taskflow_boards` → `team_id`); módulos novos **referenciam** `taskflow_tasks.id` ou expõem `taskflowTaskId` opcional (padrão já usado em Chronos **M6.9** e Reunify **M6.11**).
2. **RBAC:** `taskflow.view` e regras **M6.8** aplicam-se a qualquer UI que mostre tarefas; ClientFlow/Contractus **não** contornam o filtro.
3. **Idempotência:** criar tarefa a partir de oportunidade ou cláusula contratual segue o mesmo rigor que **M6.11** (revisão humana ou chave de idempotência por origem).
4. **Sem duplicar Projectus** até haver ADR de fronteiras: **Projectus** = entrega de projeto; **ClientFlow** = relação comercial; **Contractus** = acordo legal — podem coexistir com `projectId` na tarefa quando fizer sentido.

## 3. Pontos de ligação (contrato lógico)

| Origem (futuro) | Destino Taskflow | Mecanismo sugerido |
|------------------|-------------------|-------------------|
| **Oportunidade** ganha / perde etapa (ClientFlow) | Criar ou actualizar tarefa tipo `commercial` / etiqueta | API interna `POST /api/taskflow/tasks` + `metadata` ou tabela de link `clientflow_opportunity_taskflow_task` (futura migração) |
| **Marco contratual** (Contractus — entrega, renovação) | Tarefa com `dueDate` + notificação Chronos | Espelho semelhante a `syncChronosMirrorForTaskflowTask`; job ou trigger ao gravar marco |
| **Cláusula “ação interna”** | Checklist ou sub-tarefas | Reutilizar labels/tipos; ou entidade “obrigação” com FK `taskflow_task_id` |
| **Reunify** (já) | Plano de acção → tarefa | **M6.11** — manter como referência de UX e idempotência |

## 4. Priorização (issues / fases de entrega)

### P0 — Documentação e limites (sem código obrigatório)

- [x] **I8.2** — Este roadmap + memorial actualizado.
- [ ] Nomear owner de produto para **fronteira ClientFlow vs Projectus** (evitar dois CRMs sem querer).

### P1 — Mínimo viável ClientFlow → Taskflow (quando existir MVP ClientFlow)

- [ ] Modelo de dados: `account` / `opportunity` com `team_id`; opcional `taskflow_task_id` na oportunidade.
- [ ] UI: botão “Criar tarefa no Taskflow” com pré-preenchimento (título, prazo, responsável).
- [ ] Webhook interno ou evento `OPPORTUNITY_WON` → tarefa template (integra com **E8.5** quando existir).

### P2 — Contractus → Taskflow

- [ ] Entidade `contract` + `milestone` com `team_id`; FK opcional `taskflow_task_id`.
- [ ] Alertas de renovação: Chronos + e-mail (reutilizar padrões de notificação existentes).

### P3 — Visão unificada (“linha do tempo cliente”)

- [ ] Ecrã ou API que agrega: oportunidades (ClientFlow), tarefas (Taskflow), reuniões (Reunify), marcos (Projectus) — **só leitura**; M6.8 estrito.

## 5. Dependências

| Dependência | Motivo |
|-------------|--------|
| **I8.4** | Segredos e toggles se integrações forem a SaaS externos |
| **I8.3** | Dados pessoais de contactos no ClientFlow |
| **E8.5** | Webhooks para CRM externo enquanto ClientFlow nativo não existir |
| **ADR-0001** | Todos os novos links mantêm `team_id` explícito |

## 6. Riscos

- **Scope creep:** ClientFlow virar segundo Projectus — mitigar com **P0** (fronteira de produto).
- **Performance:** agregações “linha do tempo” — índices por `team_id` + paginação obrigatória.

## 7. Revisão

Rever este documento **trimestralmente** ou ao abrir desenvolvimento do primeiro epic ClientFlow/Contractus no repositório.
