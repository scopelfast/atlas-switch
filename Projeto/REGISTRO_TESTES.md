# Registo de testes manuais — Atlas Switch

Use este ficheiro para **anotar resultados** das checklists (`QA_AMBIENTE.md`, `QA_MODULOS.md`, `QA_INTEGRACOES.md`) quando não usar outro canal.

## Como preencher

- Uma linha ou bloco por **data + ambiente** (ex.: dev local, staging).
- Para cada problema: **módulo**, **passo**, **esperado vs. obtido**, **URL ou API**, **gravidade** (bloqueante / médio / cosmético).

## Modelo (copiar)

```
### YYYY-MM-DD — <quem> — <branch ou commit>

- [ ] Chronos — criar evento — OK / FALHA — notas…
- [ ] BillTrak — …
```

## Notas rápidas

- Utilizador seed: `teste@atlatswitch.com` — papel global `platform_admin`; no time, papel `owner`. O seed associa o time de demonstração ao plano **Enterprise** com **todos** os módulos; se um módulo aparecer «indisponível para este plano», volte a correr `pnpm db:seed`.
- Porta dev por defeito: **3003** (`package.json`). Defina `BASE_URL=http://localhost:3003` no `.env` para links de convite e OAuth alinharem à porta.
