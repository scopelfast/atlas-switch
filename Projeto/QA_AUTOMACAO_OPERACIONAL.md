# QA automatizado operacional (execucao em massa)

Este guia permite validar rapidamente o comportamento dos modulos sem teste manual um-a-um.

## Comandos

- Apenas gerar dados e relatorio:
  - `pnpm run qa:scenario`
- Gerar evidencias + checks automatizados:
  - `pnpm run qa:evidence`
- Ciclo completo (limpa operacional, semeia base, gera massa, roda checks):
  - `pnpm run qa:full`

## O que o `qa:scenario` faz

- Gera massa de dados nos modulos:
  - Taskflow
  - Reunify
  - Chronos
  - Projectus
  - ResourceHub
  - Billtrak
  - Notepad
  - Bibliotheca
  - Scriptum
- Usa tag de execucao (`QA-AUTO-YYYYMMDD-HHMMSS`) para rastreabilidade.
- Escreve artefatos de validacao em:
  - `Projeto/registos-qa/qa-operacional-<tag>.json`
  - `Projeto/registos-qa/qa-operacional-<tag>.md`

## Conteudo do relatorio

- Volume inserido por tabela/modulo.
- Snapshot consolidado para leitura de dashboard:
  - total de tarefas e distribuicao aberta/concluida (Taskflow)
  - reunioes e acoes (Reunify)
  - total de compromissos (Chronos)
  - contas/lancamentos/transacoes e soma credito/debito (Billtrak)
  - projetos/tarefas (Projectus)
  - recursos/alocacoes (ResourceHub)
  - projetos/capitulos (Scriptum)
  - notas (Notepad)
  - documentos (Bibliotheca)

## Observacoes operacionais

- O script espera que exista o time seed `Time AtlasSwitch` (via `pnpm run db:seed`).
- Em ambiente compartilhado, preferir usar primeiro `db:clear:operational -- --confirm`.
- O objetivo e validacao funcional e visual de massa (dashboards), nao benchmark de performance.

## Checklist de evidencia por execucao (oficial)

- [ ] Rodou `qa:scenario` ou `qa:evidence` com sucesso.
- [ ] Artefato markdown gerado em `Projeto/registos-qa/qa-operacional-<tag>.md`.
- [ ] Artefato json gerado em `Projeto/registos-qa/qa-operacional-<tag>.json`.
- [ ] Snapshot de dashboard validado (Taskflow, Reunify, Chronos, Billtrak, Projectus, ResourceHub, Scriptum, Notepad, Bibliotheca).
- [ ] Resultado de checks registrado (invite invariants e AI pipeline).

## Agenda automatica (diario/semanal)

Repositorio preparado com workflow agendado:

- Arquivo: `.github/workflows/qa-operacional.yml`
- Execucao diaria automatica (UTC) de `pnpm run qa:evidence`.
- Publicacao dos artefatos de QA no workflow (download em Actions).

Workflow semanal separado (ciclo completo):

- Arquivo: `.github/workflows/qa-operacional-semanal.yml`
- Execucao semanal automatica: domingo 06:00 UTC
- Comando executado: `pnpm run qa:full`
- Publica artefatos em `qa-operacional-semanal-artifacts`

Requisitos de ambiente no GitHub:

- `POSTGRES_URL` (staging homologado para QA)
- `BASE_URL` (ex.: URL de staging)
