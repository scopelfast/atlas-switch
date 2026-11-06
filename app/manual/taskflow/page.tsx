import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function TaskflowManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Guia completo: permissões, fluxo diário, integrações, IA e excepções."
        backHref="/dashboard/taskflow"
        backLabel="Voltar ao Taskflow"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Organização do ecrã (abas)" wide>
          <p className="mb-3">
            Na página principal do Taskflow, o conteúdo está repartido por quatro abas para reduzir ruído e orientar o
            trabalho. A última aba escolhida por quadro é memorizada neste dispositivo.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Operar</strong> — painel de tempo e intervenções (quando aplicável), filtros e modo de vista
              (Kanban, lista, Eisenhower, calendário, Gantt), integrações rápidas (Reunify, Chronos, Projectus) e o
              quadro em si.
            </li>
            <li>
              <strong>Nova tarefa</strong> — formulário completo de criação (coluna, tipo, prioridade, prazo,
              recorrência, responsáveis, projeto, épico/sprint) e secção de <em>labels</em> ligada ao mesmo fluxo.
            </li>
            <li>
              <strong>Painel</strong> — indicadores (volume, entregas, ritmo, tempos), checklist diário, resumo
              semanal, prioridades de hoje, alertas, assistência ao quadro, busca semântica e modelo na nuvem (quando
              existir), e notificações recentes.
            </li>
            <li>
              <strong>Definições</strong> — fases do Kanban, catálogo de status, tipos de tarefa, regras automáticas,
              webhooks, integração para desenvolvimento, portal público e automação avançada. A maior parte destas
              acções exige perfil de gestor ou administrador do quadro.
            </li>
          </ul>
          <p className="mt-3 text-sm">
            Relatórios mais profundos continuam em{' '}
            <a className="text-indigo-600 underline dark:text-indigo-400" href="/dashboard/taskflow/reports">
              /dashboard/taskflow/reports
            </a>
            .
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Por onde começo?" wide>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Escolha o quadro no seletor superior e confirme que está na aba <strong>Painel</strong> para ver
              métricas e o que merece atenção hoje.
            </li>
            <li>
              Para <strong>criar</strong> uma tarefa com muitos campos, use a aba <strong>Nova tarefa</strong>; para{' '}
              <strong>mover e rever</strong> o quadro, use <strong>Operar</strong> (filtros, vistas, integrações
              rápidas).
            </li>
            <li>
              Se for responsável pela estrutura do time, use <strong>Definições</strong> para colunas, status e
              automações — de preferência fora do pico de reuniões, para não interromper quem só precisa de entregar.
            </li>
          </ol>
        </ManualDocBlock>

        <ManualDocBlock title="Nova tarefa — campos principais" wide>
          <p className="mb-3 text-sm">
            Na aba <strong>Nova tarefa</strong>, além de título, coluna, prioridade, prazo e responsáveis, estes campos
            confundem-se com facilidade — resumo do propósito e de onde vêm os dados.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Tipo de tarefa</strong> — combina <em>tipos nativos</em> do produto (ex.: Geral, Funcionalidade,
              Correcção) com <em>tipos personalizados do time</em>. Os extras cadastram-se em{' '}
              <strong>Definições → Tipos de tarefa (personalizados)</strong> (código único por equipa; não pode repetir
              um código nativo). Novos tipos «oficiais» para todas as instâncias são alteração de produto no código
              (lista nativa).
            </li>
            <li>
              <strong>Recorrência</strong> — «Sem recorrência» = tarefa única. Com regra (diária, semanal, mensal),
              a tarefa passa a ser <em>molde de série</em>: o sistema pode gerar ocorrências futuras; no quadro/lista
              costuma aparecer indicação de tarefa recorrente quando aplicável.
            </li>
            <li>
              <strong>Sprint</strong> — associa a tarefa a um timebox nomeado (intervalo de datas) do mesmo quadro. As
              sprints <strong>criam-se na aba Operar</strong> (botão <em>Nova sprint</em>, com permissão de gestão);
              depois aparecem neste dropdown e no filtro de sprints da barra de ferramentas.
            </li>
            <li>
              <strong>Labels (secção «Nova label» / «Criar label»)</strong> — não substitui o botão de criar tarefa:
              alimenta o <em>catálogo de etiquetas</em> da equipa (nome, cor predefinida, hex opcional que prevalece
              sobre a cor, prioridade da tag para ordenação/visual). As etiquetas criadas aparecem ao escolher labels
              na criação/edição de tarefas e como <em>chips</em> nos cartões no Kanban e noutras vistas.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Intervenções (timer e manual) — onde ficam os registos" wide>
          <p className="mb-3 text-sm">
            Na aba <strong>Operar</strong>, os blocos «Intervenção com timer» e «Intervenção manual» servem para{' '}
            <strong>criar</strong> registos de tempo (sessão em direto ou intervalo já vivido). Abaixo encontra-se
            também um <strong>histórico recente</strong> (últimas intervenções do time ou só as suas, conforme o
            perfil), onde pode <strong>rever</strong> início, fim, tarefa e texto — e, se tiver permissão,{' '}
            <strong>corrigir ou apagar</strong> linhas já fechadas (ver secção seguinte).
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Relatórios do Taskflow</strong> (
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/dashboard/taskflow/reports">
                /dashboard/taskflow/reports
              </a>
              ) — mostra <em>totais de horas</em> ligadas a intervenções no período (por exemplo «Real
              (intervenções)») e, na secção de capacidade semanal, horas reais por pessoa; são agregados, não o
              detalhe linha a linha.
            </li>
            <li>
              <strong>Exportação de capacidade semanal</strong> — o CSV em relatórios inclui coluna de horas reais
              de intervenção por utilizador na semana (útil a RH / gestão).
            </li>
            <li>
              <strong>Registo de atividades</strong> (
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/dashboard/activity">
                /dashboard/activity
              </a>
              , com permissão <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">activity.view</code>) —
              regista <em>eventos</em> quando encerra um timer, regista intervenção manual, ocorre pausa automática
              por inatividade, ou quando alguém <strong>corrige</strong> ou <strong>apaga</strong> uma intervenção; as
              mensagens são genéricas (não listam duração nem título da tarefa no feed).
            </li>
            <li>
              <strong>Base de dados</strong> — o detalhe completo fica na tabela{' '}
              <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">taskflow_interventions</code>{' '}
              (auditoria / integrações futuras).
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Intervenções — corrigir erros e sobreposição de horários" wide>
          <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Corrigir um apontamento errado (ex.: fim às 19h em vez de 18h)
          </p>
          <p className="mb-3 text-sm">
            Para intervenções <strong>já fechadas</strong> (timer encerrado ou registo manual com início e fim), o
            autor do apontamento pode usar <strong>Editar</strong> no histórico recente da aba <strong>Operar</strong>{' '}
            para ajustar datas, texto de status ou detalhes. <strong>Administradores / gestores do quadro</strong>{' '}
            (<code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">canConfigureTaskflowBoard</code>)
            podem editar ou <strong>apagar</strong> linhas de outros membros do mesmo time. Cada correção ou remoção
            gera entrada no registo de atividades (
            <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">TASKFLOW_INTERVENTION_EDIT</code>,{' '}
            <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">TASKFLOW_INTERVENTION_DELETE</code>
            ). Uma sessão de timer <strong>ainda aberta</strong> só pode ser encerrada pelo fluxo do timer (não pelo
            histórico).
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            API interna: <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">GET /api/taskflow/interventions/history</code>,{' '}
            <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">PATCH</code> e{' '}
            <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">DELETE /api/taskflow/interventions/[id]</code>.
          </p>
          <p className="mt-4 mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Dois apontamentos no mesmo período (sobreposição)
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Timer</strong> — o sistema impede <strong>duas sessões de timer abertas</strong> ao mesmo tempo
              para o mesmo utilizador: tem de encerrar a intervenção em curso antes de iniciar outra.
            </li>
            <li>
              <strong>Intervenções já fechadas e novas manuais</strong> — o servidor recusa criar ou editar um intervalo
              que <strong>se sobreponha</strong> a outro apontamento do mesmo utilizador (manual ou timer já
              encerrado), ou que cruze o intervalo de um <strong>timer em curso</strong> (tem de encerrar o timer
              primeiro ou escolher horas fora dessa sessão).
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Resumo" wide>
          <p>
            O Taskflow é o quadro de entregas do time: colunas por fase, tarefas com prazo, responsáveis (incluindo
            vários por tarefa), etiquetas, anexos, recorrência, quadros múltiplos e exportações (CSV, Excel, PDF).
            É o destino natural das acções criadas no Reunify e do espelho de prazos vindo do Chronos.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Papéis e permissões">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Membro / Supervisor</strong> — veem só tarefas em que participam (criador, responsável ou
              co-responsável).
            </li>
            <li>
              <strong>Gestor / Administrador / Proprietário</strong> — veem o quadro completo do time e podem
              configurar colunas, SLA e integrações do quadro.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações com outros módulos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Reunify</strong> — «Criar no Taskflow» a partir de uma acção de reunião; exportações alinhadas ao
              memorial de integração.
            </li>
            <li>
              <strong>Chronos</strong> — itens da agenda podem espelhar tarefas (lembretes); alterações no Taskflow
              sincronizam espelhos quando configurado.
            </li>
            <li>
              <strong>Projectus</strong> — tarefas ligadas a projetos para leitura executiva.
            </li>
            <li>
              <strong>Transparência operacional</strong> — quando o item nasce em outro módulo (ex.: reunião no Reunify),
              preserve o vínculo de origem para rastreabilidade e auditoria.
            </li>
            <li>
              <strong>Webhooks (Zapier/Make)</strong> — ver manual dedicado em{' '}
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/manual/zapier-make">
                Zapier / Make
              </a>
              .
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Impacto entre módulos (regra comum)" wide>
          <ul className="list-disc space-y-1 pl-5">
            <li>Criar tarefa por integração não altera automaticamente o registro de origem.</li>
            <li>Origem deve permanecer clara para auditoria e operação diária.</li>
            <li>Prazos espelhados no Chronos seguem atualização do Taskflow quando vínculo estiver ativo.</li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Inteligência artificial neste módulo">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Heurísticas locais</strong> — sugestões de assistência ao quadro, insights de relatório e
              rascunhos a partir de texto são opt-in por equipa e processam dados no servidor sem modelo cloud
              obrigatório.
            </li>
            <li>
              <strong>Nuvem (OpenAI / Gemini)</strong> — chat e embeddings só com toggles da instância + chaves em{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env</code> e opt-in do time.
            </li>
            <li>
              <strong>Central de IA</strong> — catálogo de modelos para o operador da plataforma; não substitui as
              regras de negócio do Taskflow.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Não vê tarefas</strong> — confirme papel: membro só vê o que lhe diz respeito; peça a um gestor
              para o adicionar como responsável.
            </li>
            <li>
              <strong>Exportação vazia ou incompleta</strong> — filtros de vista e permissões aplicam-se ao CSV/PDF;
              tente com perfil de equipa.
            </li>
            <li>
              <strong>Portal público</strong> — submissões ficam em fila até aprovação; ver manual do Taskflow sobre
              portal e anti-spam.
            </li>
            <li>
              Mais contexto em <a className="text-indigo-600 underline dark:text-indigo-400" href="/help">Ajuda</a>.
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Procedimento Operacional Padrão</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>Preparação diária:</strong> na aba <em>Painel</em>, revise <em>Prioridades de hoje</em>, o
                checklist e os alertas.
              </li>
              <li>
                <strong>Triagem:</strong> na aba <em>Nova tarefa</em>, crie entradas novas com prazo, prioridade,
                responsável e projeto; depois organize no Kanban na aba <em>Operar</em>.
              </li>
              <li>
                <strong>Organização:</strong> aplique labels e posicione na coluna correta (Kanban ou lista).
              </li>
              <li>
                <strong>Execução:</strong> mova cards conforme avança (Backlog → Em progresso → Concluído).
              </li>
              <li>
                <strong>Revisão:</strong> ao final do dia, volte ao <em>Painel</em> para atrasos, gargalos e
                notificações; use <em>Relatórios</em> para análise mais longa.
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Rotina de Operação</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Estar na aba <strong>Operar</strong> para alternar vistas (botões Kanban, Lista, etc.) e filtros.
              </li>
              <li>
                Usar <strong>Lista</strong> para editar e filtrar rapidamente.
              </li>
              <li>
                Usar <strong>Eisenhower</strong> para decidir o que é urgente/importante.
              </li>
              <li>
                Usar <strong>Calendário</strong> para validar prazos.
              </li>
              <li>
                Usar <strong>Gantt</strong> para visão de cronograma.
              </li>
              <li>
                Usar <strong>Kanban</strong> para fluxo diário.
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Tratamento de Exceções</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Tarefa atrasada:</strong> revisar prioridade e responsável.
              </li>
              <li>
                <strong>Sem responsável:</strong> atribuir imediatamente.
              </li>
              <li>
                <strong>Urgente sem prazo:</strong> definir prazo ou reclassificar.
              </li>
              <li>
                <strong>Gargalo detectado:</strong> redistribuir tarefas entre colunas/equipe.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Automação e Integrações</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Configure automações básicas e avançadas na aba <strong>Definições</strong> (com permissão de
                gestor).
              </li>
              <li>
                Na aba <strong>Operar</strong>, use Reunify/Chronos/Projectus em <em>Integrações rápidas</em> para
                gerar tarefas com um clique.
              </li>
              <li>Vincule tarefas a Projectus para rastrear entrega por projeto.</li>
              <li>
                Para Zapier ou Make com webhooks, veja o manual{' '}
                <a className="text-indigo-600 underline dark:text-indigo-400" href="/manual/zapier-make">
                  Zapier / Make
                </a>
                .
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Indicadores Operacionais</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Lead time:</strong> tempo médio do início à conclusão.
              </li>
              <li>
                <strong>Cycle time:</strong> tempo em execução até conclusão.
              </li>
              <li>
                <strong>Atrasadas:</strong> quantidade de tarefas fora do prazo.
              </li>
              <li>
                <strong>Gargalo:</strong> coluna com maior tempo médio.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
