# ADR-0007 — Armazenamento de captações Reunify (E8.17)

## Contexto

O memorial **E8.17** pede ingestão por **upload** ou **ligação**, com **I8.3**, e deixa **OBS** e SDKs comerciais fora do núcleo ou como evolução.

## Decisão

1. Metadados em **`reunify_meeting_captures`**; ficheiros em **`uploads/reunify-captures/`** (fora de `public`), servidos só por rota autenticada com `reunify.view`.
2. **Sem** processamento de áudio no servidor neste MVP: não há ASR nem envio a terceiros automático.
3. Ligações externas são **referências**; o Atlas não valida o destino além de esquema URL e bloqueio de credenciais na própria string.

## Consequências

- Operação e cópias de segurança devem incluir a pasta de uploads se a instância usar uploads.
- Uma futura fila de transcrição deve definir retenção, quotas e apagamento seguro em ADR complementar.

## Estado

MVP **E8.17** (ligação + upload + UI Reunify + export I8.3) alinhado a esta fronteira.
