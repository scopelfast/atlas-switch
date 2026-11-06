# LGPD mínima — Atlas Switch (política e plano técnico)

| Campo | Valor |
|--------|--------|
| **Documento** | Fase 8 — **I8.3** |
| **Data** | 2026-04-14 |
| **Âmbito** | Plataforma Atlas Switch (utilizadores, equipas, logs, Taskflow e módulos ligados) |

> **Aviso:** este texto orienta **engenharia e produto**; **não** substitui parecer jurídico nem política de privacidade publicada ao utilizador final. Ajustar com counsel antes de produção comercial.

## 1. Papel e dados tratados

- **Controlador** típico em instalação **self-hosted** pela PME: o **cliente** que opera o Atlas; em SaaS multi-cliente seria o **fornecedor** Atlas — definir no contrato.
- **Categorias de dados pessoais** hoje na BD (inventário resumido):
  - **Conta:** `users` — nome, e-mail, `password_hash` (nunca exportar nem expor em API pública), `avatar_url`, `role`, datas.
  - **Equipa:** `team_members`, `teams` — relação utilizador–time, papel, `reports_to_user_id`.
  - **Convites:** `invitations` — e-mail, nome convidado, estado (tokens só hash; não replicar em export portátil sem necessidade).
  - **Actividade:** `activity_logs` — `user_id`, `ip_address`, `action`, `timestamp`, `team_id`.
  - **Taskflow e outros módulos:** títulos, descrições, anexos, intervenções — podem conter **dados de terceiros**; o export **mínimo** (Fase 1) limita-se ao **perfil e membrias**; export alargado fica nas fases seguintes.

## 2. Base legal (orientação)

- **Execução de contrato** / **legítimo interesse** (gestão interna da equipa) para a maior parte do produto.
- **Consentimento** onde houver opt-in explícito (ex.: **E7.3** insights, futuras integrações **I8.4** / IA **E8.x**).
- Documentar **registos de consentimento** quando implementados.

## 3. Direitos do titular (LGPD Art. 18 — resumo operacional)

| Direito | O que fazemos agora | Próximas fases |
|---------|---------------------|----------------|
| **Confirmação e acesso** | Utilizador autenticado vê perfil na app; **Fase 1:** `GET /api/user/personal-data-export` (JSON) | UI “Descarregar os meus dados” |
| **Correcção** | Fluxos de perfil / admin já existentes | Unificar checklist |
| **Eliminação** | `users.deletedAt` (soft delete) em fluxos de remoção | Pedido formal + anonimização de logs e PII em conteúdos |
| **Portabilidade** | Export JSON **Fase 1** | CSV/PDF alargado, **I8.3** alinhado a **E7.2** |
| **Informação sobre partilhas** | Documentar subprocessadores se usar SMTP, Stripe, APIs cloud | Secção no site / contrato |

## 4. Retenção e logs

| Dado | Retenção sugerida (política) | Implementação técnica |
|------|------------------------------|-------------------------|
| `activity_logs` | **24 meses** máximo (ajustável por ADR); após prazo **anonimizar** `user_id` e `ip_address` ou apagar | **Fase 2** — job agendado + migração |
| Convites `pending` expirados | Já há regras M2.x; manter política escrita | — |
| Anexos Taskflow | Até remoção da tarefa ou pedido de apagamento | **Fase 3** — script + UI |

## 5. Segurança mínima (já alinhada ao memorial)

- RBAC em todas as rotas sensíveis; **M6.8** em listagens Taskflow.
- Não registar **segredos** em `activity_logs`.
- Revisar `GET /api/user` para **não** expor `password_hash` ao cliente (melhoria recomendada em **Fase 2**).

## 6. Implementação faseada

### Fase 1 — **Concluída** (I8.3 critério mínimo)

- [x] Política (este documento).
- [x] `GET /api/user/personal-data-export` — JSON com dados do titular **sem** hash de senha; membrias de equipa; convites associados ao e-mail (sem `token_hash`); amostra de `activity_logs` onde `user_id` = titular (limite 500); metadados de ligações opcionais **Microsoft 365 Graph** e **Google Calendar** (e-mail da conta ligada, sem tokens OAuth).
- [x] Resposta ao cliente **sem** `password_hash`: `lib/auth/user-response.ts` (`userForClientResponse`); `GET /api/user`; fallback SWR em `app/layout.tsx` (layout raiz **async**).

### Fase 2 — Retenção e endurecimento

- [ ] Job de truncagem/anonimização de `activity_logs` conforme secção 4.
- [ ] Registo de bases legais por funcionalidade (tabela ou doc).

### Fase 3 — Eliminação e portabilidade alargada

- [ ] Fluxo “Solicitar eliminação da conta” (ticket ou UI) + procedimento interno.
- [ ] Export opcional de metadados de tarefas em que o utilizador é responsável (respeitando **M6.8** e dados de terceiros).

### Fase 4 — Transparência ao utilizador

- [ ] Página pública **Política de privacidade** + **Termos** (fora do escopo deste ficheiro técnico).

## 7. Referências

- `Projeto/MEMORIAL_TASKFLOW_EXECUCAO.md` — **I8.3**, **I8.4**, **E8.7**, **E8.17** (formulários / áudio).
- `app/api/user/personal-data-export/route.ts`
- `lib/auth/user-response.ts`, `app/layout.tsx`, `app/api/user/route.ts`
