import { and, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getLatestTaskflowBoardIdForTeam } from '@/lib/db/taskflow-board-resolve';
import {
  taskflowInterventions,
  taskflowStatusDefinitions,
  taskflowTaskAssignees,
  taskflowTasks,
  users,
} from '@/lib/db/schema';
import type { GetBoardDataOptions } from '@/lib/db/taskflow';
import { isTaskflowStatusTerminal } from '@/lib/taskflow/task-terminal';
import { taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';

/** Capacidade semanal indicativa (MVP; não persistido por utilizador). */
export const TASKFLOW_WEEKLY_DEFAULT_CAPACITY_HOURS = 40;

export type UtcWeekRange = {
  weekStart: Date;
  weekEndExclusive: Date;
  weekLabel: string;
};

/** Semana UTC segunda–domingo (fim exclusivo +7d). */
export function utcMondayWeekRange(anchor: Date): UtcWeekRange {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const day = anchor.getUTCDate();
  const d = new Date(Date.UTC(y, m, day));
  const dow = d.getUTCDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(d);
  weekStart.setUTCDate(d.getUTCDate() - daysFromMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEndExclusive = new Date(weekStart);
  weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 7);
  return {
    weekStart,
    weekEndExclusive,
    weekLabel: weekStart.toISOString().slice(0, 10),
  };
}

export type TaskflowWeeklyCapacityRow = {
  userId: number;
  name: string;
  /** Parte da estimativa em tarefas abertas (estimativa ÷ N responsáveis). */
  estimatedHoursOpenShare: number;
  /** Horas reais em intervenções encerradas na semana (tarefas visíveis). */
  realInterventionHoursWeek: number;
  capacityHoursWeek: number;
};

export type TaskflowWeeklyCapacityPayload = {
  weekStart: string;
  weekEndExclusive: string;
  weekLabel: string;
  defaultCapacityHoursWeek: number;
  rows: TaskflowWeeklyCapacityRow[];
};

export async function getTaskflowWeeklyCapacityLoad(
  teamId: number,
  anchor: Date,
  opts?: GetBoardDataOptions,
): Promise<TaskflowWeeklyCapacityPayload> {
  const { weekStart, weekEndExclusive, weekLabel } = utcMondayWeekRange(anchor);

  const empty: TaskflowWeeklyCapacityPayload = {
    weekStart: weekStart.toISOString(),
    weekEndExclusive: weekEndExclusive.toISOString(),
    weekLabel,
    defaultCapacityHoursWeek: TASKFLOW_WEEKLY_DEFAULT_CAPACITY_HOURS,
    rows: [],
  };

  const boardId = await getLatestTaskflowBoardIdForTeam(teamId);
  if (boardId == null) {
    return empty;
  }
  const taskWhereParts = [eq(taskflowTasks.boardId, boardId)];
  if (opts?.listScope === 'self' && opts.viewerUserId != null) {
    taskWhereParts.push(taskflowTaskInvolvesUserWhere(opts.viewerUserId));
  }
  const taskWhere = and(...taskWhereParts);

  const tasks = await db
    .select({
      id: taskflowTasks.id,
      statusId: taskflowTasks.statusId,
      estimatedDurationHours: taskflowTasks.estimatedDurationHours,
      assigneeId: taskflowTasks.assigneeId,
    })
    .from(taskflowTasks)
    .where(taskWhere);

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

  const taskIds = tasks.map((t) => t.id);
  const byTaskAssignees = new Map<number, number[]>();
  if (taskIds.length > 0) {
    const rows = await db
      .select({
        taskId: taskflowTaskAssignees.taskId,
        userId: taskflowTaskAssignees.userId,
      })
      .from(taskflowTaskAssignees)
      .where(inArray(taskflowTaskAssignees.taskId, taskIds));
    for (const r of rows) {
      const list = byTaskAssignees.get(r.taskId) ?? [];
      list.push(r.userId);
      byTaskAssignees.set(r.taskId, list);
    }
  }

  const estimatedByUser = new Map<number, number>();
  for (const t of tasks) {
    if (terminalByStatusId.get(t.statusId)) continue;
    const nn = byTaskAssignees.get(t.id);
    const ids =
      nn && nn.length > 0 ? [...new Set(nn)] : t.assigneeId != null ? [t.assigneeId] : [];
    if (ids.length === 0) continue;
    const est =
      t.estimatedDurationHours != null && Number.isFinite(t.estimatedDurationHours)
        ? t.estimatedDurationHours
        : 0;
    const share = est / ids.length;
    for (const uid of ids) {
      estimatedByUser.set(uid, (estimatedByUser.get(uid) ?? 0) + share);
    }
  }

  const realByUser = new Map<number, number>();
  if (taskIds.length > 0) {
    const intRows = await db
      .select({
        userId: taskflowInterventions.userId,
        startedAt: taskflowInterventions.startedAt,
        endedAt: taskflowInterventions.endedAt,
      })
      .from(taskflowInterventions)
      .innerJoin(taskflowTasks, eq(taskflowInterventions.taskId, taskflowTasks.id))
      .where(
        and(
          eq(taskflowInterventions.teamId, teamId),
          eq(taskflowTasks.boardId, boardId),
          inArray(taskflowInterventions.taskId, taskIds),
          isNotNull(taskflowInterventions.endedAt),
          gte(taskflowInterventions.endedAt, weekStart),
          lt(taskflowInterventions.endedAt, weekEndExclusive),
        ),
      );

    for (const r of intRows) {
      if (!r.endedAt || !r.startedAt) continue;
      const ms = r.endedAt.getTime() - r.startedAt.getTime();
      if (ms <= 0) continue;
      const h = ms / (60 * 60 * 1000);
      realByUser.set(r.userId, (realByUser.get(r.userId) ?? 0) + h);
    }
  }

  const allUserIds = new Set<number>([...estimatedByUser.keys(), ...realByUser.keys()]);
  if (allUserIds.size === 0) {
    return empty;
  }

  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, [...allUserIds]));

  const nameById = new Map(
    userRows.map((u) => [u.id, (u.name?.trim() || u.email || `#${u.id}`) as string]),
  );

  const rows: TaskflowWeeklyCapacityRow[] = [...allUserIds]
    .map((userId) => ({
      userId,
      name: nameById.get(userId) ?? `#${userId}`,
      estimatedHoursOpenShare: Math.round((estimatedByUser.get(userId) ?? 0) * 100) / 100,
      realInterventionHoursWeek: Math.round((realByUser.get(userId) ?? 0) * 100) / 100,
      capacityHoursWeek: TASKFLOW_WEEKLY_DEFAULT_CAPACITY_HOURS,
    }))
    .sort((a, b) => b.estimatedHoursOpenShare + b.realInterventionHoursWeek - (a.estimatedHoursOpenShare + a.realInterventionHoursWeek));

  return {
    weekStart: weekStart.toISOString(),
    weekEndExclusive: weekEndExclusive.toISOString(),
    weekLabel,
    defaultCapacityHoursWeek: TASKFLOW_WEEKLY_DEFAULT_CAPACITY_HOURS,
    rows,
  };
}
