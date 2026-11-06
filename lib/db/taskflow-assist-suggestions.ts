import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getLatestTaskflowBoardIdForTeam } from '@/lib/db/taskflow-board-resolve';
import {
  taskflowColumns,
  taskflowStatusDefinitions,
  taskflowTaskAssignees,
  taskflowTasks,
  users,
} from '@/lib/db/schema';
import type { GetBoardDataOptions } from '@/lib/db/taskflow';
import { getTaskflowDashboardStats } from '@/lib/db/taskflow-dashboard-stats';
import { isTaskflowStatusTerminal } from '@/lib/taskflow/task-terminal';
import { taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';

const PRI_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

function normPriority(p: string | null | undefined): string {
  return (p || '').trim().toUpperCase();
}

function rankP(p: string): number {
  const n = normPriority(p);
  const i = PRI_ORDER.indexOf(n as (typeof PRI_ORDER)[number]);
  return i < 0 ? 1 : i;
}

function bumpPriority(current: string, targetRank: number): string {
  const r = Math.max(rankP(current), Math.min(PRI_ORDER.length - 1, targetRank));
  return PRI_ORDER[r];
}

export type AssistPrioritySuggestion = {
  taskId: number;
  title: string;
  currentPriority: string;
  suggestedPriority: string;
  reason: string;
};

export type AssistReassignSuggestion = {
  taskId: number;
  title: string;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  reason: string;
};

export type TaskflowAssistSuggestionsPayload = {
  optedIn: true;
  disclaimer: string;
  prioritySuggestions: AssistPrioritySuggestion[];
  reassignSuggestions: AssistReassignSuggestion[];
};

export async function getTaskflowAssistSuggestionsPayload(
  teamId: number,
  opts?: GetBoardDataOptions,
): Promise<TaskflowAssistSuggestionsPayload> {
  const disclaimer =
    'Sugestões geradas por regras sobre as tarefas que vê no quadro; não utilizam LLM externo. Aplique alterações manualmente no quadro.';

  const empty: TaskflowAssistSuggestionsPayload = {
    optedIn: true,
    disclaimer,
    prioritySuggestions: [],
    reassignSuggestions: [],
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
      title: taskflowTasks.title,
      columnId: taskflowTasks.columnId,
      dueDate: taskflowTasks.dueDate,
      priority: taskflowTasks.priority,
      statusId: taskflowTasks.statusId,
      columnEnteredAt: taskflowTasks.columnEnteredAt,
      assigneeId: taskflowTasks.assigneeId,
    })
    .from(taskflowTasks)
    .where(taskWhere);

  const openTasks = taskRows.filter((t) => !terminalByStatusId.get(t.statusId));
  const taskIds = openTasks.map((t) => t.id);

  const assigneesByTask = new Map<number, number[]>();
  if (taskIds.length > 0) {
    const rows = await db
      .select({
        taskId: taskflowTaskAssignees.taskId,
        userId: taskflowTaskAssignees.userId,
      })
      .from(taskflowTaskAssignees)
      .where(inArray(taskflowTaskAssignees.taskId, taskIds));

    for (const r of rows) {
      const list = assigneesByTask.get(r.taskId) ?? [];
      list.push(r.userId);
      assigneesByTask.set(r.taskId, list);
    }
  }

  function primaryAssigneeId(t: (typeof openTasks)[0]): number | null {
    const nn = assigneesByTask.get(t.id);
    if (nn && nn.length > 0) return nn[0];
    return t.assigneeId;
  }

  const prioritySuggestions: AssistPrioritySuggestion[] = [];

  for (const t of openTasks) {
    const cur = normPriority(t.priority);
    let suggested: string | null = null;
    let reason = '';

    const dueMs = t.dueDate ? new Date(t.dueDate).getTime() : null;
    const overdueDays =
      dueMs != null && dueMs < now ? Math.ceil((now - dueMs) / (24 * 60 * 60 * 1000)) : 0;

    if (overdueDays > 0) {
      if (rankP(cur) < rankP('HIGH')) {
        suggested = overdueDays >= 7 ? bumpPriority(cur, rankP('URGENT')) : bumpPriority(cur, rankP('HIGH'));
        reason =
          overdueDays >= 7
            ? `Prazo ultrapassado há ${overdueDays} dia(s) — elevar prioridade.`
            : `Prazo ultrapassado — reforçar prioridade.`;
      } else if (rankP(cur) < rankP('URGENT') && overdueDays >= 3) {
        suggested = 'URGENT';
        reason = 'Prazo ultrapassado — considerar prioridade urgente.';
      }
    }

    if (!suggested) {
      const col = colById.get(t.columnId);
      const entered = t.columnEnteredAt ? new Date(t.columnEnteredAt).getTime() : now;
      const dwellH = Math.max(0, (now - entered) / (60 * 60 * 1000));
      const maxH = col?.maxStayHours;
      if (
        col?.phaseType === 'PRODUCTION' &&
        maxH != null &&
        Number.isFinite(maxH) &&
        maxH > 0 &&
        dwellH > maxH &&
        rankP(cur) < rankP('HIGH')
      ) {
        suggested = bumpPriority(cur, rankP('HIGH'));
        reason = `Tempo na coluna «${col.name}» acima do limite configurado — subir prioridade.`;
      }
    }

    if (suggested && suggested !== cur && prioritySuggestions.length < 24) {
      prioritySuggestions.push({
        taskId: t.id,
        title: (t.title || '').slice(0, 200),
        currentPriority: cur,
        suggestedPriority: suggested,
        reason,
      });
    }
  }

  const reassignSuggestions: AssistReassignSuggestion[] = [];
  const dash = await getTaskflowDashboardStats(teamId, opts);

  const assigneeTaskCount = new Map<number, number>();
  for (const t of openTasks) {
    const nn = assigneesByTask.get(t.id);
    const ids =
      nn && nn.length > 0 ? [...new Set(nn)] : t.assigneeId != null ? [t.assigneeId] : [];
    for (const uid of ids) {
      assigneeTaskCount.set(uid, (assigneeTaskCount.get(uid) ?? 0) + 1);
    }
  }

  if (assigneeTaskCount.size >= 2 && dash.tasksByAssignee.length >= 2) {
    const sorted = [...assigneeTaskCount.entries()].sort((a, b) => b[1] - a[1]);
    const [heavyId, heavyCount] = sorted[0];
    const [lightId, lightCount] = sorted[sorted.length - 1];
    if (
      heavyId !== lightId &&
      heavyCount >= 4 &&
      lightCount <= Math.floor(heavyCount / 2) &&
      heavyCount >= lightCount * 2
    ) {
      const userIds = [heavyId, lightId];
      const userRows = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds));
      const nameById = new Map(
        userRows.map((u) => [u.id, (u.name?.trim() || u.email || `#${u.id}`) as string]),
      );
      const heavyName = nameById.get(heavyId) ?? `#${heavyId}`;
      const lightName = nameById.get(lightId) ?? `#${lightId}`;

      const candidates = openTasks
        .filter((t) => {
          const p = primaryAssigneeId(t);
          const nn = assigneesByTask.get(t.id);
          if (nn && nn.length > 1) return false;
          return p === heavyId;
        })
        .sort((a, b) => rankP(a.priority) - rankP(b.priority))
        .slice(0, 6);

      for (const t of candidates) {
        if (reassignSuggestions.length >= 5) break;
        reassignSuggestions.push({
          taskId: t.id,
          title: (t.title || '').slice(0, 200),
          fromUserName: heavyName,
          toUserId: lightId,
          toUserName: lightName,
          reason: `Carga desequilibrada (${heavyCount} vs ${lightCount} tarefa(s) visíveis) — avaliar responsável com menos itens.`,
        });
      }
    }
  }

  return {
    optedIn: true,
    disclaimer,
    prioritySuggestions,
    reassignSuggestions,
  };
}
