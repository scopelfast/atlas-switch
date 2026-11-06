# ADR-0005 — Orquestração de fluxos de IA (E8.13): pipeline interno leve

## Contexto

O memorial **E8.13** pede orquestração (LangChain, LlamaIndex ou **pipeline interno leve**) para encadear ASR → LLM → rascunho com **revisão humana**, suportando **E8.2** e **E8.3**, evitando dependência de um único fornecedor e com **idempotência** verificável.

## Decisão

1. **MVP em código:** um **pipeline interno** explícito em `lib/ai/pipeline/`, com passos nomeados, ordem fixa e resultado agregado (trâmites) devolvido às APIs existentes **sem** obrigar LangChain/LlamaIndex no `package.json`.
2. **E8.2 (Reunify):** o passo «extracção heurística» permanece a base; a resposta da API pode incluir `pipeline` com passos executados para auditoria e revisão humana.
3. **E8.3 (Taskflow assistência):** o `GET` de sugestões pode incluir `pipeline` opcional (`?trace=1`) com fases lógicas (dados → heurísticas), sem alterar o cálculo existente.
4. **Fornecedores:** heurísticas locais são o caminho por defeito; **E8.11** (OpenAI/Gemini) continua como extensão opcional por equipa, não acoplada ao núcleo do pipeline neste ADR.
5. **Idempotência:** a extracção heurística é **função pura** do texto; o repositório inclui verificação automática (`pnpm check:ai-pipeline`).

## Alternativas (evolução)

- **LangChain / LlamaIndex:** adoptar quando houver ASR estável e necessidade de ramificações complexas (RAG, ferramentas, memória).
- **Fila + worker:** quando o pipeline passar a incluir chamadas lentas ou ASR em ficheiro.

## Estado

MVP **E8.13** alinhado a este ADR (pipeline + trâmites + self-check).
