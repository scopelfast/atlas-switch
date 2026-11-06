import { and, eq, gte, inArray, isNotNull } from 'drizzle-orm';
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
import { taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';

/** Janela para somar horas reais (intervenções encerradas). */
export const TASKFLOW_DASHBOARD_HOURS_RANGE_DAYS = 30;

export type TaskflowDashboardStats = {
  rangeDays: number;
  tasksByStatus: { name: string; count: number; color: string }[];
  tasksByAssignee: { name: string; count: number }[];
  /** Soma de `estimated_duration_hours` nas tarefas visíveis (estado actual do quadro). */
  hoursEstimatedVisible: number;
  /** Soma de horas em intervenções encerradas (timer + manual) na janela `rangeDays`. */
  hoursInterventionsInRange: number;
};

export async function getTaskflowDashboardStats(
  teamId: number,
  opts?: GetBoardDataOptions,
): Promise<TaskflowDashboardStats> {
  const empty: TaskflowDashboardStats = {
    rangeDays: TASKFLOW_DASHBOARD_HOURS_RANGE_DAYS,
    tasksByStatus: [],
    tasksByAssignee: [],
    hoursEstimatedVisible: 0,
    hoursInterventionsInRange: 0,
  };

  const boardId = await getLatestTaskflowBoardIdForTeam(teamId);
  if (boardId == null) {
    return empty;
  }
  const taskWhereParts = [eq(taskflowTasks.boardId, boardId)];
  if (opts?.listScope === 'self' && opts.viewerUserId != null) {
    taskWhereParts.push(taskflowTaskInvolvesUserWhere(opts.viewerUserId));
  }

  const tasks = await db
    .select({
      id: taskflowTasks.id,
      statusId: taskflowTasks.statusId,
      estimatedDurationHours: taskflowTasks.estimatedDurationHours,
      assigneeId: taskflowTasks.assigneeId,
    })
    .from(taskflowTasks)
    .where(and(...taskWhereParts));

  const statusDefs = await db
    .select({
      id: taskflowStatusDefinitions.id,
      name: taskflowStatusDefinitions.name,
      color: taskflowStatusDefinitions.color,
    })
    .from(taskflowStatusDefinitions)
    .where(eq(taskflowStatusDefinitions.teamId, teamId));

  const statusMeta = new Map(statusDefs.map((s) => [s.id, s]));

  const statusAgg = new Map<string, { count: number; color: string }>();
  for (const t of tasks) {
    const def = statusMeta.get(t.statusId);
    const name = def?.name ?? `Estado #${t.statusId}`;
    const color = def?.color ?? 'slate';
    const cur = statusAgg.get(name);
    if (cur) {
      cur.count += 1;
    } else {
      statusAgg.set(name, { count: 1, color });
    }
  }

  const tasksByStatus = [...statusAgg.entries()]
    .map(([name, v]) => ({ name, count: v.count, color: v.color }))
    .sort((a, b) => b.count - a.count);

  const taskIds = tasks.map((t) => t.id);
  const assigneeTaskCount = new Map<number, number>();

  if (taskIds.length > 0) {
    const assigneeRows = await db
      .select({
        taskId: taskflowTaskAssignees.taskId,
        userId: taskflowTaskAssignees.userId,
      })
      .from(taskflowTaskAssignees)
      .where(inArray(taskflowTaskAssignees.taskId, taskIds));

    const byTask = new Map<number, number[]>();
    for (const r of assigneeRows) {
      const list = byTask.get(r.taskId) ?? [];
      list.push(r.userId);
      byTask.set(r.taskId, list);
    }

    for (const t of tasks) {
      const fromNn = byTask.get(t.id);
      const ids =
        fromNn && fromNn.length > 0
          ? [...new Set(fromNn)]
          : t.assigneeId != null
            ? [t.assigneeId]
            : [];
      for (const uid of ids) {
        assigneeTaskCount.set(uid, (assigneeTaskCount.get(uid) ?? 0) + 1);
      }
    }
  }

  let tasksByAssignee: { name: string; count: number }[] = [];
  if (assigneeTaskCount.size > 0) {
    const userIds = [...assigneeTaskCount.keys()];
    const userRows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));

    const nameById = new Map(
      userRows.map((u) => [u.id, (u.name?.trim() || u.email || `#${u.id}`) as string]),
    );

    tasksByAssignee = [...assigneeTaskCount.entries()]
      .map(([uid, count]) => ({
        name: nameById.get(uid) ?? `#${uid}`,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  let hoursEstimatedVisible = 0;
  for (const t of tasks) {
    if (t.estimatedDurationHours != null && Number.isFinite(t.estimatedDurationHours)) {
      hoursEstimatedVisible += t.estimatedDurationHours;
    }
  }

  const rangeStart = new Date(Date.now() - TASKFLOW_DASHBOARD_HOURS_RANGE_DAYS * 24 * 60 * 60 * 1000);
  let hoursInterventionsInRange = 0;
  if (taskIds.length > 0) {
    const intRows = await db
      .select({
        startedAt: taskflowInterventions.startedAt,
        endedAt: taskflowInterventions.endedAt,
      })
      .from(taskflowInterventions)
      .where(
        and(
          eq(taskflowInterventions.teamId, teamId),
          inArray(taskflowInterventions.taskId, taskIds),
          isNotNull(taskflowInterventions.endedAt),
          gte(taskflowInterventions.endedAt, rangeStart),
        ),
      );

    for (const r of intRows) {
      if (r.endedAt && r.startedAt) {
        const ms = r.endedAt.getTime() - r.startedAt.getTime();
        if (ms > 0) {
          hoursInterventionsInRange += ms / (60 * 60 * 1000);
        }
      }
    }
  }

  return {
    rangeDays: TASKFLOW_DASHBOARD_HOURS_RANGE_DAYS,
    tasksByStatus,
    tasksByAssignee,
    hoursEstimatedVisible: Math.round(hoursEstimatedVisible * 100) / 100,
    hoursInterventionsInRange: Math.round(hoursInterventionsInRange * 100) / 100,
  };
}
