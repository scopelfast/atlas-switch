import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, ne } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { sendTaskflowNotification } from '@/lib/email/mailer';
import {
  ActivityType,
  activityLogs,
  taskflowBoards,
  taskflowInterventions,
  taskflowStatusDefinitions,
  taskflowTasks,
  teamMembers,
  users,
} from '@/lib/db/schema';
import { getTaskflowTaskForTeam } from '@/lib/db/taskflow';
import { isTaskflowStatusTerminal } from '@/lib/taskflow/task-terminal';
import {
  InterventionBusinessError,
  InterventionErrorCode,
} from '@/lib/taskflow/intervention-errors';
import { taskflowListScopeForRole, taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';

type DbExecutor = Pick<typeof db, 'select' | 'update'>;

/** M7.4 — actualiza `taskflow_tasks.status_id` a partir da intervenção; estados terminais são rejeitados. */
async function applyInterventionTaskStatusSync(
  tx: DbExecutor,
  params: {
    teamId: number;
    taskId: number;
    role: string | null | undefined;
    viewerUserId: number;
    syncTaskStatusId: number;
  },
): Promise<void> {
  const { teamId, taskId, role, viewerUserId, syncTaskStatusId } = params;
  const listScope = taskflowListScopeForRole(role);
  const base = and(eq(taskflowTasks.id, taskId), eq(taskflowBoards.teamId, teamId));
  const whereClause =
    listScope === 'self' && viewerUserId != null
      ? and(base, taskflowTaskInvolvesUserWhere(viewerUserId))
      : base;
  const taskRows = await tx
    .select({ id: taskflowTasks.id })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(whereClause)
    .limit(1);
  if (!taskRows[0]) {
    throw new Error('Tarefa não encontrada ou sem permissão para sincronizar estado');
  }

  const [def] = await tx
    .select({
      id: taskflowStatusDefinitions.id,
      fixedSituation: taskflowStatusDefinitions.fixedSituation,
    })
    .from(taskflowStatusDefinitions)
    .where(
      and(
        eq(taskflowStatusDefinitions.id, syncTaskStatusId),
        eq(taskflowStatusDefinitions.teamId, teamId),
      ),
    )
    .limit(1);

  if (!def) {
    throw new Error('Estado do quadro inválido para este time');
  }
  if (isTaskflowStatusTerminal(def.fixedSituation)) {
    throw new Error(
      'Não é possível definir estado concluído ou cancelado a partir da intervenção; use o quadro.',
    );
  }

  const now = new Date();
  const [upd] = await tx
    .update(taskflowTasks)
    .set({ statusId: syncTaskStatusId, updatedAt: now })
    .where(eq(taskflowTasks.id, taskId))
    .returning({ id: taskflowTasks.id });
  if (!upd) {
    throw new Error('Falha ao actualizar o estado da tarefa');
  }
}

export type TaskflowInterventionRow = typeof taskflowInterventions.$inferSelect;

export const INTERVENTION_SOURCE_TIMER = 'TIMER' as const;
export const INTERVENTION_SOURCE_MANUAL = 'MANUAL' as const;

const MAX_MANUAL_INTERVENTION_SPAN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Impede que o mesmo operador tenha dois apontamentos com intervalos de tempo sobrepostos
 * (manual ou timer já encerrado; ou intervalo manual a coincidir com um timer em curso).
 */
export async function assertInterventionIntervalNoOverlapForUser(params: {
  teamId: number;
  userId: number;
  startedAt: Date;
  endedAt: Date;
  excludeInterventionId?: number | null;
}): Promise<void> {
  const { teamId, userId, startedAt, endedAt, excludeInterventionId } = params;
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    throw new Error('Datas inválidas');
  }
  if (endedAt.getTime() <= startedAt.getTime()) {
    throw new Error('O fim deve ser posterior ao início');
  }

  const open = await getOpenInterventionForUser(teamId, userId);
  if (open) {
    const t0 = new Date(open.startedAt).getTime();
    const nowMs = Date.now();
    if (startedAt.getTime() < nowMs && endedAt.getTime() > t0) {
      throw new InterventionBusinessError(
        InterventionErrorCode.OVERLAP_TIMER,
        'Este intervalo sobrepõe-se a um timer em curso. Encerre o timer primeiro ou escolha horas fora da sessão aberta.',
      );
    }
  }

  const overlapConds = [
    eq(taskflowInterventions.teamId, teamId),
    eq(taskflowInterventions.userId, userId),
    isNotNull(taskflowInterventions.endedAt),
    lt(taskflowInterventions.startedAt, endedAt),
    gt(taskflowInterventions.endedAt, startedAt),
  ];
  if (excludeInterventionId != null && Number.isFinite(excludeInterventionId)) {
    overlapConds.push(ne(taskflowInterventions.id, Math.trunc(Number(excludeInterventionId))));
  }

  const [hit] = await db
    .select({ id: taskflowInterventions.id })
    .from(taskflowInterventions)
    .where(and(...overlapConds))
    .limit(1);

  if (hit) {
    throw new InterventionBusinessError(
      InterventionErrorCode.OVERLAP_CLOSED,
      'Já existe um apontamento seu (manual ou timer encerrado) em parte deste horário. Ajuste as datas ou corrija o registo existente.',
    );
  }
}

export async function getInterventionRowForTeam(
  teamId: number,
  interventionId: number,
): Promise<TaskflowInterventionRow | null> {
  const [r] = await db
    .select()
    .from(taskflowInterventions)
    .where(
      and(eq(taskflowInterventions.id, interventionId), eq(taskflowInterventions.teamId, teamId)),
    )
    .limit(1);
  return r ?? null;
}

export type InterventionHistoryListRow = {
  id: number;
  taskId: number;
  taskTitle: string;
  startedAt: string;
  endedAt: string | null;
  source: string;
  reportedStatus: string | null;
  details: string | null;
  userId: number;
  userName: string | null;
};

export async function listInterventionHistory(params: {
  teamId: number;
  viewerUserId: number;
  listAllTeam: boolean;
  limit: number;
}): Promise<InterventionHistoryListRow[]> {
  const { teamId, viewerUserId, listAllTeam, limit } = params;
  const lim = Math.min(Math.max(limit, 1), 80);

  const filters = [
    eq(taskflowBoards.teamId, teamId),
    ...(listAllTeam ? [] : [eq(taskflowInterventions.userId, viewerUserId)]),
  ];

  const rows = await db
    .select({
      id: taskflowInterventions.id,
      taskId: taskflowInterventions.taskId,
      taskTitle: taskflowTasks.title,
      startedAt: taskflowInterventions.startedAt,
      endedAt: taskflowInterventions.endedAt,
      source: taskflowInterventions.source,
      reportedStatus: taskflowInterventions.reportedStatus,
      details: taskflowInterventions.details,
      userId: taskflowInterventions.userId,
      userName: users.name,
    })
    .from(taskflowInterventions)
    .innerJoin(taskflowTasks, eq(taskflowInterventions.taskId, taskflowTasks.id))
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .innerJoin(users, eq(taskflowInterventions.userId, users.id))
    .where(and(...filters))
    .orderBy(desc(taskflowInterventions.startedAt))
    .limit(lim);

  return rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    taskTitle: r.taskTitle,
    startedAt:
      r.startedAt instanceof Date ? r.startedAt.toISOString() : String(r.startedAt),
    endedAt: r.endedAt
      ? r.endedAt instanceof Date
        ? r.endedAt.toISOString()
        : String(r.endedAt)
      : null,
    source: r.source,
    reportedStatus: r.reportedStatus,
    details: r.details,
    userId: r.userId,
    userName: r.userName,
  }));
}

export async function updateInterventionById(params: {
  teamId: number;
  interventionId: number;
  startedAt?: Date;
  endedAt?: Date;
  reportedStatus?: string;
  details?: string | null;
}): Promise<TaskflowInterventionRow> {
  const { teamId, interventionId } = params;
  const row = await getInterventionRowForTeam(teamId, interventionId);
  if (!row) {
    throw new Error('Intervenção não encontrada');
  }
  if (row.endedAt == null) {
    throw new Error(
      'Não é possível editar uma sessão de timer ainda aberta por aqui; use «Encerrar intervenção» no painel do timer.',
    );
  }

  const curStart = row.startedAt instanceof Date ? row.startedAt : new Date(row.startedAt);
  const curEnd = row.endedAt instanceof Date ? row.endedAt : new Date(row.endedAt);
  const nextStart = params.startedAt ?? curStart;
  const nextEnd = params.endedAt ?? curEnd;

  if (nextEnd.getTime() <= nextStart.getTime()) {
    throw new Error('O fim deve ser posterior ao início');
  }
  if (nextEnd.getTime() - nextStart.getTime() > MAX_MANUAL_INTERVENTION_SPAN_MS) {
    throw new Error('O período não pode exceder 14 dias');
  }

  await assertInterventionIntervalNoOverlapForUser({
    teamId,
    userId: row.userId,
    startedAt: nextStart,
    endedAt: nextEnd,
    excludeInterventionId: interventionId,
  });

  const nextReported =
    params.reportedStatus !== undefined
      ? params.reportedStatus.trim()
      : String(row.reportedStatus ?? '').trim();
  if (!nextReported) {
    throw new Error('O campo de status / descrição do trabalho não pode ficar vazio');
  }

  const nextDetails =
    params.details !== undefined ? (params.details?.trim() || null) : row.details;

  const now = new Date();
  const [upd] = await db
    .update(taskflowInterventions)
    .set({
      startedAt: nextStart,
      endedAt: nextEnd,
      reportedStatus: nextReported,
      details: nextDetails,
      updatedAt: now,
    })
    .where(
      and(eq(taskflowInterventions.id, interventionId), eq(taskflowInterventions.teamId, teamId)),
    )
    .returning();

  if (!upd) {
    throw new Error('Falha ao actualizar intervenção');
  }
  return upd;
}

export async function deleteInterventionById(
  teamId: number,
  interventionId: number,
): Promise<void> {
  const row = await getInterventionRowForTeam(teamId, interventionId);
  if (!row) {
    throw new Error('Intervenção não encontrada');
  }
  if (row.endedAt == null) {
    throw new Error(
      'Não é possível apagar uma sessão de timer ainda aberta; encerre o timer antes.',
    );
  }

  await db
    .delete(taskflowInterventions)
    .where(
      and(eq(taskflowInterventions.id, interventionId), eq(taskflowInterventions.teamId, teamId)),
    );
}

/** M7.3 — intervalo entre pings de presença (variante «Sim» = próximo ping daqui a 2h). */
export const TIMER_IDLE_PING_INTERVAL_MS = 2 * 60 * 60 * 1000;
/** M7.3 — tempo para responder Sim/Não após o ping ficar visível. */
export const TIMER_IDLE_RESPONSE_MS = 15 * 60 * 1000;

export type ActiveTimerInterventionDto = {
  id: number;
  taskId: number;
  startedAt: string;
  taskTitle: string;
  /** Quando true, mostrar diálogo Sim/Não até `idleResponseDeadlineAt`. */
  idlePromptOpen: boolean;
  idleResponseDeadlineAt: string | null;
};

async function selectOpenTimerInterventionRow(teamId: number, userId: number) {
  const rows = await db
    .select({
      id: taskflowInterventions.id,
      taskId: taskflowInterventions.taskId,
      startedAt: taskflowInterventions.startedAt,
      nextIdlePingAt: taskflowInterventions.nextIdlePingAt,
      idleResponseDeadlineAt: taskflowInterventions.idleResponseDeadlineAt,
      taskTitle: taskflowTasks.title,
    })
    .from(taskflowInterventions)
    .innerJoin(taskflowTasks, eq(taskflowInterventions.taskId, taskflowTasks.id))
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(
        eq(taskflowBoards.teamId, teamId),
        eq(taskflowInterventions.userId, userId),
        isNull(taskflowInterventions.endedAt),
        eq(taskflowInterventions.source, INTERVENTION_SOURCE_TIMER),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

function effectiveNextIdlePingAt(row: {
  startedAt: Date;
  nextIdlePingAt: Date | null;
}): Date {
  if (row.nextIdlePingAt) {
    return new Date(row.nextIdlePingAt);
  }
  return new Date(new Date(row.startedAt).getTime() + TIMER_IDLE_PING_INTERVAL_MS);
}

async function notifyGestoresTimerIdlePause(params: {
  teamId: number;
  operatorUserId: number;
  operatorName: string | null;
  taskTitle: string;
}) {
  const { teamId, operatorUserId, operatorName, taskTitle } = params;
  const recipients = await db
    .select({ email: users.email })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        inArray(teamMembers.role, ['owner', 'admin', 'gestor']),
        ne(teamMembers.userId, operatorUserId),
        isNull(users.deletedAt),
      ),
    );
  const op = operatorName?.trim() || 'Operador';
  for (const r of recipients) {
    if (!r.email) continue;
    await sendTaskflowNotification({
      to: r.email,
      taskTitle,
      taskId: 0,
      type: 'intervention_idle',
      creatorName: op,
    });
  }
}

async function finalizeTimerIdleAutoStop(params: {
  teamId: number;
  userId: number;
  interventionId: number;
  taskTitle: string;
  operatorName: string | null;
}): Promise<boolean> {
  const { teamId, userId, interventionId, taskTitle, operatorName } = params;
  const now = new Date();
  const [updated] = await db
    .update(taskflowInterventions)
    .set({
      endedAt: now,
      reportedStatus: 'Pausa automática (inatividade no timer)',
      details: 'Sem resposta ao ping de presença no prazo de 15 minutos.',
      nextIdlePingAt: null,
      idleResponseDeadlineAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(taskflowInterventions.id, interventionId),
        eq(taskflowInterventions.teamId, teamId),
        eq(taskflowInterventions.userId, userId),
        isNull(taskflowInterventions.endedAt),
        eq(taskflowInterventions.source, INTERVENTION_SOURCE_TIMER),
      ),
    )
    .returning({ id: taskflowInterventions.id });

  if (!updated) {
    return false;
  }

  await db.insert(activityLogs).values({
    teamId,
    userId,
    action: ActivityType.TASKFLOW_INTERVENTION_IDLE_AUTO,
    timestamp: now,
  });

  await notifyGestoresTimerIdlePause({
    teamId,
    operatorUserId: userId,
    operatorName,
    taskTitle,
  });

  return true;
}

/**
 * M7.3 — consulta intervenção timer aberta, abre janela de 15 min quando aplicável,
 * encerra automaticamente se o prazo expirar, e devolve payload para a UI.
 */
export async function processTimerIdleAndGetActiveForUser(
  teamId: number,
  userId: number,
): Promise<{ active: ActiveTimerInterventionDto | null }> {
  let row = await selectOpenTimerInterventionRow(teamId, userId);
  if (!row) {
    return { active: null };
  }

  const nowMs = Date.now();

  const effPing = effectiveNextIdlePingAt(row);
  if (!row.idleResponseDeadlineAt && nowMs >= effPing.getTime()) {
    const deadline = new Date(nowMs + TIMER_IDLE_RESPONSE_MS);
    await db
      .update(taskflowInterventions)
      .set({ idleResponseDeadlineAt: deadline, updatedAt: new Date() })
      .where(
        and(
          eq(taskflowInterventions.id, row.id),
          isNull(taskflowInterventions.endedAt),
          isNull(taskflowInterventions.idleResponseDeadlineAt),
        ),
      );
    row = await selectOpenTimerInterventionRow(teamId, userId);
    if (!row) {
      return { active: null };
    }
  }

  const deadlineAt = row.idleResponseDeadlineAt ? new Date(row.idleResponseDeadlineAt) : null;
  if (deadlineAt && nowMs >= deadlineAt.getTime()) {
    const [op] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    await finalizeTimerIdleAutoStop({
      teamId,
      userId,
      interventionId: row.id,
      taskTitle: row.taskTitle,
      operatorName: op?.name ?? null,
    });
    return { active: null };
  }

  const idlePromptOpen = row.idleResponseDeadlineAt != null;
  return {
    active: {
      id: row.id,
      taskId: row.taskId,
      startedAt: new Date(row.startedAt).toISOString(),
      taskTitle: row.taskTitle,
      idlePromptOpen,
      idleResponseDeadlineAt: row.idleResponseDeadlineAt
        ? new Date(row.idleResponseDeadlineAt).toISOString()
        : null,
    },
  };
}

export async function ackTimerInterventionIdle(params: {
  teamId: number;
  userId: number;
  interventionId: number;
  response: 'yes' | 'no';
  role: string | null | undefined;
}): Promise<TaskflowInterventionRow> {
  const { teamId, userId, interventionId, response, role } = params;
  const now = new Date();

  if (response === 'yes') {
    const nextPing = new Date(now.getTime() + TIMER_IDLE_PING_INTERVAL_MS);
    const [upd] = await db
      .update(taskflowInterventions)
      .set({
        nextIdlePingAt: nextPing,
        idleResponseDeadlineAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(taskflowInterventions.id, interventionId),
          eq(taskflowInterventions.teamId, teamId),
          eq(taskflowInterventions.userId, userId),
          isNull(taskflowInterventions.endedAt),
          eq(taskflowInterventions.source, INTERVENTION_SOURCE_TIMER),
        ),
      )
      .returning();
    if (!upd) {
      throw new Error('Intervenção não encontrada');
    }
    return upd;
  }

  return await stopIntervention({
    teamId,
    userId,
    interventionId,
    reportedStatus: 'Operador respondeu «Não» ao ping de inatividade',
    details: 'Intervenção encerrada pelo operador no ping de presença.',
    role,
    syncTaskStatusId: null,
  });
}

export async function getOpenInterventionForUser(teamId: number, userId: number) {
  const rows = await db
    .select({
      id: taskflowInterventions.id,
      taskId: taskflowInterventions.taskId,
      startedAt: taskflowInterventions.startedAt,
      taskTitle: taskflowTasks.title,
    })
    .from(taskflowInterventions)
    .innerJoin(taskflowTasks, eq(taskflowInterventions.taskId, taskflowTasks.id))
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(
        eq(taskflowBoards.teamId, teamId),
        eq(taskflowInterventions.userId, userId),
        isNull(taskflowInterventions.endedAt),
        eq(taskflowInterventions.source, INTERVENTION_SOURCE_TIMER),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function assertTaskAllowsIntervention(
  teamId: number,
  taskId: number,
  role: string | null | undefined,
  viewerUserId: number,
): Promise<void> {
  const listScope = taskflowListScopeForRole(role);
  const task = await getTaskflowTaskForTeam(taskId, teamId, {
    listScope,
    viewerUserId,
  });
  if (!task) {
    throw new Error('Tarefa não encontrada ou sem permissão');
  }

  const [st] = await db
    .select({ fixedSituation: taskflowStatusDefinitions.fixedSituation })
    .from(taskflowTasks)
    .innerJoin(
      taskflowStatusDefinitions,
      eq(taskflowTasks.statusId, taskflowStatusDefinitions.id),
    )
    .where(and(eq(taskflowTasks.id, taskId), eq(taskflowStatusDefinitions.teamId, teamId)))
    .limit(1);

  const fs = st?.fixedSituation ?? null;
  if (isTaskflowStatusTerminal(fs)) {
    throw new Error('Não é possível iniciar intervenção numa tarefa encerrada');
  }
}

export async function startIntervention(params: {
  teamId: number;
  userId: number;
  taskId: number;
  role: string | null | undefined;
}): Promise<TaskflowInterventionRow> {
  const { teamId, userId, taskId, role } = params;

  const open = await getOpenInterventionForUser(teamId, userId);
  if (open) {
    throw new Error('Já existe uma intervenção em curso. Encerre-a antes de iniciar outra.');
  }

  await assertTaskAllowsIntervention(teamId, taskId, role, userId);

  const now = new Date();
  const [inserted] = await db
    .insert(taskflowInterventions)
    .values({
      teamId,
      taskId,
      userId,
      startedAt: now,
      endedAt: null,
      reportedStatus: null,
      details: null,
      source: INTERVENTION_SOURCE_TIMER,
      nextIdlePingAt: new Date(now.getTime() + TIMER_IDLE_PING_INTERVAL_MS),
      idleResponseDeadlineAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error('Falha ao criar intervenção');
  }
  return inserted;
}

export async function stopIntervention(params: {
  teamId: number;
  userId: number;
  interventionId: number;
  reportedStatus: string;
  details: string | null;
  role: string | null | undefined;
  syncTaskStatusId?: number | null;
}): Promise<TaskflowInterventionRow> {
  const { teamId, userId, interventionId, reportedStatus, details, role, syncTaskStatusId } = params;
  const statusTrim = reportedStatus.trim();
  if (!statusTrim) {
    throw new Error('Indique o status ao encerrar a intervenção');
  }

  const syncId =
    syncTaskStatusId != null &&
    Number.isFinite(syncTaskStatusId) &&
    syncTaskStatusId > 0
      ? Math.trunc(Number(syncTaskStatusId))
      : null;

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(taskflowInterventions)
      .where(
        and(
          eq(taskflowInterventions.id, interventionId),
          eq(taskflowInterventions.teamId, teamId),
          eq(taskflowInterventions.userId, userId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new Error('Intervenção não encontrada');
    }
    if (row.source === INTERVENTION_SOURCE_MANUAL) {
      throw new Error('Intervenções manuais não são encerradas por este fluxo');
    }
    if (row.endedAt != null) {
      throw new Error('Esta intervenção já foi encerrada');
    }

    const now = new Date();
    const [updated] = await tx
      .update(taskflowInterventions)
      .set({
        endedAt: now,
        reportedStatus: statusTrim,
        details: details?.trim() || null,
        nextIdlePingAt: null,
        idleResponseDeadlineAt: null,
        updatedAt: now,
      })
      .where(eq(taskflowInterventions.id, interventionId))
      .returning();

    if (!updated) {
      throw new Error('Falha ao encerrar intervenção');
    }

    if (syncId != null) {
      await applyInterventionTaskStatusSync(tx, {
        teamId,
        taskId: row.taskId,
        role,
        viewerUserId: userId,
        syncTaskStatusId: syncId,
      });
    }

    return updated;
  });
}

export async function createManualIntervention(params: {
  teamId: number;
  userId: number;
  taskId: number;
  role: string | null | undefined;
  startedAt: Date;
  endedAt: Date;
  reportedStatus: string;
  details: string | null;
  syncTaskStatusId?: number | null;
}): Promise<TaskflowInterventionRow> {
  const { teamId, userId, taskId, role, startedAt, endedAt, reportedStatus, details, syncTaskStatusId } =
    params;
  const statusTrim = reportedStatus.trim();
  if (!statusTrim) {
    throw new Error('Indique o status da intervenção manual');
  }
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    throw new Error('Datas inválidas');
  }
  if (endedAt.getTime() <= startedAt.getTime()) {
    throw new Error('O fim deve ser posterior ao início');
  }
  if (endedAt.getTime() - startedAt.getTime() > MAX_MANUAL_INTERVENTION_SPAN_MS) {
    throw new Error('O período não pode exceder 14 dias');
  }

  await assertInterventionIntervalNoOverlapForUser({
    teamId,
    userId,
    startedAt,
    endedAt,
    excludeInterventionId: null,
  });

  await assertTaskAllowsIntervention(teamId, taskId, role, userId);

  const syncId =
    syncTaskStatusId != null &&
    Number.isFinite(syncTaskStatusId) &&
    syncTaskStatusId > 0
      ? Math.trunc(Number(syncTaskStatusId))
      : null;

  return await db.transaction(async (tx) => {
    const now = new Date();
    const [inserted] = await tx
      .insert(taskflowInterventions)
      .values({
        teamId,
        taskId,
        userId,
        startedAt,
        endedAt,
        reportedStatus: statusTrim,
        details: details?.trim() || null,
        source: INTERVENTION_SOURCE_MANUAL,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!inserted) {
      throw new Error('Falha ao registar intervenção manual');
    }

    if (syncId != null) {
      await applyInterventionTaskStatusSync(tx, {
        teamId,
        taskId,
        role,
        viewerUserId: userId,
        syncTaskStatusId: syncId,
      });
    }

    return inserted;
  });
}
