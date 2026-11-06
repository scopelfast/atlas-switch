import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getLatestTaskflowBoardIdForTeam } from '@/lib/db/taskflow-board-resolve';
import {
  taskflowColumns,
  taskflowStatusDefinitions,
  taskflowTaskEvents,
  taskflowTasks,
} from '@/lib/db/schema';
import type { GetBoardDataOptions } from '@/lib/db/taskflow';
import { getTaskflowDashboardStats } from '@/lib/db/taskflow-dashboard-stats';
import { isTaskflowStatusTerminal } from '@/lib/taskflow/task-terminal';
import { taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';

/** Janela para contar movimentos Kanban (histórico mínimo E7.3). */
export const TASKFLOW_INSIGHTS_MOVES_RANGE_DAYS = 14;

export type TaskflowAiInsightsSignals = {
  movesRangeDays: number;
  openTaskCount: number;
  overdueOpenCount: number;
  urgentOrHighOpenCount: number;
  /** Tarefas abertas em coluna de produção acima do `max_stay_hours` da coluna. */
  slaBreachesOpen: { columnName: string; count: number }[];
  /** Tempo médio na coluna (só tarefas abertas), em horas. */
  dwellHoursByColumn: { columnName: string; avgDwellHours: number; taskCount: number }[];
  recentMovesCount: number;
  topAssignees: { name: string; count: number }[];
};

export type TaskflowAiInsightsPayload = {
  optedIn: true;
  synthesis: string[];
  signals: TaskflowAiInsightsSignals;
};

function normPriority(p: string | null | undefined): string {
  return (p || '').trim().toUpperCase();
}

function buildSynthesis(signals: TaskflowAiInsightsSignals): string[] {
  const out: string[] = [];
  const { overdueOpenCount, urgentOrHighOpenCount, openTaskCount, recentMovesCount, slaBreachesOpen } =
    signals;

  if (overdueOpenCount > 0) {
    out.push(
      `Existem ${overdueOpenCount} tarefa(s) aberta(s) com prazo ultrapassado — rever datas ou prioridade.`,
    );
  }
  if (urgentOrHighOpenCount > 0) {
    out.push(`${urgentOrHighOpenCount} tarefa(s) urgente(s) ou de prioridade alta ainda em aberto.`);
  }
  const breachTotal = slaBreachesOpen.reduce((a, b) => a + b.count, 0);
  if (breachTotal > 0) {
    const top = slaBreachesOpen[0];
    out.push(
      top
        ? `${breachTotal} tarefa(s) em fase de produção excedem o tempo máximo na coluna (ex.: «${top.columnName}»).`
        : `${breachTotal} tarefa(s) excedem o tempo máximo definido na coluna.`,
    );
  }

  const assignees = signals.topAssignees;
  if (assignees.length >= 2) {
    const maxC = assignees[0]?.count ?? 0;
    const minC = assignees[assignees.length - 1]?.count ?? 0;
    if (maxC > 0 && minC >= 0 && maxC >= minC * 2.5) {
      out.push(
        `Carga desequilibrada: ${assignees[0].name} com ${maxC} tarefa(s) visíveis — avaliar redistribuição.`,
      );
    }
  }

  if (openTaskCount >= 8 && recentMovesCount < 6) {
    out.push(
      `Poucos movimentos de coluna nos últimos ${signals.movesRangeDays} dias (${recentMovesCount}) face a ${openTaskCount} tarefa(s) aberta(s) — possível gargalo ou falta de triagem.`,
    );
  }

  if (out.length === 0) {
    out.push(
      'Não foram detectados sinais críticos nas tarefas visíveis; continuar a acompanhar prazos e colunas de produção.',
    );
  }

  out.push(
    'Resumo gerado por regras sobre dados do Taskflow; não utiliza modelo de linguagem externo nem envia dados para terceiros.',
  );

  return out.slice(0, 7);
}

export async function getTaskflowAiInsightsPayload(
  teamId: number,
  opts?: GetBoardDataOptions,
): Promise<TaskflowAiInsightsPayload> {
  const movesSince = new Date(Date.now() - TASKFLOW_INSIGHTS_MOVES_RANGE_DAYS * 24 * 60 * 60 * 1000);

  const emptySignals: TaskflowAiInsightsSignals = {
    movesRangeDays: TASKFLOW_INSIGHTS_MOVES_RANGE_DAYS,
    openTaskCount: 0,
    overdueOpenCount: 0,
    urgentOrHighOpenCount: 0,
    slaBreachesOpen: [],
    dwellHoursByColumn: [],
    recentMovesCount: 0,
    topAssignees: [],
  };

  const boardId = await getLatestTaskflowBoardIdForTeam(teamId);
  if (boardId == null) {
    return { optedIn: true, synthesis: buildSynthesis(emptySignals), signals: emptySignals };
  }
  const taskWhereParts = [eq(taskflowTasks.boardId, boardId)];
  if (opts?.listScope === 'self' && opts.viewerUserId != null) {
    taskWhereParts.push(taskflowTaskInvolvesUserWhere(opts.viewerUserId));
  }
  const taskWhere = and(...taskWhereParts);

  const statusDefs = await db
    .select({
      id: taskflowStatusDefinitions.id,
      fixedSituation: taskflowStatusDefinitions.fixedSituation,
    })
    .from(taskflowStatusDefinitions)
    .where(eq(taskflowStatusDefinitions.teamId, teamId));

  const terminalByStatusId = new Map<number, boolean>();
  for (const s of statusDefs) {
    terminalByStatusId.set(s.id, isTaskflowStatusTerminal(s.fixedSituation));
  }

  const columns = await db
    .select({
      id: taskflowColumns.id,
      name: taskflowColumns.name,
      phaseType: taskflowColumns.phaseType,
      maxStayHours: taskflowColumns.maxStayHours,
    })
    .from(taskflowColumns)
    .where(eq(taskflowColumns.boardId, boardId));

  const colById = new Map(columns.map((c) => [c.id, c]));
  const now = Date.now();

  const taskRows = await db
    .select({
      id: taskflowTasks.id,
      columnId: taskflowTasks.columnId,
      dueDate: taskflowTasks.dueDate,
      priority: taskflowTasks.priority,
      statusId: taskflowTasks.statusId,
      columnEnteredAt: taskflowTasks.columnEnteredAt,
    })
    .from(taskflowTasks)
    .where(taskWhere);

  const taskIds = taskRows.map((t) => t.id);

  const openTasks = taskRows.filter((t) => !terminalByStatusId.get(t.statusId));
  const overdueOpenCount = openTasks.filter((t) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate).getTime() < now;
  }).length;

  const urgentOrHighOpenCount = openTasks.filter((t) => {
    const p = normPriority(t.priority);
    return p === 'URGENT' || p === 'HIGH';
  }).length;

  const dwellAgg = new Map<number, { sumH: number; n: number }>();
  const slaBreachesByCol = new Map<number, number>();

  for (const t of openTasks) {
    const col = colById.get(t.columnId);
    if (!col) continue;
    const entered = t.columnEnteredAt ? new Date(t.columnEnteredAt).getTime() : now;
    const dwellH = Math.max(0, (now - entered) / (60 * 60 * 1000));
    const cur = dwellAgg.get(t.columnId) ?? { sumH: 0, n: 0 };
    cur.sumH += dwellH;
    cur.n += 1;
    dwellAgg.set(t.columnId, cur);

    const maxH = col.maxStayHours;
    if (
      col.phaseType === 'PRODUCTION' &&
      maxH != null &&
      Number.isFinite(maxH) &&
      maxH > 0 &&
      dwellH > maxH
    ) {
      slaBreachesByCol.set(t.columnId, (slaBreachesByCol.get(t.columnId) ?? 0) + 1);
    }
  }

  const dwellHoursByColumn = [...dwellAgg.entries()]
    .map(([columnId, v]) => {
      const name = colById.get(columnId)?.name ?? `Coluna #${columnId}`;
      return {
        columnName: name,
        avgDwellHours: v.n > 0 ? Math.round((v.sumH / v.n) * 10) / 10 : 0,
        taskCount: v.n,
      };
    })
    .sort((a, b) => b.avgDwellHours - a.avgDwellHours);

  const slaBreachesOpen = [...slaBreachesByCol.entries()]
    .map(([columnId, count]) => ({
      columnName: colById.get(columnId)?.name ?? `Coluna #${columnId}`,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  let recentMovesCount = 0;
  if (taskIds.length > 0) {
    const [row] = await db
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(taskflowTaskEvents)
      .innerJoin(taskflowTasks, eq(taskflowTaskEvents.taskId, taskflowTasks.id))
      .where(
        and(
          eq(taskflowTaskEvents.type, 'MOVED'),
          gte(taskflowTaskEvents.createdAt, movesSince),
          taskWhere,
        ),
      );
    recentMovesCount = Number(row?.n ?? 0);
  }

  const dash = await getTaskflowDashboardStats(teamId, opts);
  const topAssignees = dash.tasksByAssignee.slice(0, 12);

  const signals: TaskflowAiInsightsSignals = {
    movesRangeDays: TASKFLOW_INSIGHTS_MOVES_RANGE_DAYS,
    openTaskCount: openTasks.length,
    overdueOpenCount,
    urgentOrHighOpenCount,
    slaBreachesOpen,
    dwellHoursByColumn,
    recentMovesCount,
    topAssignees,
  };

  return {
    optedIn: true,
    synthesis: buildSynthesis(signals),
    signals,
  };
}
