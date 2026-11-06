'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpPanel } from '@/components/ui/help-panel';
import { ScriptumStatCard } from '@/components/scriptum/scriptum-stat-card';
import { hasPermission, isOwnerLike, type Role } from '@/lib/auth/permissions';
import useSWR from 'swr';
import {
  Sparkles,
  CheckSquare,
  Clock3,
  Users,
  CalendarClock,
  Video,
  Briefcase,
  Library,
  CreditCard,
  NotebookPen,
  FilePenLine,
  Boxes,
  Target,
  AlertTriangle,
} from 'lucide-react';

type ApiError = Error & { status?: number };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(
      typeof data?.error === 'string' ? data.error : `Falha ao carregar dados (${res.status}).`,
    ) as ApiError;
    err.status = res.status;
    throw err;
  }
  return data;
};

const swrNoRetryOn403 = {
  revalidateOnFocus: false,
  shouldRetryOnError: (error: unknown) => (error as { status?: number } | undefined)?.status !== 403,
};

/**
 * Painel principal simplificado em português para evitar erros de renderização.
 */
export default function DashboardPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher, swrNoRetryOn403);
  const { data: taskflowMetrics } = useSWR<
    { cycleTimeAvg?: number; bottleneckDays?: number } | null
  >('/api/taskflow/metrics', fetcher, swrNoRetryOn403);
  const { data: taskflowDashboard } = useSWR<
    { tasksByStatus?: Array<{ count?: number }>; hoursEstimatedVisible?: number; hoursInterventionsInRange?: number } | null
  >('/api/taskflow/dashboard', fetcher, swrNoRetryOn403);
  const { data: reunifyMeetings } = useSWR<Array<{ status?: string }>>(
    '/api/reunify/meetings',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: projectusProjects } = useSWR<Array<{ status?: string }>>(
    '/api/projectus/projects',
    fetcher,
    swrNoRetryOn403,
  );
  const today = new Date().toISOString().slice(0, 10);
  const { data: chronosAgenda } = useSWR<Array<{ status?: string }>>(
    `/api/chronos/agenda?from=${today}&to=${today}`,
    fetcher,
    swrNoRetryOn403,
  );
  const { data: billtrakMetrics } = useSWR<
    { receitas?: number; despesas?: number; pendentes?: number; margem?: number } | null
  >('/api/billtrak/metrics', fetcher, swrNoRetryOn403);
  const { data: resources } = useSWR<Array<{ status?: string }>>(
    '/api/resourcehub/resources',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: weeklyCapacity } = useSWR<{
    defaultCapacityHoursWeek?: number;
    rows?: Array<{
      userId: number;
      name: string;
      estimatedHoursOpenShare: number;
      realInterventionHoursWeek: number;
      capacityHoursWeek: number;
    }>;
  }>('/api/taskflow/weekly-capacity', fetcher, swrNoRetryOn403);

  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'dashboard.view');

  const meetingsList = Array.isArray(reunifyMeetings) ? reunifyMeetings : [];
  const projectsList = Array.isArray(projectusProjects) ? projectusProjects : [];
  const agendaList = Array.isArray(chronosAgenda) ? chronosAgenda : [];
  const resourcesList = Array.isArray(resources) ? resources : [];

  const tasksCycleAvg = Number(taskflowMetrics?.cycleTimeAvg ?? 0);
  const taskflowBottleneckDays = Number(taskflowMetrics?.bottleneckDays ?? 0);
  const taskflowVisibleTasks = Array.isArray(taskflowDashboard?.tasksByStatus)
    ? taskflowDashboard!.tasksByStatus!.reduce((sum, row) => sum + Number(row.count ?? 0), 0)
    : 0;
  const estimatedHours = Number(taskflowDashboard?.hoursEstimatedVisible ?? 0);
  const interventionHours = Number(taskflowDashboard?.hoursInterventionsInRange ?? 0);
  const ritmoPercent =
    estimatedHours > 0 ? Math.max(0, Math.min(200, Math.round((interventionHours / estimatedHours) * 100))) : 0;
  const meetingsScheduled = meetingsList.filter((m) => m.status === 'AGENDADA').length;
  const activeProjects = projectsList.filter((p) => p.status === 'EM_ANDAMENTO').length;
  const agendaConcluidaHoje = agendaList.filter((a) => a.status === 'CONCLUIDO').length;
  const receitaLiquida = Number(billtrakMetrics?.receitas ?? 0) - Number(billtrakMetrics?.despesas ?? 0);
  const receitaLiquidaCompacta = Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(receitaLiquida);
  const recursosDisponiveis = resourcesList.filter((r) => r.status === 'DISPONIVEL').length;

  /**
   * Dicas personalizadas conforme perfil do usuário.
   */
  const helpTips =
    isOwnerLike(role)
      ? [
        'Acompanhe o progresso do time por módulo.',
        'Libere acessos conforme as funções do time.',
      ]
      : [
        'Acesse seu módulo principal pelo menu lateral.',
        'Mantenha suas tarefas atualizadas diariamente.',
      ];

  if (user && !canView) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você não tem permissão para visualizar o painel.
            </p>
          </CardContent>
        </Card>
        <div className="mt-6">
          <HelpPanel
            title="Ajuda rápida"
            description="Se precisar deste acesso, fale com o gestor."
            tips={helpTips}
          />
        </div>
      </section>
    );
  }

  const weeklyRows = Array.isArray(weeklyCapacity?.rows) ? weeklyCapacity.rows : [];
  const weeklyCapacityDefault = Number(weeklyCapacity?.defaultCapacityHoursWeek ?? 40);
  const weeklyTotalEstimated = weeklyRows.reduce((sum, row) => sum + Number(row.estimatedHoursOpenShare ?? 0), 0);
  const weeklyTotalReal = weeklyRows.reduce((sum, row) => sum + Number(row.realInterventionHoursWeek ?? 0), 0);
  const weeklyTotalCapacity = weeklyRows.reduce(
    (sum, row) => sum + Number(row.capacityHoursWeek ?? weeklyCapacityDefault),
    0,
  );
  const weeklyEfficiencyPercent =
    weeklyTotalCapacity > 0 ? Math.max(0, Math.min(200, Math.round((weeklyTotalReal / weeklyTotalCapacity) * 100))) : 0;

  const qualityDone = Array.isArray(taskflowDashboard?.tasksByStatus)
    ? taskflowDashboard.tasksByStatus
        .filter((row) => /conclu/i.test(String((row as { name?: string }).name ?? '')))
        .reduce((sum, row) => sum + Number(row.count ?? 0), 0)
    : 0;
  const qualityTotal = taskflowVisibleTasks;
  const qualityOpen = Math.max(qualityTotal - qualityDone, 0);
  const qualityDonePercent = qualityTotal > 0 ? Math.round((qualityDone / qualityTotal) * 100) : 0;
  const qualityPressurePercent = qualityTotal > 0 ? Math.round((qualityOpen / qualityTotal) * 100) : 0;
  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        qualityDonePercent * 0.6 +
          Math.max(0, 100 - Math.min(taskflowBottleneckDays * 8, 100)) * 0.2 +
          Math.max(0, 100 - Math.min(taskflowBottleneckDays * 6, 100)) * 0.2,
      ),
    ),
  );
  const rankedByLoad = [...weeklyRows].sort(
    (a, b) => Number(b.estimatedHoursOpenShare ?? 0) - Number(a.estimatedHoursOpenShare ?? 0),
  );
  const topLoaded = rankedByLoad.slice(0, 5);
  const lessLoaded = [...rankedByLoad].reverse().slice(0, 5);

  const getLoadSignal = (row: { estimatedHoursOpenShare?: number; capacityHoursWeek?: number }) => {
    const estimated = Number(row.estimatedHoursOpenShare ?? 0);
    const capacity = Number(row.capacityHoursWeek ?? weeklyCapacityDefault);
    if (capacity <= 0) {
      return {
        label: 'Sem base',
        dotClass: 'bg-slate-400',
        textClass: 'text-slate-500 dark:text-slate-400',
      };
    }
    const ratio = estimated / capacity;
    if (ratio >= 1) {
      return {
        label: 'Crítico',
        dotClass: 'bg-rose-500',
        textClass: 'text-rose-600 dark:text-rose-300',
      };
    }
    if (ratio >= 0.8) {
      return {
        label: 'Atenção',
        dotClass: 'bg-amber-500',
        textClass: 'text-amber-600 dark:text-amber-300',
      };
    }
    return {
      label: 'OK',
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-600 dark:text-emerald-300',
    };
  };

  const buildLinePath = (values: number[], width: number, height: number) => {
    const max = Math.max(...values, 1);
    const step = width / (values.length - 1 || 1);
    return values
      .map((value, index) => {
        const x = index * step;
        const y = height - (value / max) * height;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-fuchsia-900 p-6 text-white atlas-soft-shadow lg:p-8 atlas-fade-in">
        <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_top,_#7c3aed,_transparent_55%)]" />
        <div className="absolute -left-24 top-10 h-56 w-56 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute right-4 top-0 h-40 w-40 rounded-full bg-fuchsia-500/30 blur-3xl" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.35em] text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
              AtlasSwitch
            </div>
            <h1 className="text-3xl font-semibold leading-tight lg:text-4xl">
              Bem-vindo ao seu centro de operações{' '}
              <span className="atlas-gradient-text">moderno</span>
            </h1>
            <p className="max-w-xl text-sm text-indigo-100/90 lg:text-base">
              Um painel jovem, elegante e focado em performance. Decisões mais
              rápidas com módulos inteligentes e métricas em tempo real.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="w-full rounded-full bg-white text-slate-900 shadow-md hover:bg-white/90 sm:w-auto"
              >
                <Link href="/dashboard/taskflow">Abrir tarefas</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full rounded-full border-white/60 bg-white/10 text-white shadow-md hover:bg-white/20 sm:w-auto"
              >
                <Link href="/dashboard/usuarios">Gerenciar usuários</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <ScriptumStatCard
              variant="indigo"
              icon={Target}
              title="Ritmo do time"
              description="Execução nos últimos 30 dias"
              value={`${ritmoPercent}%`}
              footnote="Razão entre horas executadas e horas estimadas (Taskflow)."
              compact
            />
            <ScriptumStatCard
              variant="sky"
              icon={CheckSquare}
              title="Tarefas em foco"
              description="Visão operacional atual"
              value={taskflowVisibleTasks}
              footnote="Total de tarefas visíveis no quadro (respeita permissões)."
              compact
            />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card className="atlas-surface atlas-hover xl:col-span-4">
          <CardHeader className="gap-1 pb-2">
            <CardTitle>Visão geral do time</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Leitura executiva dos principais módulos para acompanhar evolução geral.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <ScriptumStatCard
              variant="indigo"
              icon={CheckSquare}
              title="Taskflow"
              description="Fluxo de execução"
              value={`${tasksCycleAvg} dias`}
              footnote="Ciclo médio de entrega"
              compact
            />
            <ScriptumStatCard
              variant="sky"
              icon={Video}
              title="Reunify"
              description="Coordenação de reuniões"
              value={meetingsScheduled}
              footnote="Reuniões agendadas"
              compact
            />
            <ScriptumStatCard
              variant="violet"
              icon={Briefcase}
              title="Projectus"
              description="Carteira ativa"
              value={activeProjects}
              footnote="Projetos em andamento"
              compact
            />
            <ScriptumStatCard
              variant="emerald"
              icon={CalendarClock}
              title="Chronos"
              description="Execução da agenda"
              value={agendaConcluidaHoje}
              footnote="Concluídos hoje"
              compact
            />
            <ScriptumStatCard
              variant="indigo"
              icon={CreditCard}
              title="BillTrak"
              description="Saúde financeira"
              value={
                <span
                  title={receitaLiquida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  aria-label={`Receita líquida completa: ${receitaLiquida.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}`}
                >
                  {receitaLiquidaCompacta}
                </span>
              }
              footnote="Receita líquida"
              compact
            />
            <ScriptumStatCard
              variant="sky"
              icon={Boxes}
              title="ResourceHub"
              description="Capacidade disponível"
              value={recursosDisponiveis}
              footnote="Recursos disponíveis"
              compact
            />
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">
              <Target className="h-4 w-4" />
              Saúde de execução
            </div>
            <CardTitle>{tasksCycleAvg} dias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Tempo médio para concluir tarefas no Taskflow.
            </p>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              Gargalo atual
            </div>
            <CardTitle>{taskflowBottleneckDays} dias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Idade média do gargalo estimado no fluxo de tarefas.
            </p>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">
              <CheckSquare className="h-4 w-4" />
              Tarefas
            </div>
            <CardTitle>Taskflow</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Kanban moderno com automações, métricas e prioridades visuais.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/taskflow">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-sky-500">
              <Video className="h-4 w-4" />
              Reuniões
            </div>
            <CardTitle>Reunify</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Agendas colaborativas, atas automáticas e follow-up inteligente.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/reunify">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
              <Briefcase className="h-4 w-4" />
              Projetos
            </div>
            <CardTitle>Projectus</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Planejamento, riscos e indicadores em um painel executivo.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/projectus">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">
              <Library className="h-4 w-4" />
              Biblioteca
            </div>
            <CardTitle>Bibliotheca</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Documentos inteligentes com OCR, busca e tags.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/bibliotheca">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
              <CreditCard className="h-4 w-4" />
              Financeiro
            </div>
            <CardTitle>BillTrak</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Custos, faturamento e fluxo de caixa automatizados.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/billtrak">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              <NotebookPen className="h-4 w-4" />
              Notas
            </div>
            <CardTitle>Notepad Pro</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Captura de ideias com markdown, voz e links.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/notepad">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
              <FilePenLine className="h-4 w-4" />
              Escrita
            </div>
            <CardTitle>Scriptum</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Escrita profissional com foco, revisoes e exportacao.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/scriptum">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-500">
              <Boxes className="h-4 w-4" />
              Recursos
            </div>
            <CardTitle>ResourceHub</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Pessoas, ativos e capacidade em um painel unico.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/resourcehub">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-500">
              <Users className="h-4 w-4" />
              Usuários
            </div>
            <CardTitle>Gestão de acessos</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Convites, funções e controle de permissões do time.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/usuarios">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
              <CalendarClock className="h-4 w-4" />
              Chronos
            </div>
            <CardTitle>Agenda inteligente</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Foco total em produtividade e rotina otimizada.
            </p>
            <Button asChild className="mt-auto">
              <Link href="/dashboard/chronos">Abrir módulo</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <CardTitle>Performance semanal</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Semana atual real: horas executadas vs capacidade nominal do time
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/60">
                <p className="text-slate-500 dark:text-slate-400">Executado</p>
                <p className="mt-1 text-base font-semibold text-emerald-600 dark:text-emerald-300">
                  {weeklyTotalReal.toFixed(1)}h
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/60">
                <p className="text-slate-500 dark:text-slate-400">Capacidade</p>
                <p className="mt-1 text-base font-semibold text-indigo-600 dark:text-indigo-300">
                  {weeklyTotalCapacity.toFixed(1)}h
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/60">
                <p className="text-slate-500 dark:text-slate-400">Eficiência</p>
                <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {weeklyEfficiencyPercent}%
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fonte: `weekly-capacity` (real = intervenções encerradas na semana; capacidade = soma por colaborador).
            </p>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-2">
            <CardTitle>Qualidade das entregas</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sinal real com base em conclusão visível e pressão de backlog
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/60">
                <p className="text-slate-500 dark:text-slate-400">Concluídas</p>
                <p className="mt-1 text-base font-semibold text-emerald-600 dark:text-emerald-300">
                  {qualityDonePercent}%
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/60">
                <p className="text-slate-500 dark:text-slate-400">Backlog aberto</p>
                <p className="mt-1 text-base font-semibold text-amber-600 dark:text-amber-300">
                  {qualityPressurePercent}%
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/60">
                <p className="text-slate-500 dark:text-slate-400">Score composto</p>
                <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{qualityScore}%</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fonte: `taskflow/dashboard` + `taskflow/metrics` (sem mock).
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Top 5 mais carregados
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Baseado em horas estimadas abertas na semana atual (Taskflow).
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {topLoaded.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados de carga nesta semana.</p>
            ) : (
              topLoaded.map((row) => (
                <div
                  key={`top-${row.userId}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2 text-sm dark:border-slate-700/60"
                >
                  <span className="truncate pr-3">{row.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-600 dark:text-amber-300">
                      {Number(row.estimatedHoursOpenShare ?? 0).toFixed(1)}h
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${getLoadSignal(row).textClass}`}>
                      <span className={`h-2 w-2 rounded-full ${getLoadSignal(row).dotClass}`} />
                      {getLoadSignal(row).label}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-emerald-500" />
              Top 5 menos carregados
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Oportunidade para redistribuir tarefas e agenda.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {lessLoaded.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados de carga nesta semana.</p>
            ) : (
              lessLoaded.map((row) => (
                <div
                  key={`less-${row.userId}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2 text-sm dark:border-slate-700/60"
                >
                  <span className="truncate pr-3">{row.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                      {Number(row.estimatedHoursOpenShare ?? 0).toFixed(1)}h
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${getLoadSignal(row).textClass}`}>
                      <span className={`h-2 w-2 rounded-full ${getLoadSignal(row).dotClass}`} />
                      {getLoadSignal(row).label}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Use o menu lateral para navegar entre módulos."
          tips={helpTips}
        />
      </div>
    </section>
  );
}
