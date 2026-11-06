import { randomUUID } from 'crypto';
import { and, eq, asc, desc, gte, sql, inArray, isNotNull, isNull, max } from 'drizzle-orm';
import { db } from './drizzle';
import { computeColumnSlaBreaches } from '@/lib/taskflow/column-sla';
import {
  taskflowBoards,
  taskflowColumns,
  taskflowTasks,
  taskflowLabels,
  taskflowTaskLabels,
  taskflowStatusDefinitions,
  taskflowTaskTypeDefinitions,
  taskflowTaskAssignees,
  taskflowTemplateBoardRequests,
  taskflowSprints,
  teamMembers,
} from './schema';
import type { TaskflowFixedSituation } from '@/lib/taskflow/status-definition';
import {
  advanceDueByRule,
  buildOccurrenceKey,
  coerceRecurrenceRule,
} from '@/lib/taskflow/task-recurrence';
import { NATIVE_TASK_TYPE_CODES } from '@/lib/taskflow/task-type';
import { taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';
import { isTaskflowStatusTerminal } from '@/lib/taskflow/task-terminal';
import { syncChronosMirrorForTaskflowTask } from '@/lib/chronos/taskflow-task-mirror';
import { assertValidTaskflowParentTask, assertValidTaskflowSprint } from '@/lib/db/taskflow-epic-sprint';

export type CreateTaskflowBoardInput = {
  name: string;
  description?: string | null;
};

export type CreateTaskflowTaskInput = {
  boardId: number;
  columnId: number;
  projectId?: number | null;
  title: string;
  description?: string | null;
  priority?: string;
  dueDate?: string | null;
  assigneeId?: number | null;
  /** M6.3 — vários responsáveis; se vazio, usa assigneeId como único elemento. */
  assigneeIds?: number[];
  createdById: number;
  statusId?: number | null;
  /** M6.1 — código do tipo (nativo ou definido pelo time). */
  taskType: string;
  /** M6.2 — início previsto (ISO); omitir ou null = sem previsão. */
  plannedStartAt?: string | null;
  /** M6.2 — duração estimada (horas, decimal); omitir ou null = sem estimativa. */
  estimatedDurationHours?: number | null;
  /** M6.6 — molde: regra + série; instâncias: série + occurrenceKey, regra null. */
  recurrenceRule?: string | null;
  recurrenceSeriesKey?: string | null;
  recurrenceOccurrenceKey?: string | null;
  recurrenceUntil?: string | null;
  /** E8.9 — opcional; mesmo quadro. */
  parentTaskId?: number | null;
  /** E8.9 — opcional; sprint do time. */
  sprintId?: number | null;
};

export const TASKFLOW_RECURRENCE_HORIZON_DAYS = 90;
export const TASKFLOW_RECURRENCE_MAX_INSTANCES_PER_SERIES = 48;

/** Dois pedidos em paralelo (ex.: Strict Mode) podem inserir o mesmo catálogo — Postgres 23505. */
function isPostgresUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 8 && cur && typeof cur === 'object'; i += 1) {
    const row = cur as { code?: unknown; cause?: unknown };
    if (row.code === '23505') {
      return true;
    }
    cur = row.cause;
  }
  return false;
}

const DEFAULT_STATUS_SEED: Array<{
  code: string;
  name: string;
  description: string | null;
  fixedSituation: TaskflowFixedSituation;
  color: string;
  position: number;
}> = [
  {
    code: 'open',
    name: 'Aberto',
    description: 'Tarefa em aberto',
    fixedSituation: 'OPEN',
    color: 'indigo',
    position: 1,
  },
  {
    code: 'in_progress',
    name: 'Em curso',
    description: 'Em execução',
    fixedSituation: 'IN_PROGRESS',
    color: 'amber',
    position: 2,
  },
  {
    code: 'blocked',
    name: 'Bloqueado',
    description: 'Aguardando desbloqueio',
    fixedSituation: 'BLOCKED',
    color: 'rose',
    position: 3,
  },
  {
    code: 'done',
    name: 'Concluído',
    description: 'Finalizada com sucesso',
    fixedSituation: 'DONE',
    color: 'emerald',
    position: 4,
  },
  {
    code: 'cancelled',
    name: 'Cancelado',
    description: 'Não será concluída',
    fixedSituation: 'CANCELLED',
    color: 'slate',
    position: 5,
  },
];

/**
 * Garante linhas padrão do catálogo de status (M5.1) para times criados após a migração inicial.
 */
export async function ensureDefaultStatusDefinitions(teamId: number) {
  const existing = await db
    .select({ id: taskflowStatusDefinitions.id })
    .from(taskflowStatusDefinitions)
    .where(eq(taskflowStatusDefinitions.teamId, teamId))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  const now = new Date();
  try {
    await db.insert(taskflowStatusDefinitions).values(
      DEFAULT_STATUS_SEED.map((row) => ({
        teamId,
        code: row.code,
        name: row.name,
        description: row.description,
        fixedSituation: row.fixedSituation,
        color: row.color,
        position: row.position,
        createdAt: now,
        updatedAt: now,
      })),
    );
  } catch (e) {
    if (isPostgresUniqueViolation(e)) {
      return;
    }
    throw e;
  }
}

export async function assertValidTaskType(teamId: number, raw: string): Promise<string> {
  const code = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!code) {
    throw new Error('taskType é obrigatório');
  }
  if (NATIVE_TASK_TYPE_CODES.has(code)) {
    return code;
  }
  const row = await db
    .select({ id: taskflowTaskTypeDefinitions.id })
    .from(taskflowTaskTypeDefinitions)
    .where(
      and(
        eq(taskflowTaskTypeDefinitions.teamId, teamId),
        eq(taskflowTaskTypeDefinitions.code, code),
      ),
    )
    .limit(1);
  if (!row[0]) {
    throw new Error('Tipo de tarefa inválido para este time');
  }
  return code;
}

/**
 * M6.4 — o criador da tarefa é sempre responsável (acrescenta no fim se ainda não estiver na lista).
 */
export function mergeCreatorIntoAssigneeIds(
  creatorId: number,
  assigneeIds: readonly number[],
): number[] {
  if (!Number.isFinite(creatorId) || creatorId <= 0) {
    return dedupeAssigneeIdsPreserveOrder([...assigneeIds]);
  }
  const base = dedupeAssigneeIdsPreserveOrder([...assigneeIds]);
  if (base.includes(creatorId)) {
    return base;
  }
  return [...base, creatorId];
}

/** M6.3 — IDs únicos preservando a ordem do cliente. */
export function dedupeAssigneeIdsPreserveOrder(raw: readonly unknown[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const x of raw) {
    const n = Number(x);
    if (!Number.isFinite(n) || n <= 0) {
      continue;
    }
    if (seen.has(n)) {
      continue;
    }
    seen.add(n);
    out.push(n);
  }
  return out;
}

export async function getTaskAssigneeIds(taskId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: taskflowTaskAssignees.userId })
    .from(taskflowTaskAssignees)
    .where(eq(taskflowTaskAssignees.taskId, taskId))
    .orderBy(asc(taskflowTaskAssignees.position), asc(taskflowTaskAssignees.id));
  return rows.map((r) => r.userId);
}

/** Garante que todos os IDs são membros do time; devolve a mesma lista deduplicada. */
export async function assertTaskAssigneesInTeam(
  teamId: number,
  userIds: readonly number[],
): Promise<number[]> {
  const ids = dedupeAssigneeIdsPreserveOrder([...userIds]);
  if (ids.length === 0) {
    return [];
  }
  const valid = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), inArray(teamMembers.userId, ids)));
  const allowed = new Set(valid.map((v) => v.userId));
  const filtered = ids.filter((id) => allowed.has(id));
  if (filtered.length === 0) {
    throw new Error('Nenhum responsável pertence a este time');
  }
  if (filtered.length !== ids.length) {
    throw new Error('Um ou mais responsáveis não pertencem a este time');
  }
  return filtered;
}

/** Substitui responsáveis da tarefa e mantém assignee_id = primeiro (compatível com código legado). */
export async function syncTaskAssignees(
  teamId: number,
  taskId: number,
  userIds: readonly number[],
): Promise<void> {
  const ids = dedupeAssigneeIdsPreserveOrder(userIds);
  if (ids.length === 0) {
    await db.delete(taskflowTaskAssignees).where(eq(taskflowTaskAssignees.taskId, taskId));
    await db
      .update(taskflowTasks)
      .set({ assigneeId: null, updatedAt: new Date() })
      .where(eq(taskflowTasks.id, taskId));
    return;
  }

  const filtered = await assertTaskAssigneesInTeam(teamId, ids);

  await db.delete(taskflowTaskAssignees).where(eq(taskflowTaskAssignees.taskId, taskId));
  const now = new Date();
  await db.insert(taskflowTaskAssignees).values(
    filtered.map((userId, position) => ({
      taskId,
      userId,
      position,
      createdAt: now,
    })),
  );

  await db
    .update(taskflowTasks)
    .set({ assigneeId: filtered[0], updatedAt: new Date() })
    .where(eq(taskflowTasks.id, taskId));
}

export type GetBoardDataOptions = {
  /** M6.8 — quando `self`, só tarefas em que `viewerUserId` participa. */
  listScope?: 'team' | 'self';
  viewerUserId?: number;
  /** E8.8 — quadro explícito; omitir = mais recente do time (`created_at`). */
  boardId?: number;
};

/** Verifica se a tarefa existe no board do time (RBAC / integridade / M6.8). */
export async function getTaskflowTaskForTeam(
  taskId: number,
  teamId: number,
  opts?: { listScope?: 'team' | 'self'; viewerUserId?: number },
) {
  const base = and(eq(taskflowTasks.id, taskId), eq(taskflowBoards.teamId, teamId));
  const whereClause =
    opts?.listScope === 'self' && opts.viewerUserId != null
      ? and(base, taskflowTaskInvolvesUserWhere(opts.viewerUserId))
      : base;
  const rows = await db
    .select({
      id: taskflowTasks.id,
      boardId: taskflowTasks.boardId,
      createdById: taskflowTasks.createdById,
    })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(whereClause)
    .limit(1);
  return rows[0] ?? null;
}

export async function getTaskflowStatusIdBySituation(
  teamId: number,
  situation: TaskflowFixedSituation,
): Promise<number | null> {
  await ensureDefaultStatusDefinitions(teamId);
  const row = await db
    .select({ id: taskflowStatusDefinitions.id })
    .from(taskflowStatusDefinitions)
    .where(
      and(
        eq(taskflowStatusDefinitions.teamId, teamId),
        eq(taskflowStatusDefinitions.fixedSituation, situation),
      ),
    )
    .orderBy(asc(taskflowStatusDefinitions.position))
    .limit(1);
  return row[0]?.id ?? null;
}

async function resolveStatusIdForNewTask(
  teamId: number,
  columnPhaseType: string,
  requestedStatusId?: number | null,
): Promise<number> {
  await ensureDefaultStatusDefinitions(teamId);
  if (requestedStatusId != null) {
    const row = await db
      .select({ id: taskflowStatusDefinitions.id })
      .from(taskflowStatusDefinitions)
      .where(
        and(
          eq(taskflowStatusDefinitions.id, requestedStatusId),
          eq(taskflowStatusDefinitions.teamId, teamId),
        ),
      )
      .limit(1);
    if (!row[0]) {
      throw new Error('Status inválido para este time');
    }
    return row[0].id;
  }
  const situation: TaskflowFixedSituation =
    columnPhaseType === 'FINAL' ? 'DONE' : 'OPEN';
  const id = await getTaskflowStatusIdBySituation(teamId, situation);
  if (!id) {
    throw new Error('Definição de status em falta');
  }
  return id;
}

/**
 * Garante que o time tenha ao menos um board e cria colunas padrão.
 */
export async function ensureDefaultBoard(teamId: number) {
  const existing = await db
    .select()
    .from(taskflowBoards)
    .where(eq(taskflowBoards.teamId, teamId))
    .orderBy(desc(taskflowBoards.createdAt))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const created = await db
    .insert(taskflowBoards)
    .values({
      teamId,
      name: 'Taskflow',
      description: 'Board principal de tarefas',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const board = created[0];

  await db.insert(taskflowColumns).values([
    {
      boardId: board.id,
      name: 'Planejamento',
      description: 'Fila inicial — ideias e triagem',
      position: 1,
      phaseType: 'INITIAL',
      maxStayHours: null,
      stripeColor: 'indigo',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      boardId: board.id,
      name: 'Programação',
      description: 'Tarefas planeadas e priorizadas',
      position: 2,
      phaseType: 'PRODUCTION',
      maxStayHours: null,
      stripeColor: 'cyan',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      boardId: board.id,
      name: 'Execução',
      description: 'Trabalho em curso',
      position: 3,
      phaseType: 'PRODUCTION',
      maxStayHours: null,
      stripeColor: 'amber',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      boardId: board.id,
      name: 'Concluídas',
      description: 'Entregas finalizadas',
      position: 4,
      phaseType: 'FINAL',
      maxStayHours: null,
      stripeColor: 'emerald',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      boardId: board.id,
      name: 'Canceladas',
      description: 'Itens descartados ou anulados',
      position: 5,
      phaseType: 'FINAL',
      maxStayHours: null,
      stripeColor: 'rose',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  return board;
}

export type CreateBoardFromTemplateInput = {
  sourceBoardId: number;
  name: string;
  description?: string | null;
  /** Por omissão copia etiquetas do quadro origem (só estrutura, sem tarefas). */
  copyLabels?: boolean;
  clientRequestId?: string | null;
};

function normalizeTemplateClientRequestId(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const t = raw.trim().slice(0, 80);
  return t.length ? t : null;
}

/** E8.8 — lista de quadros do time (selector / modelo). */
export async function listTaskflowBoardSummaries(teamId: number) {
  return db
    .select({
      id: taskflowBoards.id,
      name: taskflowBoards.name,
      updatedAt: taskflowBoards.updatedAt,
    })
    .from(taskflowBoards)
    .where(eq(taskflowBoards.teamId, teamId))
    .orderBy(desc(taskflowBoards.updatedAt), desc(taskflowBoards.id));
}

/**
 * E8.8 — novo quadro com as mesmas colunas (e opcionalmente etiquetas) do modelo; sem tarefas.
 * Idempotência: `clientRequestId` por time; ou mesmo nome + mesmo modelo + criação há menos de 1 minuto.
 */
export async function createBoardFromTemplate(
  teamId: number,
  input: CreateBoardFromTemplateInput,
): Promise<{ board: (typeof taskflowBoards.$inferSelect); idempotent: boolean }> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new Error('Nome do quadro é obrigatório');
  }
  const sourceBoardId = Number(input.sourceBoardId);
  if (!Number.isFinite(sourceBoardId) || sourceBoardId < 1) {
    throw new Error('Quadro modelo inválido');
  }

  const [srcBoard] = await db
    .select()
    .from(taskflowBoards)
    .where(and(eq(taskflowBoards.id, sourceBoardId), eq(taskflowBoards.teamId, teamId)))
    .limit(1);
  if (!srcBoard) {
    throw new Error('Quadro modelo não encontrado');
  }

  const clientKey = normalizeTemplateClientRequestId(input.clientRequestId ?? null);
  if (clientKey) {
    const cached = await db
      .select({ boardId: taskflowTemplateBoardRequests.boardId })
      .from(taskflowTemplateBoardRequests)
      .where(
        and(
          eq(taskflowTemplateBoardRequests.teamId, teamId),
          eq(taskflowTemplateBoardRequests.clientRequestId, clientKey),
        ),
      )
      .limit(1);
    if (cached[0]) {
      const [b] = await db
        .select()
        .from(taskflowBoards)
        .where(and(eq(taskflowBoards.id, cached[0].boardId), eq(taskflowBoards.teamId, teamId)))
        .limit(1);
      if (b) {
        return { board: b, idempotent: true };
      }
    }
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const [recentDup] = await db
    .select()
    .from(taskflowBoards)
    .where(
      and(
        eq(taskflowBoards.teamId, teamId),
        eq(taskflowBoards.name, name),
        eq(taskflowBoards.clonedFromBoardId, sourceBoardId),
        gte(taskflowBoards.createdAt, oneMinuteAgo),
      ),
    )
    .orderBy(desc(taskflowBoards.id))
    .limit(1);
  if (recentDup) {
    return { board: recentDup, idempotent: true };
  }

  await ensureDefaultStatusDefinitions(teamId);

  const copyLabels = input.copyLabels !== false;
  const description =
    typeof input.description === 'string' && input.description.trim()
      ? input.description.trim()
      : null;

  return await db.transaction(async (tx) => {
    if (clientKey) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${teamId}::integer, hashtext(${clientKey}::text)::integer)`,
      );
      const cached2 = await tx
        .select({ boardId: taskflowTemplateBoardRequests.boardId })
        .from(taskflowTemplateBoardRequests)
        .where(
          and(
            eq(taskflowTemplateBoardRequests.teamId, teamId),
            eq(taskflowTemplateBoardRequests.clientRequestId, clientKey),
          ),
        )
        .limit(1);
      if (cached2[0]) {
        const [b2] = await tx
          .select()
          .from(taskflowBoards)
          .where(and(eq(taskflowBoards.id, cached2[0].boardId), eq(taskflowBoards.teamId, teamId)))
          .limit(1);
        if (b2) {
          return { board: b2, idempotent: true };
        }
      }
    }

    const srcCols = await tx
      .select()
      .from(taskflowColumns)
      .where(eq(taskflowColumns.boardId, sourceBoardId))
      .orderBy(asc(taskflowColumns.position), asc(taskflowColumns.id));
    if (srcCols.length === 0) {
      throw new Error('Quadro modelo sem colunas');
    }

    const now = new Date();
    const [newBoard] = await tx
      .insert(taskflowBoards)
      .values({
        teamId,
        name,
        description,
        clonedFromBoardId: sourceBoardId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(taskflowColumns).values(
      srcCols.map((c) => ({
        boardId: newBoard.id,
        name: c.name,
        description: c.description,
        position: c.position,
        phaseType: c.phaseType,
        maxStayHours: c.maxStayHours,
        stripeColor: c.stripeColor,
        createdAt: now,
        updatedAt: now,
      })),
    );

    if (copyLabels) {
      const srcLabels = await tx
        .select()
        .from(taskflowLabels)
        .where(eq(taskflowLabels.boardId, sourceBoardId))
        .orderBy(asc(taskflowLabels.id));
      if (srcLabels.length > 0) {
        await tx.insert(taskflowLabels).values(
          srcLabels.map((lb) => ({
            boardId: newBoard.id,
            name: lb.name,
            color: lb.color,
            priority: lb.priority,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
    }

    if (clientKey) {
      await tx.insert(taskflowTemplateBoardRequests).values({
        teamId,
        clientRequestId: clientKey,
        boardId: newBoard.id,
        createdAt: now,
      });
    }

    return { board: newBoard, idempotent: false };
  });
}

/**
 * Cria um novo board e já prepara as colunas iniciais.
 */
export async function createBoard(teamId: number, input: CreateTaskflowBoardInput) {
  const created = await db
    .insert(taskflowBoards)
    .values({
      teamId,
      name: input.name,
      description: input.description || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const board = created[0];

  await db.insert(taskflowColumns).values([
    {
      boardId: board.id,
      name: 'Planejamento',
      description: 'Fila inicial — ideias e triagem',
      position: 1,
      phaseType: 'INITIAL',
      maxStayHours: null,
      stripeColor: 'indigo',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      boardId: board.id,
      name: 'Programação',
      description: 'Tarefas planeadas e priorizadas',
      position: 2,
      phaseType: 'PRODUCTION',
      maxStayHours: null,
      stripeColor: 'cyan',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      boardId: board.id,
      name: 'Execução',
      description: 'Trabalho em curso',
      position: 3,
      phaseType: 'PRODUCTION',
      maxStayHours: null,
      stripeColor: 'amber',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      boardId: board.id,
      name: 'Concluídas',
      description: 'Entregas finalizadas',
      position: 4,
      phaseType: 'FINAL',
      maxStayHours: null,
      stripeColor: 'emerald',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      boardId: board.id,
      name: 'Canceladas',
      description: 'Itens descartados ou anulados',
      position: 5,
      phaseType: 'FINAL',
      maxStayHours: null,
      stripeColor: 'rose',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  return board;
}

/**
 * Retorna o board com colunas, tarefas e labels.
 * @param options M6.8 — filtro por papel (`self` = só tarefas do utilizador).
 */
export async function getBoardData(teamId: number, options?: GetBoardDataOptions) {
  let boardRow: (typeof taskflowBoards.$inferSelect) | undefined;
  const requestedBoardId = options?.boardId;
  if (requestedBoardId != null && Number.isFinite(requestedBoardId) && requestedBoardId > 0) {
    const rows = await db
      .select()
      .from(taskflowBoards)
      .where(and(eq(taskflowBoards.teamId, teamId), eq(taskflowBoards.id, requestedBoardId)))
      .limit(1);
    boardRow = rows[0];
  } else {
    const board = await db
      .select()
      .from(taskflowBoards)
      .where(eq(taskflowBoards.teamId, teamId))
      .orderBy(desc(taskflowBoards.createdAt))
      .limit(1);
    boardRow = board[0];
  }

  if (!boardRow) {
    return null;
  }

  await ensureDefaultStatusDefinitions(teamId);

  const boardId = boardRow.id;

  const taskWhereParts = [eq(taskflowTasks.boardId, boardId)];
  if (options?.listScope === 'self' && options.viewerUserId != null) {
    taskWhereParts.push(taskflowTaskInvolvesUserWhere(options.viewerUserId));
  }

  const [columns, tasks, labels, statusDefinitions, taskTypeDefinitions, sprints] =
    await Promise.all([
      db
        .select()
        .from(taskflowColumns)
        .where(eq(taskflowColumns.boardId, boardId))
        .orderBy(asc(taskflowColumns.position)),
      db
        .select()
        .from(taskflowTasks)
        .where(and(...taskWhereParts))
        .orderBy(asc(taskflowTasks.position)),
      db
        .select()
        .from(taskflowLabels)
        .where(eq(taskflowLabels.boardId, boardId))
        .orderBy(asc(taskflowLabels.name)),
      db
        .select()
        .from(taskflowStatusDefinitions)
        .where(eq(taskflowStatusDefinitions.teamId, teamId))
        .orderBy(asc(taskflowStatusDefinitions.position)),
      db
        .select()
        .from(taskflowTaskTypeDefinitions)
        .where(eq(taskflowTaskTypeDefinitions.teamId, teamId))
        .orderBy(asc(taskflowTaskTypeDefinitions.position)),
      db
        .select()
        .from(taskflowSprints)
        .where(eq(taskflowSprints.teamId, teamId))
        .orderBy(desc(taskflowSprints.startAt), desc(taskflowSprints.id)),
    ]);

  const taskIds = tasks.map((t) => t.id);
  const taskLabels =
    taskIds.length === 0
      ? []
      : await db
          .select()
          .from(taskflowTaskLabels)
          .where(inArray(taskflowTaskLabels.taskId, taskIds));

  const assigneesByTask = new Map<number, number[]>();
  if (taskIds.length > 0) {
    const assigneeRows = await db
      .select({
        taskId: taskflowTaskAssignees.taskId,
        userId: taskflowTaskAssignees.userId,
        position: taskflowTaskAssignees.position,
      })
      .from(taskflowTaskAssignees)
      .where(inArray(taskflowTaskAssignees.taskId, taskIds))
      .orderBy(asc(taskflowTaskAssignees.taskId), asc(taskflowTaskAssignees.position));

    for (const row of assigneeRows) {
      const cur = assigneesByTask.get(row.taskId) ?? [];
      cur.push(row.userId);
      assigneesByTask.set(row.taskId, cur);
    }
  }

  const situationByStatusId = new Map(
    statusDefinitions.map((s) => [s.id, s.fixedSituation as string]),
  );

  const tasksWithAssignees = tasks.map((t) => {
    const fs = situationByStatusId.get(t.statusId) ?? null;
    return {
      ...t,
      assigneeIds:
        assigneesByTask.get(t.id) ?? (t.assigneeId != null ? [t.assigneeId] : []),
      statusFixedSituation: fs,
      isTerminal: isTaskflowStatusTerminal(fs),
    };
  });

  const slaBreaches = computeColumnSlaBreaches(
    tasksWithAssignees.map((t) => ({
      id: t.id,
      columnId: t.columnId,
      columnEnteredAt: t.columnEnteredAt,
    })),
    columns.map((c) => ({
      id: c.id,
      name: c.name,
      maxStayHours: c.maxStayHours,
    })),
  );

  return {
    board: boardRow,
    columns,
    tasks: tasksWithAssignees,
    labels,
    taskLabels,
    statusDefinitions,
    taskTypeDefinitions,
    sprints,
    slaBreaches,
  };
}

/**
 * M6.6 — materializa ocorrências futuras até ao horizonte, com idempotência por (série, chave).
 */
export async function materializeTaskflowRecurrences(teamId: number): Promise<{ created: number }> {
  let created = 0;
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + TASKFLOW_RECURRENCE_HORIZON_DAYS);

  const templates = await db
    .select({ template: taskflowTasks })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(
        eq(taskflowBoards.teamId, teamId),
        isNotNull(taskflowTasks.recurrenceRule),
        isNull(taskflowTasks.recurrenceOccurrenceKey),
      ),
    );

  for (const { template } of templates) {
    const rule = coerceRecurrenceRule(template.recurrenceRule);
    const seriesKey = template.recurrenceSeriesKey?.trim();
    if (!rule || !seriesKey) {
      continue;
    }

    const [aggRow] = await db
      .select({ m: max(taskflowTasks.dueDate) })
      .from(taskflowTasks)
      .where(eq(taskflowTasks.recurrenceSeriesKey, seriesKey));

    const rawMax = aggRow?.m;
    const lastDue = rawMax ? new Date(rawMax as Date | string) : null;
    if (!lastDue || Number.isNaN(lastDue.getTime())) {
      continue;
    }

    const until = template.recurrenceUntil ? new Date(template.recurrenceUntil as Date) : null;
    let next = advanceDueByRule(lastDue, rule);
    let n = 0;
    while (
      n < TASKFLOW_RECURRENCE_MAX_INSTANCES_PER_SERIES &&
      next.getTime() <= horizon.getTime()
    ) {
      if (until && !Number.isNaN(until.getTime()) && next.getTime() > until.getTime()) {
        break;
      }
      const occKey = buildOccurrenceKey(rule, next);
      const exists = await db
        .select({ id: taskflowTasks.id })
        .from(taskflowTasks)
        .where(
          and(
            eq(taskflowTasks.recurrenceSeriesKey, seriesKey),
            eq(taskflowTasks.recurrenceOccurrenceKey, occKey),
          ),
        )
        .limit(1);
      if (!exists[0]) {
        const assigneeIds = await getTaskAssigneeIds(template.id);
        const creatorId = template.createdById ?? assigneeIds[0];
        if (!creatorId) {
          break;
        }
        await createTask(teamId, {
          boardId: template.boardId,
          columnId: template.columnId,
          projectId: template.projectId,
          title: template.title,
          description: template.description,
          priority: template.priority,
          dueDate: next.toISOString(),
          assigneeIds: assigneeIds.length ? assigneeIds : [creatorId],
          createdById: creatorId,
          statusId: template.statusId,
          taskType: template.taskType,
          plannedStartAt: template.plannedStartAt
            ? new Date(template.plannedStartAt as Date).toISOString()
            : null,
          estimatedDurationHours: template.estimatedDurationHours ?? null,
          recurrenceRule: null,
          recurrenceSeriesKey: seriesKey,
          recurrenceOccurrenceKey: occKey,
          recurrenceUntil: null,
        });
        created += 1;
      }
      next = advanceDueByRule(next, rule);
      n += 1;
    }
  }

  return { created };
}

/** Gera `recurrence_series_key` para uma nova série (molde). */
export function newRecurrenceSeriesKey(): string {
  return randomUUID();
}

/**
 * Cria uma nova tarefa dentro do board e da coluna informados.
 */
export async function createTask(teamId: number, input: CreateTaskflowTaskInput) {
  const board = await db
    .select()
    .from(taskflowBoards)
    .where(and(eq(taskflowBoards.id, input.boardId), eq(taskflowBoards.teamId, teamId)))
    .limit(1);

  if (board.length === 0) {
    throw new Error('Board não encontrado');
  }

  const column = await db
    .select()
    .from(taskflowColumns)
    .where(and(eq(taskflowColumns.id, input.columnId), eq(taskflowColumns.boardId, input.boardId)))
    .limit(1);

  if (column.length === 0) {
    throw new Error('Coluna não encontrada');
  }

  const statusId = await resolveStatusIdForNewTask(
    teamId,
    column[0].phaseType || 'PRODUCTION',
    input.statusId,
  );

  const taskType = await assertValidTaskType(teamId, input.taskType);

  await assertValidTaskflowParentTask(teamId, input.boardId, null, input.parentTaskId ?? null);
  await assertValidTaskflowSprint(teamId, input.sprintId ?? null);

  const seriesTrim = input.recurrenceSeriesKey?.trim() || null;
  const occTrim = input.recurrenceOccurrenceKey?.trim() || null;
  const ruleTrim = input.recurrenceRule?.trim() || null;
  if (occTrim && !seriesTrim) {
    throw new Error('recurrenceSeriesKey é obrigatório para instância recorrente');
  }
  if (ruleTrim && !seriesTrim) {
    throw new Error('recurrenceSeriesKey é obrigatório com recurrenceRule');
  }
  if (occTrim && ruleTrim) {
    throw new Error('Instância recorrente não pode ter recurrenceRule');
  }

  const [positionRow] = await db
    .select({
      max: sql<number>`max(${taskflowTasks.position})`,
    })
    .from(taskflowTasks)
    .where(eq(taskflowTasks.columnId, input.columnId));

  const nextPosition = (positionRow?.max ?? -1) + 1;

  const rawAssigneeIds =
    input.assigneeIds && input.assigneeIds.length > 0
      ? dedupeAssigneeIdsPreserveOrder(input.assigneeIds)
      : input.assigneeId != null
        ? [input.assigneeId]
        : [];
  const assigneeIdsResolved = mergeCreatorIntoAssigneeIds(input.createdById, rawAssigneeIds);

  const now = new Date();
  const created = await db
    .insert(taskflowTasks)
    .values({
      boardId: input.boardId,
      columnId: input.columnId,
      projectId: input.projectId || null,
      title: input.title,
      description: input.description || null,
      taskType,
      priority: input.priority || 'MEDIUM',
      statusId,
      position: nextPosition,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : null,
      estimatedDurationHours:
        input.estimatedDurationHours != null &&
        Number.isFinite(input.estimatedDurationHours)
          ? input.estimatedDurationHours
          : null,
      assigneeId: assigneeIdsResolved[0] ?? null,
      createdById: input.createdById,
      columnEnteredAt: now,
      createdAt: now,
      updatedAt: now,
      recurrenceRule: ruleTrim || null,
      recurrenceSeriesKey: seriesTrim,
      recurrenceOccurrenceKey: occTrim,
      recurrenceUntil: input.recurrenceUntil ? new Date(input.recurrenceUntil) : null,
      parentTaskId: input.parentTaskId ?? null,
      sprintId: input.sprintId ?? null,
    })
    .returning();

  const taskRow = created[0];
  await syncTaskAssignees(teamId, taskRow.id, assigneeIdsResolved);

  try {
    await syncChronosMirrorForTaskflowTask({
      teamId,
      taskId: taskRow.id,
      title: taskRow.title,
      dueDate: taskRow.dueDate,
    });
  } catch {
    // M6.9 — não falhar criação de tarefa se o espelho Chronos falhar.
  }

  return taskRow;
}

/**
 * Associa labels existentes à tarefa.
 */
export async function attachLabelsToTask(taskId: number, labelIds: number[]) {
  if (labelIds.length === 0) {
    return [];
  }

  const values = labelIds.map((labelId) => ({
    taskId,
    labelId,
    createdAt: new Date(),
  }));

  return db.insert(taskflowTaskLabels).values(values).returning();
}
