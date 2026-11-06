Plano de execucao - AtlasSwitch

Objetivo
- Padronizar UI/UX do dashboard e finalizar MVP universitario.
- Entregar experiencia moderna, simples e rapida.

Estado atual (hoje)
- Modulos MVP com layout base: Chronos, Reunify, Projectus, Taskflow, etc.
- Paginas ajustadas para padrao visual: general, activity, security, chronos, usuarios.
- Componentes base prontos: ModuleHeader, HelpPanel, atlas-surface, atlas-item.
- MVP com API persistente (DB): Chronos, Reunify, Bibliotheca.
- Chronos avancado: views (dia/semana/lista/timeline), CRUD, alertas e resumo.
- Projectus avancado: CRUD, fases, tarefas, marcos, riscos e Gantt simples.
- Projectus avancado: dependencias e custos com resumo executivo.
- Projectus integracoes: Taskflow (tarefas), Chronos (blocos), links ResourceHub/Billtrak.
- Reunify avancado: agenda, decisoes, acoes, follow-up e integrações.
- ResourceHub avancado: recursos, alocacoes, capacidade e integrações base.
- Billtrak avancado: contas, lancamentos, transacoes, metricas e manual.
- Notepad Pro avancado: notas, filtros, pastas, tags e manual.
- Scriptum avancado: projetos, capitulos, metas, integracoes base e manual.
- Atlas Control Center: clientes, planos, faturamento projetado e auditoria.
- Control Center: health score, churn e recomendacoes base.
- Central de IA: catalogo de modelos open source e manutencao.

Padrao visual (referencia)
- Section: "flex-1 p-4 lg:p-8"
- Header: ModuleHeader (titulo + descricao)
- Conteudo: grid "lg:grid-cols-[1.4fr_1fr]" com Card "atlas-surface"
- Estados vazios: mensagem + icone, texto curto e claro
- Ajuda: HelpPanel no final com dicas por perfil

Fase 1 - Padronizacao completa (prioridade maxima)
1) Revisar todas as telas do dashboard e alinhar ao padrao visual.
2) Uniformizar fontes, cores e botao principal.
3) Garantir estados de permissao e loading consistentes.

Fase 2 - MVP universitario (entrega rapida)
1) Chronos: agenda real, time-blocking, alertas e analytics. (UI+API avancadas)
2) Taskflow: Kanban + lista, prioridades, automacoes, metricas, integracoes e manual. (finalizado)
3) Reunify: pautas, atas, follow-up e integrações. (UI+API avancadas)
4) Bibliotheca avancado: documentos, tags, filtros, integracoes base e manual.

Fase 3 - Expansao
1) Projectus, ResourceHub, Billtrak. (Billtrak pronto)
2) Notepad Pro e Scriptum. (Notepad Pro e Scriptum prontos)
3) Billing, onboarding e analytics avancado.

Checklist de qualidade
- Layout consistente em todas as rotas.
- Sem flicker de permissao (validar user antes).
- Responsivo (mobile e desktop).
- Texto e microcopy em PT-BR.
- Lighthouse acima de 85.

Validacao visual (pendente)
- Revisar no browser: /dashboard/general, /dashboard/activity, /dashboard/security, /dashboard/chronos, /dashboard/usuarios.
- Conferir fontes, botoes, cores e grid 1.4fr/1fr.

Recuperacao de erro (fluxo)
1) Rodar: git status -sb
2) Ver diff: git diff --stat
3) Salvar checkpoints: git stash push -m "checkpoint <data>"
4) Registrar em "Projeto/PLANEJAMENTO.md" o ultimo passo concluido.

Pendencias premium (para depois dos demais modulos)
- Taskflow: notificacoes email, checklist diario persistente, polimento UX extra.
- Chronos: notificacoes push, integracao automatica com Reunify/Taskflow.
- Projectus: dependencias visuais no Gantt, alertas inteligentes (prazo/custo/risco), integracao real com ResourceHub/Billtrak.
- Reunify: transcricao automatica, templates de pauta, analytics avancado, notificacoes externas.
- ResourceHub: otimizacao/IA de alocacao, integracao real com Billtrak, importacao de ausencias/RH, alertas preditivos.
- Billtrak: OCR de boletos, previsao de caixa, integracao bancaria/API e alertas inteligentes.
- Bibliotheca: OCR avancado, busca semantica, leitor/anotacoes, permissao granular, integracoes.
- Notepad Pro: web clipper, grafos bidirecionais, transcricao de voz, modo offline.
- Scriptum: exportacao DOCX/PDF/EPUB, revisao colaborativa, analise de estilo.
- Control Center: automacao de billing, churn/upsell IA, exportacao de logs, RBAC avancado.
- Central de IA: monitoramento de custo, auto-escala, fallback e cache.
