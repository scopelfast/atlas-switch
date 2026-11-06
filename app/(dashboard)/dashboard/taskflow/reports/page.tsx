'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Download, FileSpreadsheet, FileText, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleDashboardPageShell } from '@/components/ui/module-dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { Button } from '@/components/ui/button';
import { MeasuredChartBox } from '@/components/charts/measured-chart-box';
import { canConfigureTaskflowBoard, hasPermission, type Role } from '@/lib/auth/permissions';

const jsonFetcher = (url: string) => fetch(url).then((res) => res.json());

/** Respostas 4xx/5xx não são tratadas como payload válido (evita crash ao usar campos inexistentes). */
async function reportsJsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

type DashboardPayload = {
  rangeDays: number;
  tasksByStatus: { name: string; count: number; color: string }[];
  tasksByAssignee: { name: string; count: number }[];
  hoursEstimatedVisible: number;
  hoursInterventionsInRange: number;
};

type TeamPayload = {
  taskflowAiInsightsEnabled?: boolean;
  seatLimit?: number | null;
  seatsUsed?: number | null;
};

type WeeklyCapacityPayload = {
  weekStart: string;
  weekEndExclusive: string;
  weekLabel: string;
  defaultCapacityHoursWeek: number;
  rows: {
    userId: number;
    name: string;
    estimatedHoursOpenShare: number;
    realInterventionHoursWeek: number;
    capacityHoursWeek: number;
  }[];
};

type AiInsightsPayload =
  | {
      optedIn: false;
      synthesis: null;
      signals: null;
    }
  | {
      optedIn: true;
      synthesis: string[];
      signals: {
        movesRangeDays: number;
        openTaskCount: number;
        overdueOpenCount: number;
        urgentOrHighOpenCount: number;
        recentMovesCount: number;
        slaBreachesOpen: { columnName: string; count: number }[];
        dwellHoursByColumn: { columnName: string; avgDwellHours: number; taskCount: number }[];
        topAssignees: { name: string; count: number }[];
      };
    };

const PIE_COLORS = [
  '#6366f1',
  '#a855f7',
  '#14b8a6',
  '#f59e0b',
  '#ef4444',
  '#64748b',
  '#22c55e',
  '#ec4899',
];

export default function TaskflowReportsPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', jsonFetcher);
  const role = (user?.role || 'member') as Role;
  const canView = hasPermission(role, 'taskflow.view');
  const canToggleInsights = canConfigureTaskflowBoard(role);

  const { data: teamData, mutate: mutateTeam } = useSWR<TeamPayload>(
    canView ? '/api/team' : null,
    jsonFetcher,
  );
  const insightsOptIn = Boolean(teamData?.taskflowAiInsightsEnabled);

  const { data, error, isLoading } = useSWR<DashboardPayload>(
    canView ? '/api/taskflow/dashboard' : null,
    reportsJsonFetcher,
  );

  const {
    data: insights,
    error: insightsError,
    isLoading: insightsLoading,
    mutate: mutateInsights,
  } = useSWR<AiInsightsPayload>(canView ? '/api/taskflow/ai-insights' : null, reportsJsonFetcher);

  const [insightTogglePending, setInsightTogglePending] = useState(false);
  const [weekDate, setWeekDate] = useState(() => new Date().toISOString().slice(0, 10));
  const weeklyKey = canView ? `/api/taskflow/weekly-capacity?week=${encodeURIComponent(weekDate)}` : null;
  const {
    data: weekly,
    error: weeklyError,
    isLoading: weeklyLoading,
  } = useSWR<WeeklyCapacityPayload>(weeklyKey, reportsJsonFetcher);

  const onToggleInsights = useCallback(
    async (enabled: boolean) => {
      setInsightTogglePending(true);
      try {
        const res = await fetch('/api/team/taskflow-ai-insights', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || 'Não foi possível atualizar.');
        }
        await mutateTeam();
        await mutateInsights();
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : 'Erro ao atualizar opt-in.');
      } finally {
        setInsightTogglePending(false);
      }
    },
    [mutateTeam, mutateInsights],
  );

  if (user && !canView) {
    return (
      <ModuleDashboardPageShell>
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">Sem permissão para o Taskflow.</p>
          </CardContent>
        </Card>
      </ModuleDashboardPageShell>
    );
  }

  const hoursData =
    data != null
      ? [
          { label: 'Estimado (quadro)', horas: data.hoursEstimatedVisible },
          { label: `Real (intervenções, ${data.rangeDays}d)`, horas: data.hoursInterventionsInRange },
        ]
      : [];

  const assigneeChart = (data?.tasksByAssignee ?? []).slice(0, 14);

  return (
    <ModuleDashboardPageShell innerClassName="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="Taskflow · Relatórios"
            description="Métricas do quadro, capacidade semanal e exportações em CSV, Excel ou PDF."
            className="w-full"
          />
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-emerald-200/80 bg-white/90 text-emerald-900 shadow-sm backdrop-blur-sm hover:bg-emerald-50 dark:border-emerald-700/40 dark:bg-slate-900/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
          >
            <a href="/api/taskflow/export/tasks" download className="inline-flex items-center gap-2">
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              CSV
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-teal-200/80 bg-white/90 text-teal-900 shadow-sm backdrop-blur-sm hover:bg-teal-50 dark:border-teal-800/40 dark:bg-slate-900/70 dark:text-teal-100 dark:hover:bg-teal-950/35"
          >
            <a
              href="/api/taskflow/export/tasks?format=xlsx"
              download
              className="inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
              Excel
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-rose-200/80 bg-white/90 text-rose-900 shadow-sm backdrop-blur-sm hover:bg-rose-50 dark:border-rose-900/40 dark:bg-slate-900/70 dark:text-rose-100 dark:hover:bg-rose-950/35"
          >
            <a href="/api/taskflow/export/tasks?format=pdf" download className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0" aria-hidden />
              PDF
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-slate-200/80 bg-white/90 text-slate-800 shadow-sm backdrop-blur-sm hover:bg-slate-50 dark:border-slate-600/50 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/60"
          >
            <a
              href={`/api/taskflow/export/weekly-capacity?week=${encodeURIComponent(weekDate)}`}
              download
              className="inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Carga semanal (CSV)
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-xl border-violet-200/80 dark:border-violet-800/50">
            <Link href="/manual/taskflow">Manual</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl border-violet-200/80 dark:border-violet-800/50">
            <Link href="/dashboard/taskflow">Voltar ao quadro</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">Não foi possível carregar os dados.</p>
      ) : null}

      <Card className="atlas-surface border-amber-200/60 dark:border-amber-900/40">
        <CardHeader className="gap-1 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-300" aria-hidden />
            Insights
          </CardTitle>
          <CardDescription>
            Resumo automático por regras (atrasos, SLA em colunas de produção, carga, movimentos recentes). Usa o
            mesmo conjunto de tarefas visíveis no quadro. A equipe deve ativar o processamento abaixo; não envia
            dados a APIs de IA de terceiros.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {canToggleInsights ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-600/60 dark:bg-slate-900/50">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                checked={insightsOptIn}
                disabled={insightTogglePending}
                onChange={(ev) => onToggleInsights(ev.target.checked)}
              />
              <span className="text-slate-700 dark:text-slate-200">
                <span className="font-semibold">Ativar insights para esta equipe</span>
                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                  Proprietário, administrador ou gestor podem ligar ou desligar. Membros e supervisores só veem o
                  resultado dentro do seu âmbito de tarefas.
                </span>
              </span>
            </label>
          ) : (
            <p className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-slate-600 dark:border-slate-600/60 dark:bg-slate-900/50 dark:text-slate-300">
              O opt-in é gerido pelo proprietário, administrador ou gestor da equipe.
            </p>
          )}

          {!insightsOptIn ? (
            <p className="text-slate-500">Insights desativados — sem cálculo de sinais no servidor.</p>
          ) : insightsLoading ? (
            <p className="text-slate-500">A calcular insights…</p>
          ) : insightsError ? (
            <p className="text-rose-600 dark:text-rose-400">Não foi possível carregar os insights.</p>
          ) : insights?.optedIn === true ? (
            <div className="space-y-3">
              <ul className="list-inside list-disc space-y-2 text-slate-700 dark:text-slate-200">
                {insights.synthesis.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <details className="rounded-lg border border-slate-200/70 bg-white/60 p-3 text-xs text-slate-600 dark:border-slate-600/50 dark:bg-slate-950/40 dark:text-slate-400">
                <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  Ver sinais numéricos
                </summary>
                <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Tarefas abertas (visíveis)</dt>
                    <dd>{insights.signals.openTaskCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Em atraso</dt>
                    <dd>{insights.signals.overdueOpenCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Urgente / alta em aberto</dt>
                    <dd>{insights.signals.urgentOrHighOpenCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Movimentos ({insights.signals.movesRangeDays}d)</dt>
                    <dd>{insights.signals.recentMovesCount}</dd>
                  </div>
                </dl>
              </details>
            </div>
          ) : (
            <p className="text-slate-500">Sem dados de insights.</p>
          )}
        </CardContent>
      </Card>

      <Card className="atlas-surface min-w-0 border-indigo-200/60 dark:border-indigo-900/40">
        <CardHeader className="gap-1 pb-2">
          <CardTitle className="text-base">Capacidade vs carga</CardTitle>
          <CardDescription>
            Semana UTC a partir de segunda-feira (rótulo = início). Estimado: horas previstas em tarefas
            abertas visíveis, repartidas por responsável. Real: intervenções encerradas nessa semana. Capacidade
            indicativa: {weekly?.defaultCapacityHoursWeek ?? 40} h/pessoa (valor fixo nesta versão).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4">
          {weeklyError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Não foi possível carregar a carga semanal:{' '}
              {weeklyError instanceof Error ? weeklyError.message : 'erro desconhecido'}
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="text-xs font-semibold">Semana (qualquer dia)</span>
              <input
                type="date"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={weekDate}
                onChange={(e) => setWeekDate(e.target.value)}
              />
            </label>
            {weekly?.weekLabel != null && typeof weekly.weekEndExclusive === 'string' ? (
              <span className="text-xs text-slate-500">
                Semana UTC: {weekly.weekLabel} → {weekly.weekEndExclusive.slice(0, 10)} (exclusivo)
              </span>
            ) : null}
          </div>
          <div className="min-h-[280px] w-full min-w-0 shrink-0">
            {weeklyLoading ? (
              <p className="text-sm text-slate-500">A carregar carga semanal…</p>
            ) : !weekly?.rows?.length ? (
              <p className="text-sm text-slate-500">Sem dados de responsáveis nesta visão.</p>
            ) : (
              <MeasuredChartBox className="h-[380px] min-h-[280px]">
                {({ width, height }) => (
                  <ResponsiveContainer width={width} height={height} minWidth={0}>
                    <BarChart
                      layout="vertical"
                      data={weekly.rows}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis type="number" tick={{ fontSize: 11 }} unit=" h" />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v, name) => [`${typeof v === 'number' ? v : '—'} h`, String(name)]}
                      />
                      <Legend />
                      <ReferenceLine
                        x={weekly.defaultCapacityHoursWeek}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        label={{
                          value: `${weekly.defaultCapacityHoursWeek}h`,
                          position: 'top',
                          fill: '#64748b',
                        }}
                      />
                      <Bar
                        dataKey="estimatedHoursOpenShare"
                        fill="#6366f1"
                        radius={[0, 4, 4, 0]}
                        name="Estimado (aberto, compartilhado)"
                      />
                      <Bar
                        dataKey="realInterventionHoursWeek"
                        fill="#0d9488"
                        radius={[0, 4, 4, 0]}
                        name="Real (intervenções)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </MeasuredChartBox>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="atlas-surface min-w-0 border-violet-200/50 dark:border-violet-900/40">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden />
              Tarefas por estado
            </CardTitle>
            <CardDescription>Distribuição atual das tarefas visíveis.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-[320px] min-h-[280px] min-w-0 flex-col">
            {isLoading ? (
              <p className="text-sm text-slate-500">A carregar…</p>
            ) : !data?.tasksByStatus?.length ? (
              <p className="text-sm text-slate-500">Sem tarefas para mostrar.</p>
            ) : (
              <MeasuredChartBox className="min-h-0 min-w-0 flex-1 basis-0">
                {({ width, height }) => (
                  <ResponsiveContainer width={width} height={height} minWidth={0}>
                    <PieChart>
                      <Pie
                        data={data.tasksByStatus}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) =>
                          `${String(name)} (${percent != null ? (Number(percent) * 100).toFixed(0) : 0}%)`
                        }
                      >
                        {data.tasksByStatus.map((_, i) => (
                          <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${typeof value === 'number' ? value : '—'} tarefa(s)`, '']}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </MeasuredChartBox>
            )}
          </CardContent>
        </Card>

        <Card className="atlas-surface min-w-0 border-slate-200/80 dark:border-slate-700/60">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-base">Horas estimadas vs tempo em intervenções</CardTitle>
            <CardDescription>
              Estimado: soma das horas previstas nas tarefas visíveis. Real: soma das durações das intervenções
              encerradas nos últimos {data?.rangeDays ?? 30} dias (timer + manual).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-[320px] min-h-[280px] min-w-0 flex-col">
            {isLoading ? (
              <p className="text-sm text-slate-500">A carregar…</p>
            ) : (
              <MeasuredChartBox className="min-h-0 min-w-0 flex-1 basis-0">
                {({ width, height }) => (
                  <ResponsiveContainer width={width} height={height} minWidth={0}>
                    <BarChart data={hoursData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit=" h" />
                      <Tooltip formatter={(v) => [`${typeof v === 'number' ? v : '—'} h`, '']} />
                      <Bar dataKey="horas" fill="#6366f1" radius={[6, 6, 0, 0]} name="Horas" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </MeasuredChartBox>
            )}
          </CardContent>
        </Card>

        <Card className="atlas-surface min-w-0 border-cyan-200/50 dark:border-cyan-900/40 lg:col-span-2">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-base">Carga por responsável (tarefas visíveis)</CardTitle>
            <CardDescription>
              Cada tarefa conta uma vez por responsável na lista N:N (ou pelo responsável legado se não houver N:N).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-[420px] min-h-[280px] max-h-[60vh] min-w-0 flex-col">
            {isLoading ? (
              <p className="text-sm text-slate-500">A carregar…</p>
            ) : !assigneeChart.length ? (
              <p className="text-sm text-slate-500">Sem responsáveis atribuídos nas tarefas visíveis.</p>
            ) : (
              <MeasuredChartBox className="min-h-0 min-w-0 flex-1 basis-0">
                {({ width, height }) => (
                  <ResponsiveContainer width={width} height={height} minWidth={0}>
                    <BarChart
                      layout="vertical"
                      data={assigneeChart}
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${typeof v === 'number' ? v : '—'} tarefa(s)`, '']} />
                      <Bar dataKey="count" fill="#0d9488" radius={[0, 6, 6, 0]} name="Tarefas" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </MeasuredChartBox>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleDashboardPageShell>
  );
}
