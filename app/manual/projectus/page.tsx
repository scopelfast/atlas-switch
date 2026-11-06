import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function ProjectusManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Projectus — portfólio do time, fases, tarefas, Gantt, marcos, riscos, custos e ligações com Taskflow e Chronos; guia para uso sem treinamento presencial."
        backHref="/dashboard/projectus"
        backLabel="Voltar ao Projectus"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Para que serve" wide>
          <p>
            O <strong>Projectus</strong> é o <strong>módulo de portfólio e execução</strong> do time: cada{' '}
            <strong>projeto</strong> tem nome, status (em andamento, em risco, concluído), prazo opcional e orçamento
            em centavos. Sobre o projeto selecionado você cadastra <strong>fases</strong>, <strong>tarefas internas</strong>{' '}
            (com datas para o Gantt simplificado), <strong>marcos</strong>, <strong>riscos</strong> (probabilidade e
            impacto), <strong>dependências</strong> entre tarefas e <strong>custos</strong> planejados ou reais.
          </p>
          <p>
            A página mostra também tarefas do <strong>Taskflow</strong> já vinculadas ao projeto (somente leitura) e um
            formulário para criar <strong>bloco no Chronos</strong>. Outros módulos (BillTrak, Bibliotheca, Notepad,
            ResourceHub) usam o identificador do projeto ao criar registros — não duplicam automaticamente os custos do
            Projectus.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Quem pode acessar">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Permissão <strong>Projectus — visualizar</strong> (
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectus.view</code>) para ver portfólio,
              gráficos e formulários.
            </li>
            <li>
              Sem permissão, aparece acesso restrito — peça ao administrador do time no <strong>Catálogo</strong>.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Portfólio e projeto ativo" wide>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              No topo, use o menu <strong>Projeto ativo</strong> para mudar rapidamente de projeto, ou toque numa linha
              na lista à esquerda do cartão «Portfólio e novo projeto».
            </li>
            <li>
              Ao carregar a página com projetos existentes, o primeiro projeto pode ser selecionado automaticamente.
            </li>
            <li>
              À direita no mesmo cartão, o formulário <strong>Novo projeto</strong> envia{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/projectus/projects</code> com{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">name</code>,{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">status</code>,{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">dueDate</code> e{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">budgetCents</code>.
            </li>
            <li>
              O campo <strong>Prazo de entrega (opcional)</strong> usa <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">type=&quot;date&quot;</code>; o ícone do calendário no modo escuro segue o arquivo global de estilos da aplicação.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Indicadores (quatro cartões)" wide>
          <p className="text-sm">
            Os cartões do mesmo padrão visual dos outros módulos calculam-se <strong>no navegador</strong> com base no
            projeto ativo (exceto o primeiro, que conta todos os projetos do time).
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Projetos no portfólio</strong> — total de linhas devolvidas por{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/projectus/projects</code>.
            </li>
            <li>
              <strong>Progresso das tarefas</strong> — tarefas internas do Projectus com status Concluída, divididas
              pelo total de tarefas do projeto.
            </li>
            <li>
              <strong>Riscos cadastrados</strong> — quantidade de riscos; o «risco médio» na seção de orçamento é a
              média do produto probabilidade × impacto.
            </li>
            <li>
              <strong>Custo acumulado</strong> — soma dos custos <em>planejados</em> e <em>reais</em> registrados no
              Projectus para o projeto ativo; compara com o orçamento quando definido.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Gantt, resumo e alertas">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              O <strong>Gantt simplificado</strong> só lista tarefas que tenham data de início e data fim; dependências
              aparecem como setas quando existirem registros na API de dependências.
            </li>
            <li>
              O <strong>resumo</strong> mostra contagens de fases, marcos, riscos e tarefas do projeto ativo.
            </li>
            <li>
              Os <strong>alertas</strong> destacam atrasos em tarefas, prazo do projeto, risco elevado e custo acima do
              orçamento, quando aplicável.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Fases, tarefas, marcos e riscos" wide>
          <p className="text-sm">
            Cada bloco tem lista do que já existe e formulário mínimo para criar novo item. Todas as chamadas usam o{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> do projeto selecionado.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Fases</strong> — <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET/POST /api/projectus/phases</code>.
            </li>
            <li>
              <strong>Tarefas</strong> — <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET/POST /api/projectus/tasks</code>; progresso 0–100.
            </li>
            <li>
              <strong>Marcos e riscos</strong> — endpoints em{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/api/projectus/milestones</code> e{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/api/projectus/risks</code>.
            </li>
            <li>
              <strong>Dependências</strong> — ligam duas tarefas do mesmo projeto;{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/projectus/dependencies</code>.
            </li>
            <li>
              <strong>Custos</strong> — <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET/POST /api/projectus/costs</code>{' '}
              com tipo planejado ou real, valor em reais na UI (convertido a centavos).
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações — o que é real hoje" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Taskflow</strong> — <em>Leitura:</em> lista de tarefas do quadro associadas ao projeto (
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/projectus/taskflow?projectId=…</code>
              ). A vinculação é feita no Taskflow; o Projectus não altera o estado do Kanban.
            </li>
            <li>
              <strong>Chronos</strong> — <em>Atalho:</em> o formulário envia{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/chronos/agenda</code> com data,
              horas e título; não sincroniza automaticamente com fases ou tarefas do Projectus.
            </li>
            <li>
              <strong>Impacto e origem</strong> — compromisso criado por atalho fica com origem do módulo que iniciou a
              ação; ajustes estruturais de projeto continuam no Projectus.
            </li>
            <li>
              <strong>BillTrak, Bibliotheca, Notepad, ResourceHub</strong> — usam o <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> ao criar registros nesses módulos. Custos do BillTrak e custos do Projectus são
              sistemas paralelos nesta versão.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Impacto entre módulos (regra comum)" wide>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Projectus continua como fonte de verdade para fases, tarefas internas, marcos e custos.</li>
            <li>Atalhos para Chronos criam compromisso operacional sem alterar estrutura do projeto.</li>
            <li>Vínculos com Taskflow devem manter contexto de projeto para leitura executiva.</li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Gantt vazio</strong> — inclua data de início e prazo nas tarefas do Projectus.
            </li>
            <li>
              <strong>Menu de projeto desativado</strong> — ainda não há projetos; crie um no formulário do mesmo cartão.
            </li>
            <li>
              <strong>Taskflow sem linhas</strong> — nenhuma tarefa do quadro foi associada a este projeto no Taskflow.
            </li>
            <li>
              <Link href="/help" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                Centro de ajuda
              </Link>
              .
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Arranque de projeto</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Crie o projeto com status e, se possível, prazo e orçamento.</li>
              <li>Defina fases com datas coerentes com o calendário real.</li>
              <li>Quebre o trabalho em tarefas com datas para alimentar o Gantt.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>POP — Controle semanal</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Rever alertas e riscos com produto probabilidade × impacto elevado.</li>
              <li>Atualizar progresso das tarefas e custos reais.</li>
              <li>Conferir tarefas do Taskflow ligadas ao mesmo projeto.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover lg:col-span-2">
          <CardHeader>
            <CardTitle>Checklist sugerido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Marcos da semana anotados e comunicados à equipe.</li>
              <li>Dependências sem ciclo impossível.</li>
              <li>Orçamento revisto se o custo acumulado se aproximar do limite.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
