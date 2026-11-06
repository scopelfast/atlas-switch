# Runbook operacional — Integrações intermódulos (Atlas Switch)

Documento de operação para incidentes de sincronização entre módulos, com foco no fluxo atual
`Reunify -> Chronos` e no padrão que deve ser reaproveitado pelos demais conectores.

## 1) Objetivo e escopo

- Responder rapidamente a incidentes de integração em produção.
- Padronizar diagnóstico, mitigação e fechamento com evidência.
- Cobrir os três cenários críticos do memorial:
  - "não sincronizou";
  - "duplicou";
  - "perdeu vínculo".

Escopo atual validado em código:

- Telemetria: `GET /api/reunify/integrations/metrics`
- Trilha por reunião: `GET /api/reunify/meetings/[meetingId]/integration-history`
- Reconciliação on-demand: `POST /api/chronos/agenda/reconcile-reunify`
- Reconciliação agendada: `POST /api/chronos/agenda/reconcile-reunify/scheduled`
- Log operacional: tabela `integration_sync_events`

## 2) Pré-requisitos operacionais

- Conta com papel global **`platform_admin`** (Centro de Controlo / APIs globais) **ou** credenciais técnicas equivalentes para as rotas necessárias; para validação no produto, confirme também permissões no **time** afectado (`taskflow`, `chronos`, etc.).
- Ambiente identificado (dev, staging, produção).
- Janela temporal do incidente (hora aproximada inicial e final).
- ID da reunião afetada (quando houver) e time envolvido.

## 3) Matriz de severidade

- `SEV-1`: indisponibilidade ampla de sincronização ou perda de dados em múltiplos times.
- `SEV-2`: falha recorrente em um time/módulo sem perda irreversível.
- `SEV-3`: falha pontual com workaround imediato.

## 4) Procedimento base (sempre executar)

1. Confirmar sintoma funcional com evidência (print/log/API).
2. Coletar métricas agregadas da integração:
   - `GET /api/reunify/integrations/metrics?integrationKey=reunify_to_chronos&lookbackHours=24`
3. Coletar trilha da entidade afetada:
   - `GET /api/reunify/meetings/{meetingId}/integration-history`
4. Classificar tipo do incidente (`não sincronizou`, `duplicou`, `perdeu vínculo`).
5. Aplicar playbook específico (seções 5, 6, 7).
6. Revalidar funcionalmente no módulo de origem e no destino.
7. Registrar evidência de fechamento (seção 9).

## 5) Playbook A — "Não sincronizou"

Sinais típicos:

- A reunião foi criada/alterada no Reunify, mas não apareceu/atualizou no Chronos.
- Histórico com `ERROR` ou excesso de `SKIPPED` não esperado.

Passos:

1. Verificar histórico por reunião (`integration-history`) e identificar último evento.
2. Se houver erro transitório, executar reconciliação:
   - `POST /api/chronos/agenda/reconcile-reunify`
3. Confirmar se foram gerados eventos `RECONCILED` em `integration_sync_events`.
4. Validar no Chronos:
   - item de agenda presente;
   - data/horário/status coerentes com o Reunify.
5. Se persistir:
   - abrir incidente para engenharia com payload resumido e timestamps.

Critério de encerramento:

- Item refletido no Chronos + histórico atualizado com sucesso/reconciliado.

## 6) Playbook B — "Duplicou"

Sinais típicos:

- Dois ou mais itens de agenda equivalentes para a mesma reunião/origem.

Passos:

1. Identificar duplicidade no Chronos (mesmo `source`, `source_id`/reunião e intervalo).
2. Executar reconciliação on-demand:
   - `POST /api/chronos/agenda/reconcile-reunify`
3. Validar histórico de integração para a entidade:
   - presença de `RECONCILED` com operação corretiva.
4. Confirmar que restou apenas o item válido.

Critério de encerramento:

- Um único item consistente por entidade de origem.

## 7) Playbook C — "Perdeu vínculo"

Sinais típicos:

- Item existe no Chronos, mas sem rastreio operacional coerente.
- Atualizações futuras da origem deixam de refletir corretamente.

Passos:

1. Verificar trilha da entidade e detectar ausência/quebra de continuidade de eventos.
2. Executar reconciliação on-demand para reconstituir espelho.
3. Validar novos eventos operacionais (`RECONCILED` e subsequentes).
4. Confirmar novo ciclo de atualização origem -> destino (teste controlado).

Critério de encerramento:

- Trilha restaurada e sincronização voltando a ocorrer em alterações novas.

## 8) Escalonamento

Escalonar para engenharia quando:

- reconciliação não corrige;
- erro recorrente em múltiplas entidades;
- suspeita de regressão após deploy;
- necessidade de intervenção de schema/migração.

Checklist de escalonamento:

- ambiente;
- teamId;
- meetingId(s) afetados;
- janela temporal;
- resposta dos endpoints de métricas/trilha/reconciliação;
- evidência visual (Reunify e Chronos).

## 9) Evidência e fechamento

No fechamento do incidente, registar:

- data/hora;
- operador responsável;
- tipo do incidente (A/B/C);
- ação aplicada (ex.: reconciliação);
- resultado funcional;
- links/identificadores de evidência.

Modelo mínimo de registo:

`[DATA-HORA] [AMBIENTE] [TEAM] [ENTIDADE] [TIPO] [AÇÃO] [RESULTADO] [RESPONSÁVEL]`

## 10) Melhoria contínua

- Reincidência do mesmo padrão em 7 dias: abrir ação corretiva com owner técnico.
- Incidentes `SEV-1`/`SEV-2`: revisar se o runbook precisa de novo passo e atualizar este arquivo.
- Qualquer novo conector intermódulos deve nascer já com:
  - telemetria básica;
  - trilha por entidade;
  - reconciliação executável;
  - seção correspondente neste runbook.
