# ADR 0003 — Épico (hierarquia) e sprint leve no Taskflow (E8.9)

## Contexto

O memorial E8.9 pede agrupamento tipo épico opcional e timebox/sprint leve, sem obrigar Scrum, mantendo M6.8 e sem bloquear Projectus (portfólio macro).

## Decisão

1. **Hierarquia (épico / subtarefa):** campo opcional `taskflow_tasks.parent_task_id` → `taskflow_tasks.id` (`ON DELETE SET NULL`). Uma linha por relação pai–filho; profundidade ilimitada na BD, validação de **ciclos** e **mesmo quadro** no servidor.
2. **Sprint:** tabela `taskflow_sprints` por `team_id` com `name`, `start_at`, `end_at`. Campo opcional `taskflow_tasks.sprint_id` → `taskflow_sprints.id` (`ON DELETE SET NULL`). Filtro «só sprint X» no quadro = filtro de UI/API por `sprint_id`.
3. **Projectus:** continua a fonte de portfólio/cronograma macro; Taskflow = execução operacional (tarefas do quadro). `project_id` em tarefas permanece independente dos sprints.

## Alternativas rejeitadas (por agora)

- **`taskflow_task_links` tipo EPIC_CHILD:** mais flexível para N:N, mas mais complexo para MVP e para o operador; pode evoluir se surgir necessidade.
- **Sprints só por etiquetas:** frágil para relatórios e RBAC; tabela explícita é mais clara.

## Consequências

- Migração nova + índices em `parent_task_id` / `sprint_id`.
- `POST`/`PATCH` de tarefas validam pai (mesmo quadro, sem ciclo) e sprint (mesmo time).

## Revisão

Rever se surgirem **épicos trans-quadro** ou **sprints por board** em vez de por time.
