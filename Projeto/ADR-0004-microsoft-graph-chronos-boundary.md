# ADR-0004 — Microsoft Graph (E8.12) e fronteira com Chronos

## Contexto

O memorial **E8.12** exige leitura ou sincronização mínima com consentimento, **I8.4** (toggles) e **I8.3** (LGPD), e proíbe **substituir Chronos sem ADR**.

## Decisão

1. **Chronos** (`chronos_agenda_items`) continua a **fonte de verdade** da agenda nativa Atlas (criação, edição, espelho Taskflow **M6.9**).
2. **Microsoft Graph** expõe apenas **pré-visualização só leitura** do calendário do utilizador que ligou a conta Microsoft 365, na página Chronos, **sem** escrita automática em `chronos_agenda_items`.
3. **OAuth** é **por utilizador**; o refresh token é guardado **cifrado** (derivado de `AUTH_SECRET`); revogação local = `DELETE` da ligação.
4. A instância só permite o fluxo se `integrations.microsoft_graph` = `true` em **I8.4** e variáveis `MICROSOFT_*` estiverem definidas.

## Consequências

- PME vê eventos Outlook na mesma janela temporal que a agenda Chronos, sem risco de duplicar ou conflitar silenciosamente com o espelho Taskflow.
- Uma futura **sincronização** (importação selectiva ou agendamento) exige **novo ADR** e provavelmente fila de trabalhos + regras de deduplicação.

## Estado

MVP **E8.12** alinhado a esta fronteira (leitura + OAuth + UI Chronos).
