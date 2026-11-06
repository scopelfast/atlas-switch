import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function ChronosManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Agenda, foco, bloqueios de tempo e ligação ao Taskflow e ao calendário externo."
        backHref="/dashboard/chronos"
        backLabel="Voltar ao Chronos"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Resumo" wide>
          <p>
            O Chronos é a agenda operacional: vistas dia/semana/timeline, blocos de foco, compromissos e alertas de
            sobreposição. Pode espelhar prazos do Taskflow e, quando a instância liga o Google Calendar, sincronizar
            compromissos externos para não planear em vão.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Papéis e permissões">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Membro</strong> — vê e edita a própria agenda e blocos que criou ou lhe foram atribuídos.
            </li>
            <li>
              <strong>Gestor / Admin</strong> — pode rever agregados da equipa (conforme política do cliente) e
              promover rotinas de planeamento semanal.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações com outros módulos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Taskflow</strong> — itens com prazo podem aparecer como lembretes ou espelhos; mover prazos no
              quadro atualiza o que vê na agenda quando a ligação está ativa.
            </li>
            <li>
              <strong>Reunify</strong> — reuniões agendadas alimentam blocos de tempo e follow-up na mesma semana.
            </li>
            <li>
              <strong>Transparência de origem</strong> — cada item exibe origem (Manual, Reunify, Taskflow, Projectus).
              Se a origem não for Manual, a edição deve ser feita no módulo de origem.
            </li>
            <li>
              <strong>Google Calendar</strong> — opcional por utilizador; requer OAuth e permissões definidas pelo
              operador da plataforma (Integrações globais).
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Impacto entre módulos (regra comum)" wide>
          <ul className="list-disc space-y-1 pl-5">
            <li>Ao criar no Chronos, o item entra como agenda operacional.</li>
            <li>Se a origem for outro módulo, edite no módulo de origem.</li>
            <li>Mensagens de sincronização devem confirmar sucesso, idempotência ou falha.</li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Inteligência artificial neste módulo">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Heurísticas locais</strong> — sugestões de blocos, detecção de sobreposição e resumos de dia
              podem usar regras no servidor sem modelo cloud obrigatório.
            </li>
            <li>
              <strong>Nuvem</strong> — só com toggles da instância, chaves em ambiente seguro e opt-in explícito do
              time.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Evento não aparece</strong> — confirme fuso horário, filtros de vista e se o bloco está marcado
              como cancelado.
            </li>
            <li>
              <strong>Google Calendar vazio</strong> — verifique ligação OAuth e se o operador da plataforma ativou o
              conector; volte a autorizar se a sessão expirou.
            </li>
            <li>
              <strong>Conflito com Taskflow</strong> — confirme se o espelho de tarefa está ativo e qual é a fonte de
              verdade do prazo (quadro vs agenda).
            </li>
            <li>
              Mais contexto em{' '}
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/help">
                Ajuda
              </a>
              .
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Preparação diária</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Abra a visão <strong>Dia</strong> e valide o planejamento.</li>
              <li>Bloqueie horários de foco para tarefas críticas.</li>
              <li>Revise alertas contextuais e sobreposições.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Execução e ajustes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Atualize status dos compromissos (agendado/concluído/cancelado).</li>
              <li>Ao ocorrer atraso, mova o bloco e registre a causa.</li>
              <li>Use a visão <strong>Semana</strong> para balancear cargas.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Tratamento de exceções</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Sobreposição:</strong> reagendar o item menos crítico.
              </li>
              <li>
                <strong>Foco longo:</strong> dividir em dois blocos com pausa.
              </li>
              <li>
                <strong>Sem prazo:</strong> definir horário de início e fim.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Alertas e analytics</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc space-y-2 pl-5">
              <li>Observe a distribuição de blocos por tipo (Foco/Reunião/Pessoal).</li>
              <li>Revise o total de minutos alocados por semana.</li>
              <li>Use a visão <strong>Timeline</strong> para checar sequências.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Perfis de operação</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Gestor:</strong> revisar semana, conflitos e alocação de foco.
              </li>
              <li>
                <strong>Operador:</strong> atualizar status e manter agenda fiel.
              </li>
              <li>
                <strong>Estudante:</strong> priorizar blocos de estudo e revisões.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Checklist diário rápido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Confirmar compromissos do dia.</li>
              <li>Garantir 1–2 blocos de foco críticos.</li>
              <li>Reagendar atrasos com justificativa.</li>
              <li>Fechar o dia com status atualizado.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
