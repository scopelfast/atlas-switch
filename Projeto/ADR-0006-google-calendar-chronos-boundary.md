# ADR-0006 — Google Calendar API (E8.16) e fronteira com Chronos

## Contexto

O memorial **E8.16** exige OAuth e leitura de eventos em paralelo ao **Microsoft Graph (E8.12)**, com **I8.4** (toggle `integrations.google_calendar`) e **I8.3**, e a regra de não duplicar o espelho Chronos/Taskflow sem ADR.

## Decisão

1. **Chronos** (`chronos_agenda_items`) mantém-se como **fonte de verdade** da agenda nativa Atlas (incluindo espelho Taskflow **M6.9**).
2. **Google Calendar** expõe apenas **pré-visualização só leitura** dos eventos do calendário principal (`primary`) do utilizador que ligou a conta Google, na página Chronos, **sem** escrita automática em `chronos_agenda_items`.
3. **OAuth** é **por utilizador**; o refresh token é guardado **cifrado** (mesmo esquema AES-256-GCM que E8.12, derivado de `AUTH_SECRET`); revogação local = `DELETE` da ligação.
4. A instância só permite o fluxo se `integrations.google_calendar` = `true` em **I8.4** e `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` estiverem definidos.

## Consequências

- Utilizadores podem ver **Outlook (Graph)** e **Google Calendar** lado a lado na mesma janela temporal, sem importação automática que conflite com o espelho Taskflow.
- **Sincronização** ou criação de eventos na Google a partir de Chronos exige **novo ADR** e regras de deduplicação.

## Estado

MVP **E8.16** alinhado a esta fronteira (leitura + OAuth + UI Chronos).
