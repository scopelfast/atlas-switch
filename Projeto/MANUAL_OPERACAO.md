# Manual Operacional AtlasSwitch

> **Quem deve ler este manual?**  
> Qualquer pessoa que está prestes a testar ou operar o AtlasSwitch. Seja um time universitário ou uma squad SaaS, aqui você encontra tudo que precisa para dominar a ferramenta sem dúvidas.

---

## 1. O AtlasSwitch em poucas palavras

O AtlasSwitch é um **centro de comando** que conecta todos os pilares de uma operação digital:

- **Produtividade:** Taskflow (tarefas), Chronos (agenda), Reunify (reuniões).
- **Execução estratégica:** Projectus (projetos), ResourceHub (recursos).
- **Finanças e documentação:** BillTrak, Bibliotheca.
- **Conhecimento e conteúdo:** Notepad Pro, Scriptum.
- **Governança e segurança:** Painel, Gestão de Acessos (convites no **seu** time), Auditoria, Segurança.
- **Operação da instância (multi-tenant):** Control Center, planos comerciais globais, Integrações globais e Central de IA são só para a **equipa que opera o Atlas** nesta instância — não confundir com o dono de um time cliente.

Tudo conversa entre si. Uma reunião vira tarefa, uma tarefa alimenta um projeto, um projeto consome recursos e gera custos, e assim por diante.

---

## 2. Primeiro turno ao entrar

1. **Acesse** `http://localhost:3003` (porta por defeito em `pnpm dev`; ajuste se mudar).  
   - Clique em **Criar conta** se for seu primeiro acesso.  
   - Se já tiver login, use o botão **Entrar**.
2. **Conheça o topo:**  
   - Alternar tema (Claro/Escuro).  
   - Acesso rápido aos **Planos** e ao menu do usuário (avatar).
3. **Explore a barra lateral:** é o mapa de todos os módulos.  
4. **Abra o Painel:** é a porta de entrada para iniciar o dia. Cada card mostra um módulo e o botão **Abrir módulo**.

![Mapa rápido](../Projeto/assets/mapa-interface.png) _(adicione se quiser um desenho)_

---

## 3. Fluxo recomendado de trabalho

1. **Planeje**: comece no Painel → Taskflow → Chronos.  
2. **Conduza**: Reuniões no Reunify, Projetos no Projectus.  
3. **Registre**: use BillTrak para finanças, Bibliotheca para arquivos, Notepad/Scriptum para conhecimento.  
4. **Ajuste e governe**: ResourceHub (capacidade), Gestão de Acessos, Auditoria e Segurança.  
5. **Revise**: finalize o dia conferindo o checklist diário do Taskflow.

---

## 4. Guias detalhados por módulo

### 4.1 Painel (Dashboard)
- **Para que serve:** visão executiva + atalho para cada módulo.
- **Guia rápido:** leia os cards e clique em **Abrir módulo** para mergulhar na área que precisa de atenção.
- **Uso diário:** ao iniciar o dia, escolha uma tríade (Taskflow → Chronos → Reunify) para garantir foco e alinhamento.

---

### 4.2 Taskflow — Tarefas & automações
- **Missão:** organizar todo o trabalho em múltiplas visões (Kanban, Lista, Eisenhower, Calendário, Gantt).
- **Primeiros passos:**
  1. Clique em **Taskflow**.
  2. Use o formulário **Nova tarefa** (título, coluna, prioridade, prazo, responsável).
  3. Arraste o card no Kanban para mudar o status.
- **Visões:**  
  - **Kanban:** execução visual.  
  - **Lista:** edição em massa, filtros, exclusão.  
  - **Eisenhower:** priorização por urgência x importância.  
  - **Calendário:** agenda semanal de tarefas.  
  - **Gantt:** linha do tempo de 30 dias.
- **Rotina diária:**  
  - Revisar o **Checklist diário** (lado direito).  
  - Ativar o botão **Repriorizar agora** quando a equipe sentir que perdeu o foco.
- **Automação:**  
  - Regras simples (auto-atribuir, prioridade alta perto do prazo).  
  - Regras avançadas (condições múltiplas).  
  - Envio de notificações por e-mail se SMTP estiver ativo.
- **Integrações naturais:**  
  - Reunify → transforma decisões em tarefas.  
  - Chronos → converte compromissos em tarefas.  
  - Projectus → vincula tarefas aos projetos oficiais.

---

### 4.3 Chronos — Agenda inteligente
- **Missão:** planejar dia, semana e blocos de foco.
- **Primeiros passos:**
  1. Abra **Chronos**.  
  2. Ajuste a data base (topo do painel).  
  3. Adicione compromissos (data, horário, tipo, local).
- **Rotina recomendada:**  
  - Manhã: revisar visão **Dia**.  
  - Final do expediente: planejar a semana na visão **Semana**.
- **Extras:**  
  - Cada evento pode gerar uma tarefa no Taskflow.  
  - Insights automáticos mostram tarefas críticas, prioridades e checklist diário.

---

### 4.4 Reunify — Reuniões com follow-up
- **Missão:** preparar pautas, registrar decisões e garantir follow-up.
- **Primeiros passos:**
  1. Entre em **Reunify**.  
  2. Crie a reunião (data, pauta, participantes).  
  3. Durante a reunião, registre tópicos, decisões, ações.
- **Pós-reunião:**  
  - Marque ações como concluídas.  
  - Gere tarefas no Taskflow se necessário.
- **Dica:** mantenha suas reuniões padronizadas com checklists e templates.

---

### 4.5 Projectus — Projetos com visão executiva
- **Missão:** controlar o portfólio (fases, milestones, riscos, custos).
- **Primeiros passos:**
  1. Abra **Projectus** e cadastre um projeto (nome, status, prazo, orçamento).  
  2. Selecione o projeto para ver fases, tarefas, riscos e custos.
- **Rotina semanal:**  
  - Atualize o status (gauge).  
  - Revise o quadro de riscos (probabilidade x impacto).  
  - Estude o Gantt simplificado (dependências).  
  - Ajuste fases e milestones conforme as entregas.
- **Integrações:**  
  - Tarefas do Taskflow podem ser vinculadas ao projeto.  
  - Custos planejados x reais conversam com BillTrak.  
  - Alocação de pessoas usa dados do ResourceHub.

---

### 4.6 ResourceHub — Pessoas e recursos
- **Missão:** garantir que o time certo esteja disponível na hora certa.
- **Primeiros passos:**  
  - Confira os recursos cadastrados (seed).  
  - Crie um novo recurso (nome, skills, carga).  
  - Verifique o painel de alocações para sobrecarga.
- **Rotina:**  
  - Antes de assumir novo projeto, cheque disponibilidade.  
  - Rebalanceie alocações quando um projeto atrasar.

---

### 4.7 BillTrak — Finanças e métricas SaaS
- **Missão:** ter controle de receitas, despesas e previsões.
- **Primeiros passos:**  
  - Acesse **BillTrak** e cadastre uma transação (tipo, valor, categoria, conta).  
  - Observe indicadores (total do mês, distribuição por categoria).
- **Ciclo mensal:**  
  - Fechamento de mês.  
  - Análise de churn, LTV (quando habilitado).  
  - Preparação de relatórios para time executivo.
- **Integrações:**  
  - Custos de Projectus.  
  - Dados comerciais alinhados aos planos definidos pelo **operador da plataforma** no Control Center (ex.: faturamento previsto quando o Stripe está ligado).

---

### 4.8 Bibliotheca — Repositório inteligente
- **Missão:** organizar documentos com tags, categorias e busca.
- **Primeiros passos:**  
  - Faça upload de um documento (PDF, imagem, etc.).  
  - Defina categoria, status, projeto, tags.  
  - Use filtros à esquerda para localizar arquivos.
- **Quando usar:**  
  - Após reuniões (subir atas).  
  - Ao fechar sprint (documentos de entrega).  
  - Ao preparar auditorias (histórico centralizado).

---

### 4.9 Notepad Pro — Centro de notas e ideias
- **Missão:** capturar e organizar conhecimento informal.
- **Primeiros passos:**  
  - Crie uma nota (texto, tags, pasta).  
  - Teste o botão de fixar para destacar informações importantes.
- **Rotina:**  
  - Revisar notas fixadas semanalmente.  
  - Vincular links de tarefas/projetos no corpo da nota.

---

### 4.10 Scriptum — Escrita com metas
- **Missão:** gerenciar conteúdo longo (artigos, relatórios, TCC).
- **Primeiros passos:**  
  - Cadastre um projeto de escrita.  
  - Adicione capítulos, defina metas de palavras e prazos.
- **Rotina:**  
  - Atualizar progresso conforme escreve.  
  - Registrar revisões e exportações (exportações avançadas podem ser ativadas futuramente).

---

### 4.11 Gestão de Acessos (Usuários)
- **Missão:** convidar e gerir membros **do time em sessão** (não é a lista global de todas as empresas da instância — essa fica reservada ao operador da plataforma).
- **Fluxo:**  
  1. Acesse **Usuários**.  
  2. Informe e-mail, nome e papel no time (membro, supervisor, gestor ou administrador do time; matriz de «quem convida quem» na UI).  
  3. Clique em **Enviar convite**.  
  4. Para remover, use o botão **Remover** (quem tem permissão).
- **Observação:** se SMTP não estiver configurado, o sistema mostrará o link de convite para partilha manual.

---

### 4.12 Auditoria (Atividade)
- **Missão:** visualizar trilha de eventos (logins, convites, alterações sensíveis).
- **Uso prático:**  
  - Checar histórico quando houver dúvida de permissão.  
  - Referenciar nas reuniões de governança (quem fez o quê, e quando).

---

### 4.13 Configurações Gerais
- **Missão:** atualizar dados básicos do usuário/logomarca.
- **Fluxo:**  
  1. Entre em **Configurações**.  
  2. Edite nome, e-mail ou preferências.  
  3. Salve as alterações.

---

### 4.14 Segurança
- **Missão:** alterar senha ou excluir conta.
- **Novidade:** todos os campos de senha têm botão “mostrar/ocultar” para evitar digitação incorreta.
- **Fluxos:**  
  - Atualizar senha (senha atual + nova + confirmação).  
  - Excluir conta (solicita confirmação de senha — ação irreversível).

---

### 4.15 Planos (Pricing)
- **Missão:** página pública/demo de preços (`/pricing`) e checkout com Stripe quando configurado.
- **Nota:** o ecrã **Planos** dentro do dashboard (`/dashboard/planos`) é o catálogo **comercial** da instância — só o **operador da plataforma** o vê; donos de time cliente não o utilizam para «comprar» módulos sozinhos.
- **Cenário de teste:**  
  - Se o Stripe estiver desabilitado, aparecerá um aviso e os planos ficam em modo demonstração.  
  - Caso contrário, siga o checkout e finalize a assinatura (ambiente de teste).

---

### 4.16 Responsividade e experiência mobile
- Design responsivo: botões e cards alinham-se em coluna para facilitar leitura.  
- Barra lateral se recolhe em telas menores.  
- Recomendação: sempre testar em um smartphone antes de liberar para usuários finais.

---

## 5. FAQ - Perguntas frequentes

| Dúvida | Resposta |
|--------|----------|
| Convite não chegou | Verifique SMTP. Se desabilitado, copie o link exibido na tela de convite. |
| Não consigo logar | Confirme e-mail/senha. Use **Esqueci a senha** no login; se a política do time exigir apoio humano, contacte quem o convidou ou o administrador **do time**. |
| Algo deu erro 500 | Certifique-se de rodar `pnpm db:migrate` e `pnpm db:seed`. |
| Como reportar bug | Anote módulo, ação, horário (use Auditoria para confirmar) e envie para o time responsável. |

---

## 6. Por que usar o AtlasSwitch?

1. **Integração real:** nada de planilhas paralelas; tarefas, agenda, projetos, finanças e pessoas falam a mesma língua.  
2. **Produtividade com contexto:** Kanban, agenda, reuniões e notas conectados em um só lugar.  
3. **Governança embutida:** trilha de auditoria, gestão de acessos por time, segurança e (para operadores) planos globais — tudo pronto.  
4. **Enfoque em experiência:** botões padronizados, dark mode, campos de senha com visualização, manual completo (você está lendo!).  
5. **Pronto para crescer:** perfeito para squads universitárias, startups em tração e equipes que precisam de visão 360º.

Prepare seu time, rode os checklists de QA (`QA_AMBIENTE.md`, `QA_MODULOS.md`) e comece os testes exploratórios. O AtlasSwitch está pronto para colocar sua operação em modo turbo.

---

**Versão do manual:** 2.0  
**Atualização:** 2026-04-23 (operador da plataforma vs. dono de time; auth e manual operacional)  
**Contato para feedback:** registre na Auditoria (Atividade) e envie para o canal da equipe AtlasSwitch.

