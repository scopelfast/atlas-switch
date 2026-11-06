Auditoria de módulos – AtlasSwitch
==================================

Objetivo: validar cada módulo principal do dashboard com dados reais. Use o ambiente preparado via `QA_AMBIENTE.md` (login com `teste@atlatswitch.com`).

**Papéis:** o utilizador seed tem papel global **`platform_admin`** (vê Control Center, Planos comerciais, Catálogo, Perfis, Integrações globais, Central de IA). Se testar com outra conta **sem** esse papel, espere **Acesso restrito** nesses ecrãs — isso é o comportamento correcto; foque o checklist do time (Taskflow, Chronos, etc.).

Fluxo geral
-----------
1. Logar e acessar `/dashboard`.
2. Para cada módulo abaixo:
   - Navegar até o card no dashboard ou link direto.
   - Seguir o checklist de leitura e, quando possível, executar um CRUD básico.
   - Registrar comportamento inesperado ou endpoint que falha.

Chronos (`/dashboard/chronos`)
------------------------------
- **Listar agenda**: confirmar que eventos do seed aparecem em “Dia”, “Semana” e “Lista”.
- **Criar compromisso**: preencher novo evento manual via formulário (campos obrigatórios: data, hora início, título, tipo). Salvar e conferir na view.
- **Editar**: alterar horário ou título pelo modal/ação disponível.
- **Excluir**: remover o evento criado e confirmar remoção (API `DELETE /api/chronos/agenda?id=...`).
- **Filtros/data**: usar seletor de data base; verificar que SWR refaz fetch.
- **Alertas**: observar se banners/resumos aparecem (dados do seed).
- **Erros comuns**: sem Postgres, rota retorna 500; sem autenticação, 401.

Taskflow (`/dashboard/taskflow`)
--------------------------------
- **Board inicial**: garantir que colunas Backlog/Em Progresso/Concluído carreguem (API `GET /api/taskflow/boards`).
- **Criar tarefa**:
  - Preencher título, coluna, due date e responsável (seed inclui outros membros? se não houver, usar o próprio utilizador em sessão como responsável).
  - Verificar se aparece no card.
- **Mover tarefa**: arrastar entre colunas (Drag&Drop) e conferir persistência.
- **Editar tarefa**: atualizar prioridade, descrição, labels (se existirem) e due date.
- **Regras/automação**: acessar painel de automações; tentar habilitar/editar regra simples e ver se `PATCH` responde 200.
- **Checklist diário**: adicionar tarefa ao checklist do dia e marcar como concluída.
- **Notificações**: se SMTP não estiver configurado, observar ausência de e-mail (esperado) e ausência de erro fatal.

Reunify (`/dashboard/reunify`)
------------------------------
- **Agenda**: verificar lista de reuniões (seed).
- **Criar reunião**: preencher data/horário, pauta e salvar.
- **Decisões e ações**: adicionar uma decisão e item de ação, depois marcar como concluído.
- **Export/relatórios**: validar se botões funcionam (mesmo que ainda sejam placeholders).

Projectus (`/dashboard/projectus`)
----------------------------------
- **Listagem**: projetos do seed devem aparecer com status/prazo.
- **Criar projeto**: preencher nome, status, prazo e budget; confirmar inclusão.
- **Detalhes**: abrir projeto e verificar fases, tarefas, riscos e custos.
- **Atualizar status**: mudar estágio ou prazo e salvar.
- **Integrações**: se campos de link com Taskflow/Chronos existirem, confirmar preenchimento e ausência de erro.

ResourceHub (`/dashboard/resourcehub`)
--------------------------------------
- **Recursos**: listar pessoas/ativos do seed.
- **Adicionar recurso**: criar novo registro com skill e disponibilidade.
- **Alocações**: atribuir recurso a um projeto (se interface permitir) e conferir atualização da capacidade.

BillTrak (`/dashboard/billtrak`)
--------------------------------
- **Contas e métricas**: cards com lançamentos do seed.
- **CRIAR transação**: inserir receita/despesa e conferir impacto nos totais.
- **Filtrar por categoria/período**: validar filtros e atualizações de gráfico.

Bibliotheca (`/dashboard/bibliotheca`)
--------------------------------------
- **Documentos**: tabela/lista deve carregar com dados seed.
- **Upload**: selecionar arquivo via modal (nota: sem storage real, apenas campos no banco). Verificar se `fileUrl` e metadados salvam.
- **Filtros**: aplicar categoria/status/projeto.

Notepad Pro (`/dashboard/notepad`)
----------------------------------
- **Notas**: listar notas fixadas, tags e filtros.
- **Criar nota**: adicionar nova nota, tag e pasta; confirmar ordenação por atualização.
- **Editar**: alterar status/visibilidade/pinned.

Scriptum (`/dashboard/scriptum`)
--------------------------------
- **Projetos**: verificar cards do seed.
- **Criar projeto/capítulo**: adicionar projeto e capítulo, conferir persistência.
- **Metas**: se existir campo de meta de palavras, atualizar e validar.

Control Center (`/dashboard/control-center`)
--------------------------------------------
- **Pré-requisito:** sessão com **`platform_admin`** (ex.: utilizador seed).
- **Clientes/Planos**: confirmar listagem (seed).
- **Health/Churn**: observar se métricas renderizam (mesmo que estáticas).
- **Ações**: tentar atualizar dados (se API estiver implementada) e conferir retorno.

Central de IA (`/dashboard/ai-center`)
--------------------------------------
- **Pré-requisito:** sessão com **`platform_admin`**.
- **Modelos**: catálogo deve carregar.
- **CRUD model**: cadastrar modelo (nome, fornecedor, tipo, status), editar e remover.
- **Botões “Ativar/Pausar/Definir padrão”**: validar efeitos na lista.

Manual e Help (`/help`, `/manual/*`)
------------------------------------
- Abrir `/help` e alguns manuais específicos (ex.: `/manual/taskflow`).
- Conferir componentes `ManualHeader` e botões de navegação.

Resultados / Registro
---------------------
- Usar esta checklist como guia; para cada passo, anotar em `Projeto/REGISTRO_TESTES.md` (ou canal interno) qualquer bug ou item a corrigir.
- Caso um módulo dependa de integração externa ainda não configurada (Stripe, SMTP), registrar para tratativa na próxima etapa (to-do 3).

Após finalizar os testes acima, marcar a to-do “Testar módulos principais…” como concluída e abrir issues internas para cada problema encontrado.
