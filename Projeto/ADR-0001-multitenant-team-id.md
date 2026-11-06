# ADR 0001 — Modelo multi-tenant: `team_id` (actual) vs schema Postgres por tenant

| Campo | Valor |
|-------|--------|
| **Estado** | Aceite |
| **Data** | 2026-04-14 |
| **Âmbito** | Atlas Switch — base de dados PostgreSQL, aplicação Next.js, Drizzle ORM |

## Contexto

O produto serve **vários times** (`teams`) na mesma instância de aplicação. Os dados de negócio (Taskflow, Chronos, Reunify, etc.) estão modelados com **isolamento lógico** via coluna **`team_id`** (ou via `user_id` + `team_members` que resolve o time activo), num **único schema** (`public`) e **uma** base de dados por ambiente (ex.: produção).

O memorial original mencionava a alternativa **schema dedicado por tenant** (ou variantes) em Postgres. É necessário **fixar a decisão** para não misturar abordagens em migrações futuras nem bloquear a Fase 8 (I8.1).

## Decisão

**Manter o modelo actual: schema partilhado + `team_id` (e chaves derivadas) como fronteira de tenant.**

- Todas as novas entidades multi-tenant **devem** incluir `team_id` quando fizer sentido ao domínio, ou referenciar entidades que já o garantem (ex.: tarefa → board → team).
- **RBAC** e **queries** continuam responsáveis por **nunca** expor dados de outro time (padrão já exigido no memorial, ex.: M6.8).
- Migrações Drizzle permanecem **globais** por ambiente; **não** se introduz schema-per-tenant neste ADR.

## Consequências

### Positivas

- **Simplicidade operacional:** um conjunto de migrações, backups e monitorização por ambiente.
- **Custo** adequado a PME: não multiplica instâncias de Postgres por cliente.
- **Alinhamento** com o código e dados **já existentes** (`teams`, `team_members`, colunas `team_id` em dezenas de tabelas).

### Negativas / riscos

- **Isolamento** é por **aplicação + BD**, não por “hard fence” ao nível de schema; um bug de query sem `team_id` pode ser **grave** — mitigação: revisões, testes, padrões de query (Drizzle `where(eq(..., teamId))`), eventual **Row Level Security** (RLS) Postgres como **evolução futura** (novo ADR se for adoptado).
- Clientes com **requisito legal estrito** de segregação física de dados podem exigir **instância dedicada** (deploy separado) em vez de schema por tenant na mesma BD.

## Alternativas consideradas

| Alternativa | Porque não agora |
|--------------|------------------|
| **Schema Postgres por tenant** (`tenant_a.taskflow_tasks`, …) | Migração massiva das migrações existentes; complexidade em Drizzle/connection routing; custo de manutenção elevado para o tamanho actual do produto. |
| **Base de dados por tenant** | Máximo isolamento, mas custo e operações (migrações N vezes) incompatíveis com o posicionamento PME MVP. |
| **RLS obrigatório em todas as tabelas** | Forte defesa em profundidade; **não** decidido neste ADR — pode ser ADR futuro após avaliação de performance e de `SET app.current_team_id` em pool de ligações. |

## Quando rever

- Pedido **explícito** de cliente enterprise + revisão legal.
- Incidente ou auditoria que imponha **segregação** mais forte que `team_id` + RBAC.
- Equipa preparar **RLS** ou **read replicas** por região — documentar em novo ADR.

## Referências no repositório

- `lib/db/schema.ts` — tabela `teams`, `team_members`, padrão `teamId` / `team_id` nas entidades.
- `lib/db/queries.ts` — `getTeamForUser()` como contexto de time na sessão.
- Memorial: **I8.1** (Fase 8), princípio de domínio explícito na secção de arquitectura de produto.
