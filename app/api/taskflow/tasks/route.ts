import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { isOwnerLike } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import {
  assertTaskAssigneesInTeam,
  assertValidTaskType,
  createTask,
  dedupeAssigneeIdsPreserveOrder,
  getTaskAssigneeIds,
  getTaskflowStatusIdBySituation,
  mergeCreatorIntoAssigneeIds,
  newRecurrenceSeriesKey,
  syncTaskAssignees,
} from '@/lib/db/taskflow';
import { assertValidTaskflowParentTask, assertValidTaskflowSprint } from '@/lib/db/taskflow-epic-sprint';
import { db } from '@/lib/db/drizzle';
import {
  activityLogs,
  projectusProjects,
  taskflowAdvancedRules,
  taskflowAutomationRules,
  taskflowBoards,
  taskflowColumns,
  taskflowTaskEvents,
  taskflowTasks,
  taskflowStatusDefinitions,
  users,
} from '@/lib/db/schema';
import { ActivityType } from '@/lib/db/schema';
import { sendTaskflowNotification } from '@/lib/email/mailer';
import {
  formatDateTimePtShort,
  parseEstimatedDurationHours,
  parsePlannedStartIso,
} from '@/lib/taskflow/task-schedule';
import { parseRecurrenceRule } from '@/lib/taskflow/task-recurrence';
import { taskflowBoardOptionsForUser, taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';
import { syncChronosMirrorForTaskflowTask } from '@/lib/chronos/taskflow-task-mirror';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  buildTaskWebhookPayload,
  dispatchTaskflowWebhooksFireAndForget,
} from '@/lib/taskflow/webhook-outbound';
import { isTaskflowStatusTerminal } from '@/lib/taskflow/task-terminal';

/**
 * Cria uma tarefa no board Taskflow do time.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();

  const boardId = Number(body?.boardId);
  const columnId = Number(body?.columnId);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const projectId = body?.projectId ? Number(body.projectId) : null;

  if (!boardId || !columnId || !title) {
    return NextResponse.json(
      { error: 'boardId, columnId e title são obrigatórios' },
      { status: 400 },
    );
  }

  const taskTypeRaw = body?.taskType;
  if (typeof taskTypeRaw !== 'string' || !taskTypeRaw.trim()) {
    return NextResponse.json({ error: 'taskType é obrigatório' }, { status: 400 });
  }

  try {
    const taskType = await assertValidTaskType(team.id, taskTypeRaw);
    const [rules] = await db
      .select()
      .from(taskflowAutomationRules)
      .where(eq(taskflowAutomationRules.teamId, team.id))
      .limit(1);

    const dueDate = typeof body?.dueDate === 'string' ? body.dueDate : null;
    let priority =
      typeof body?.priority === 'string' ? body.priority : 'MEDIUM';
    let assigneeIdsList: number[] = [];
    if (Array.isArray(body?.assigneeIds)) {
      assigneeIdsList = dedupeAssigneeIdsPreserveOrder(body.assigneeIds as unknown[]);
    } else if (body?.assigneeId) {
      assigneeIdsList = [Number(body.assigneeId)];
    }

    if (!dueDate) {
      return NextResponse.json(
        { error: 'dueDate é obrigatório' },
        { status: 400 },
      );
    }
    if (Number.isNaN(new Date(dueDate).getTime())) {
      return NextResponse.json({ error: 'dueDate inválido' }, { status: 400 });
    }

    if (rules?.autoAssignCreator && assigneeIdsList.length === 0) {
      assigneeIdsList = [user.id];
    }

    if (rules?.autoHighPriorityOnDue && dueDate) {
      const due = new Date(dueDate);
      const diff = due.getTime() - new Date().getTime();
      const twoDays = 1000 * 60 * 60 * 24 * 2;
      if (diff <= twoDays) {
        priority = 'HIGH';
      }
    }

    const advancedRules = await db
      .select()
      .from(taskflowAdvancedRules)
      .where(eq(taskflowAdvancedRules.teamId, team.id));

    if (advancedRules.length > 0) {
      advancedRules
        .filter((rule) => rule.enabled)
        .forEach((rule) => {
          const dueOk =
            rule.dueInDays === null ||
            (dueDate
              ? new Date(dueDate).getTime() - new Date().getTime() <=
                rule.dueInDays * 24 * 60 * 60 * 1000
              : false);
          const priorityOk =
            !rule.priorityEquals || rule.priorityEquals === priority;
          const assigneeHead = assigneeIdsList[0] ?? null;
          const assigneeOk =
            !rule.assigneeMissing || (rule.assigneeMissing && assigneeHead == null);

          if (dueOk && priorityOk && assigneeOk) {
            if (rule.actionSetPriority) {
              priority = rule.actionSetPriority;
            }
            if (rule.actionAssignCreator && assigneeIdsList.length === 0) {
              assigneeIdsList = [user.id];
            }
          }
        });
    }

    assigneeIdsList = mergeCreatorIntoAssigneeIds(user.id, assigneeIdsList);

    if (assigneeIdsList.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível determinar responsáveis.' },
        { status: 400 },
      );
    }

    if (projectId) {
      const project = await db
        .select({ id: projectusProjects.id })
        .from(projectusProjects)
        .where(
          and(
            eq(projectusProjects.id, projectId),
            eq(projectusProjects.teamId, team.id),
          ),
        )
        .limit(1);
      if (!project[0]) {
        return NextResponse.json({ error: 'Projeto inválido' }, { status: 400 });
      }
    }

    const plannedParsed = parsePlannedStartIso(body?.plannedStartAt);
    if (!plannedParsed.ok) {
      return NextResponse.json({ error: plannedParsed.error }, { status: 400 });
    }
    const estParsed = parseEstimatedDurationHours(body?.estimatedDurationHours);
    if (!estParsed.ok) {
      return NextResponse.json({ error: estParsed.error }, { status: 400 });
    }

    const statusIdBody =
      body?.statusId !== undefined && body?.statusId !== null && body?.statusId !== ''
        ? Number(body.statusId)
        : null;

    let parentTaskIdPost: number | null = null;
    if (body?.parentTaskId !== undefined && body?.parentTaskId !== null && body?.parentTaskId !== '') {
      const p = Number(body.parentTaskId);
      if (!Number.isFinite(p) || p < 1) {
        return NextResponse.json({ error: 'parentTaskId inválido' }, { status: 400 });
      }
      parentTaskIdPost = p;
    }
    let sprintIdPost: number | null = null;
    if (body?.sprintId !== undefined && body?.sprintId !== null && body?.sprintId !== '') {
      const s = Number(body.sprintId);
      if (!Number.isFinite(s) || s < 1) {
        return NextResponse.json({ error: 'sprintId inválido' }, { status: 400 });
      }
      sprintIdPost = s;
    }

    try {
      await assertTaskAssigneesInTeam(team.id, assigneeIdsList);
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || 'Responsáveis inválidos' },
        { status: 400 },
      );
    }

    let recurrenceRule: string | null = null;
    let recurrenceSeriesKey: string | null = null;
    let recurrenceUntilIso: string | null = null;
    const rawRec = body?.recurrenceRule;
    if (rawRec !== undefined && rawRec !== null && String(rawRec).trim()) {
      try {
        const parsed = parseRecurrenceRule(rawRec);
        if (!parsed) {
          return NextResponse.json({ error: 'recurrenceRule inválido' }, { status: 400 });
        }
        recurrenceRule = parsed;
        recurrenceSeriesKey = newRecurrenceSeriesKey();
      } catch (e: any) {
        return NextResponse.json(
          { error: e?.message || 'recurrenceRule inválido' },
          { status: 400 },
        );
      }
    }
    const rawUntil = body?.recurrenceUntil;
    if (rawUntil !== undefined && rawUntil !== null && String(rawUntil).trim()) {
      const u = new Date(String(rawUntil));
      if (Number.isNaN(u.getTime())) {
        return NextResponse.json({ error: 'recurrenceUntil inválido' }, { status: 400 });
      }
      if (!recurrenceSeriesKey) {
        return NextResponse.json(
          { error: 'recurrenceUntil exige recurrenceRule' },
          { status: 400 },
        );
      }
      recurrenceUntilIso = u.toISOString();
    }

    const task = await createTask(team.id, {
      boardId,
      columnId,
      projectId,
      title,
      description: typeof body?.description === 'string' ? body.description : null,
      priority,
      dueDate,
      assigneeIds: assigneeIdsList,
      createdById: user.id,
      statusId: statusIdBody && Number.isFinite(statusIdBody) ? statusIdBody : null,
      taskType,
      plannedStartAt: plannedParsed.value ? plannedParsed.value.toISOString() : null,
      estimatedDurationHours: estParsed.value,
      recurrenceRule,
      recurrenceSeriesKey,
      recurrenceUntil: recurrenceUntilIso,
      parentTaskId: parentTaskIdPost,
      sprintId: sprintIdPost,
    });

    const [createdEvRow] = await db
      .insert(taskflowTaskEvents)
      .values({
        taskId: task.id,
        type: 'CREATED',
        toColumnId: columnId,
        createdAt: new Date(),
      })
      .returning({ id: taskflowTaskEvents.id });

    await db.insert(activityLogs).values({
      teamId: team.id,
      userId: user.id,
      action: ActivityType.TASKFLOW_CREATE,
      timestamp: new Date(),
    });

    const notifyIds = await getTaskAssigneeIds(task.id);
    const creatorId = task.createdById ?? null;
    /** M6.7 — notificar responsáveis que não são o criador (e-mail + in-app). */
    const notifyTargets = notifyIds.filter((uid) => creatorId == null || uid !== creatorId);
    const dueStr = task.dueDate
      ? formatDateTimePtShort(
          task.dueDate instanceof Date ? task.dueDate.toISOString() : String(task.dueDate),
        )
      : null;
    if (notifyTargets.length > 0) {
      await db.insert(activityLogs).values(
        notifyTargets.map((uid) => ({
          teamId: team.id,
          userId: uid,
          action: ActivityType.TASKFLOW_ASSIGNED,
          timestamp: new Date(),
        })),
      );
    }
    for (const uid of notifyTargets) {
      const [assignee] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);
      if (assignee?.email) {
        sendTaskflowNotification({
          to: assignee.email,
          taskTitle: task.title,
          taskId: task.id,
          type: 'assigned',
          dueDate: dueStr,
          creatorName: user.name || user.email,
        }).catch(() => {});
      }
    }

    const assigneeIds = await getTaskAssigneeIds(task.id);
    const hookPayload = await buildTaskWebhookPayload(team.id, 'task.created', task.id);
    if (hookPayload && createdEvRow) {
      dispatchTaskflowWebhooksFireAndForget(
        team.id,
        'task.created',
        `task.created:${task.id}:${createdEvRow.id}`,
        hookPayload,
      );
    }
    return NextResponse.json({ ...task, assigneeIds }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao criar tarefa' },
      { status: 400 },
    );
  }
}

/**
 * Atualiza dados de uma tarefa do Taskflow.
 */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const taskId = Number(body?.id);
  if (!taskId) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const visOpts = taskflowBoardOptionsForUser(user.id, user.role);
  const visWhere =
    visOpts.listScope === 'self' ? taskflowTaskInvolvesUserWhere(visOpts.viewerUserId) : undefined;

  const existing = await db
    .select({
      id: taskflowTasks.id,
      boardId: taskflowTasks.boardId,
      columnId: taskflowTasks.columnId,
      priority: taskflowTasks.priority,
      assigneeId: taskflowTasks.assigneeId,
      dueDate: taskflowTasks.dueDate,
      title: taskflowTasks.title,
      teamId: taskflowBoards.teamId,
      statusId: taskflowTasks.statusId,
      createdById: taskflowTasks.createdById,
      recurrenceRule: taskflowTasks.recurrenceRule,
      recurrenceSeriesKey: taskflowTasks.recurrenceSeriesKey,
      recurrenceOccurrenceKey: taskflowTasks.recurrenceOccurrenceKey,
      recurrenceUntil: taskflowTasks.recurrenceUntil,
    })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(
        eq(taskflowTasks.id, taskId),
        eq(taskflowBoards.teamId, team.id),
        ...(visWhere ? [visWhere] : []),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const [statusSituation] = await db
    .select({ fixedSituation: taskflowStatusDefinitions.fixedSituation })
    .from(taskflowStatusDefinitions)
    .where(eq(taskflowStatusDefinitions.id, existing[0].statusId))
    .limit(1);
  const isTerminalTask = isTaskflowStatusTerminal(statusSituation?.fixedSituation);

  /** M7.5 — tarefa terminal: outros perfis não podem alterar nada; owner/admin só descrição e estado (sem datas, etc.). */
  const TERMINAL_PATCH_FORBIDDEN_FOR_OWNER_ADMIN = [
    'title',
    'priority',
    'projectId',
    'dueDate',
    'columnId',
    'taskType',
    'plannedStartAt',
    'estimatedDurationHours',
    'recurrenceRule',
    'recurrenceUntil',
    'assigneeIds',
    'assigneeId',
    'parentTaskId',
    'sprintId',
  ] as const;

  if (isTerminalTask && !isOwnerLike(user.role)) {
    const extra = Object.keys(body as Record<string, unknown>).filter((k) => k !== 'id');
    if (extra.length > 0) {
      return NextResponse.json(
        {
          error:
            'Tarefa concluída ou cancelada: só o administrador ou o proprietário pode alterar descrição e estado.',
        },
        { status: 403 },
      );
    }
  }

  if (isTerminalTask && isOwnerLike(user.role)) {
    for (const key of TERMINAL_PATCH_FORBIDDEN_FOR_OWNER_ADMIN) {
      if ((body as Record<string, unknown>)[key] !== undefined) {
        return NextResponse.json(
          {
            error:
              'Tarefa encerrada: só é permitido alterar descrição e estado (sem datas, coluna, responsáveis ou outros campos).',
          },
          { status: 400 },
        );
      }
    }

    const terminalUpdates: Partial<typeof taskflowTasks.$inferInsert> = {};
    if (typeof body?.description === 'string') {
      terminalUpdates.description = body.description;
    }
    if (body?.statusId !== undefined) {
      const sid = Number(body.statusId);
      if (!sid) {
        return NextResponse.json({ error: 'statusId inválido' }, { status: 400 });
      }
      const sd = await db
        .select({ id: taskflowStatusDefinitions.id })
        .from(taskflowStatusDefinitions)
        .where(
          and(
            eq(taskflowStatusDefinitions.id, sid),
            eq(taskflowStatusDefinitions.teamId, existing[0].teamId),
          ),
        )
        .limit(1);
      if (!sd[0]) {
        return NextResponse.json({ error: 'Status inválido para este time' }, { status: 400 });
      }
      terminalUpdates.statusId = sid;
    }

    if (Object.keys(terminalUpdates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const terminalUpdated = await db
      .update(taskflowTasks)
      .set({ ...terminalUpdates, updatedAt: new Date() })
      .where(eq(taskflowTasks.id, taskId))
      .returning();

    await db.insert(activityLogs).values({
      teamId: team.id,
      userId: user.id,
      action: ActivityType.TASKFLOW_UPDATE,
      timestamp: new Date(),
    });

    const assigneeIdsTerminal = await getTaskAssigneeIds(taskId);

    try {
      await syncChronosMirrorForTaskflowTask({
        teamId: team.id,
        taskId,
        title: terminalUpdated[0].title,
        dueDate: terminalUpdated[0].dueDate,
      });
    } catch {
      // M6.9 — espelho Chronos best-effort.
    }

    const hookPayloadTerminal = await buildTaskWebhookPayload(team.id, 'task.updated', taskId);
    if (hookPayloadTerminal) {
      const tms =
        terminalUpdated[0].updatedAt instanceof Date
          ? terminalUpdated[0].updatedAt.getTime()
          : Date.now();
      dispatchTaskflowWebhooksFireAndForget(
        team.id,
        'task.updated',
        `task.updated:${taskId}:${tms}`,
        hookPayloadTerminal,
      );
    }

    return NextResponse.json({ ...terminalUpdated[0], assigneeIds: assigneeIdsTerminal });
  }

  const previousAssigneeIds = await getTaskAssigneeIds(taskId);

  const updates: Partial<typeof taskflowTasks.$inferInsert> = {};
  if (typeof body?.title === 'string') {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });
    }
    updates.title = title;
  }
  if (typeof body?.priority === 'string') {
    updates.priority = body.priority;
  }
  if (typeof body?.description === 'string') {
    updates.description = body.description;
  }
  if (body?.projectId !== undefined) {
    updates.projectId = body.projectId ? Number(body.projectId) : null;
  }
  if (updates.projectId) {
    const project = await db
      .select({ id: projectusProjects.id })
      .from(projectusProjects)
      .where(
        and(
          eq(projectusProjects.id, updates.projectId),
          eq(projectusProjects.teamId, team.id),
        ),
      )
      .limit(1);
    if (!project[0]) {
      return NextResponse.json({ error: 'Projeto inválido' }, { status: 400 });
    }
  }
  if (typeof body?.dueDate === 'string') {
    updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (body?.dueDate === null) {
    updates.dueDate = null;
  }
  if (body?.columnId) {
    const columnId = Number(body.columnId);
    if (isTerminalTask && columnId !== existing[0].columnId) {
      return NextResponse.json(
        {
          error:
            'Tarefa concluída ou cancelada: não é possível mudar de coluna no quadro. Altere o estado primeiro, se aplicável.',
        },
        { status: 400 },
      );
    }
    const column = await db
      .select({
        id: taskflowColumns.id,
        name: taskflowColumns.name,
        phaseType: taskflowColumns.phaseType,
      })
      .from(taskflowColumns)
      .where(
        and(
          eq(taskflowColumns.id, columnId),
          eq(taskflowColumns.boardId, existing[0].boardId),
        ),
      )
      .limit(1);
    if (!column[0]) {
      return NextResponse.json({ error: 'Coluna inválida' }, { status: 400 });
    }
    updates.columnId = columnId;
    updates.columnEnteredAt = new Date();

    const columns = await db
      .select({ id: taskflowColumns.id, phaseType: taskflowColumns.phaseType })
      .from(taskflowColumns)
      .where(eq(taskflowColumns.boardId, existing[0].boardId));

    const completedColumnIds = columns
      .filter((item) => item.phaseType === 'FINAL')
      .map((item) => item.id);

    const doneId = await getTaskflowStatusIdBySituation(existing[0].teamId, 'DONE');
    const openId = await getTaskflowStatusIdBySituation(existing[0].teamId, 'OPEN');
    if (completedColumnIds.includes(columnId)) {
      updates.completedAt = new Date();
      if (doneId) {
        updates.statusId = doneId;
      }
    } else {
      updates.completedAt = null;
      if (openId) {
        updates.statusId = openId;
      }
    }
  }

  if (body?.statusId !== undefined) {
    const sid = Number(body.statusId);
    if (!sid) {
      return NextResponse.json({ error: 'statusId inválido' }, { status: 400 });
    }
    const sd = await db
      .select({ id: taskflowStatusDefinitions.id })
      .from(taskflowStatusDefinitions)
      .where(
        and(
          eq(taskflowStatusDefinitions.id, sid),
          eq(taskflowStatusDefinitions.teamId, existing[0].teamId),
        ),
      )
      .limit(1);
    if (!sd[0]) {
      return NextResponse.json({ error: 'Status inválido para este time' }, { status: 400 });
    }
    updates.statusId = sid;
  }

  if (body?.taskType !== undefined) {
    if (typeof body.taskType !== 'string' || !body.taskType.trim()) {
      return NextResponse.json({ error: 'taskType inválido' }, { status: 400 });
    }
    try {
      updates.taskType = await assertValidTaskType(team.id, body.taskType);
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || 'Tipo de tarefa inválido' },
        { status: 400 },
      );
    }
  }

  if (body?.plannedStartAt !== undefined) {
    const p = parsePlannedStartIso(body.plannedStartAt);
    if (!p.ok) {
      return NextResponse.json({ error: p.error }, { status: 400 });
    }
    updates.plannedStartAt = p.value;
  }

  if (body?.estimatedDurationHours !== undefined) {
    const e = parseEstimatedDurationHours(body.estimatedDurationHours);
    if (!e.ok) {
      return NextResponse.json({ error: e.error }, { status: 400 });
    }
    updates.estimatedDurationHours = e.value;
  }

  const isRecurrenceInstance = existing[0].recurrenceOccurrenceKey != null;
  if (!isRecurrenceInstance) {
    if (body?.recurrenceRule !== undefined) {
      const raw = body.recurrenceRule;
      if (raw === null || raw === '') {
        updates.recurrenceRule = null;
        updates.recurrenceSeriesKey = null;
        updates.recurrenceOccurrenceKey = null;
        updates.recurrenceUntil = null;
      } else {
        let parsed: ReturnType<typeof parseRecurrenceRule>;
        try {
          parsed = parseRecurrenceRule(raw);
        } catch (e: any) {
          return NextResponse.json(
            { error: e?.message || 'recurrenceRule inválido' },
            { status: 400 },
          );
        }
        if (!parsed) {
          return NextResponse.json({ error: 'recurrenceRule inválido' }, { status: 400 });
        }
        const prevRule = existing[0].recurrenceRule?.trim().toUpperCase() ?? null;
        if (prevRule && prevRule !== parsed) {
          return NextResponse.json(
            {
              error:
                'Não é permitido alterar o tipo de recorrência; desative a recorrência e crie novamente.',
            },
            { status: 400 },
          );
        }
        updates.recurrenceRule = parsed;
        if (!existing[0].recurrenceSeriesKey?.trim()) {
          updates.recurrenceSeriesKey = newRecurrenceSeriesKey();
        }
      }
    }

    if (body?.recurrenceUntil !== undefined) {
      const ru = body.recurrenceUntil;
      if (ru === null || ru === '') {
        updates.recurrenceUntil = null;
      } else {
        const ruleEffective =
          updates.recurrenceRule !== undefined
            ? updates.recurrenceRule
            : existing[0].recurrenceRule;
        if (!ruleEffective || !String(ruleEffective).trim()) {
          return NextResponse.json(
            { error: 'recurrenceUntil exige uma tarefa com recorrência ativa' },
            { status: 400 },
          );
        }
        const d = new Date(String(ru));
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: 'recurrenceUntil inválido' }, { status: 400 });
        }
        updates.recurrenceUntil = d;
      }
    }
  }

  if (body?.parentTaskId !== undefined) {
    const raw = body.parentTaskId;
    const pid =
      raw === null || raw === '' || (typeof raw === 'string' && raw === 'null')
        ? null
        : Number(raw);
    if (pid != null && (!Number.isFinite(pid) || pid < 1)) {
      return NextResponse.json({ error: 'parentTaskId inválido' }, { status: 400 });
    }
    try {
      await assertValidTaskflowParentTask(team.id, existing[0].boardId, taskId, pid);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Pai inválido' }, { status: 400 });
    }
    updates.parentTaskId = pid;
  }

  if (body?.sprintId !== undefined) {
    const raw = body.sprintId;
    const sid =
      raw === null || raw === '' || (typeof raw === 'string' && raw === 'null')
        ? null
        : Number(raw);
    if (sid != null && (!Number.isFinite(sid) || sid < 1)) {
      return NextResponse.json({ error: 'sprintId inválido' }, { status: 400 });
    }
    try {
      await assertValidTaskflowSprint(team.id, sid);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Sprint inválido' }, { status: 400 });
    }
    updates.sprintId = sid;
  }

  const assigneesFromBody =
    Array.isArray(body?.assigneeIds) || body?.assigneeId !== undefined;

  if (isTerminalTask && assigneesFromBody) {
    return NextResponse.json(
      {
        error:
          'Tarefa concluída ou cancelada: não é possível alterar responsáveis. Altere o estado primeiro, se aplicável.',
      },
      { status: 400 },
    );
  }

  let nextAssigneeIds: number[];
  if (Array.isArray(body?.assigneeIds)) {
    nextAssigneeIds = dedupeAssigneeIdsPreserveOrder(body.assigneeIds as unknown[]);
  } else if (body?.assigneeId !== undefined) {
    nextAssigneeIds = body.assigneeId ? [Number(body.assigneeId)] : [];
  } else {
    nextAssigneeIds = [...previousAssigneeIds];
  }

  if (Object.keys(updates).length === 0 && !assigneesFromBody) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  const advancedRules = await db
    .select()
    .from(taskflowAdvancedRules)
    .where(eq(taskflowAdvancedRules.teamId, team.id));

  if (advancedRules.length > 0) {
    const finalPriority = updates.priority ?? existing[0].priority;
    const finalDueDate =
      updates.dueDate !== undefined ? updates.dueDate : existing[0].dueDate;

    let priority = finalPriority;
    let assigneeIdsList = [...nextAssigneeIds];
    const dueDate = finalDueDate ? new Date(finalDueDate) : null;

    advancedRules
      .filter((rule) => rule.enabled)
      .forEach((rule) => {
        const assigneeHead = assigneeIdsList[0] ?? null;
        const dueOk =
          rule.dueInDays === null ||
          (dueDate
            ? dueDate.getTime() - new Date().getTime() <=
              rule.dueInDays * 24 * 60 * 60 * 1000
            : false);
        const priorityOk = !rule.priorityEquals || rule.priorityEquals === priority;
        const assigneeOk =
          !rule.assigneeMissing || (rule.assigneeMissing && assigneeHead == null);

        if (dueOk && priorityOk && assigneeOk) {
          if (rule.actionSetPriority) {
            priority = rule.actionSetPriority;
          }
          if (rule.actionAssignCreator && assigneeIdsList.length === 0) {
            assigneeIdsList = [user.id];
          }
        }
      });

    updates.priority = priority;
    updates.assigneeId = assigneeIdsList[0] ?? null;
    nextAssigneeIds = assigneeIdsList;
  } else if (assigneesFromBody) {
    updates.assigneeId = nextAssigneeIds[0] ?? null;
  }

  const creatorId = existing[0].createdById;
  if (creatorId != null) {
    nextAssigneeIds = mergeCreatorIntoAssigneeIds(creatorId, nextAssigneeIds);
    if (assigneesFromBody || advancedRules.length > 0) {
      updates.assigneeId = nextAssigneeIds[0] ?? null;
    }
  }

  if (isTerminalTask) {
    nextAssigneeIds = [...previousAssigneeIds];
    delete updates.assigneeId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  if (nextAssigneeIds.length === 0) {
    return NextResponse.json(
      { error: 'É necessário pelo menos um responsável.' },
      { status: 400 },
    );
  }

  try {
    await assertTaskAssigneesInTeam(team.id, nextAssigneeIds);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Responsáveis inválidos' },
      { status: 400 },
    );
  }

  const updated = await db
    .update(taskflowTasks)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(taskflowTasks.id, taskId))
    .returning();

  await syncTaskAssignees(team.id, taskId, nextAssigneeIds);

  const action = updates.columnId
    ? ActivityType.TASKFLOW_MOVE
    : ActivityType.TASKFLOW_UPDATE;

  await db.insert(activityLogs).values({
    teamId: team.id,
    userId: user.id,
    action,
    timestamp: new Date(),
  });

  if (updates.columnId) {
    await db.insert(taskflowTaskEvents).values({
      taskId,
      type: 'MOVED',
      fromColumnId: existing[0].columnId,
      toColumnId: updates.columnId,
      createdAt: new Date(),
    });
  }

  const previousSet = new Set(previousAssigneeIds);
  const dueForMail = (updates.dueDate ?? existing[0]?.dueDate)
    ? formatDateTimePtShort(
        new Date(updates.dueDate ?? existing[0]?.dueDate!).toISOString(),
      )
    : null;
  const taskTitle = (updates.title ?? existing[0]?.title ?? 'Tarefa') as string;
  const patchCreatorId = existing[0].createdById ?? null;
  /** M6.7 — novos responsáveis que não são o criador da tarefa. */
  const newlyAssigned = nextAssigneeIds.filter(
    (uid) => !previousSet.has(uid) && (patchCreatorId == null || uid !== patchCreatorId),
  );
  if (newlyAssigned.length > 0) {
    await db.insert(activityLogs).values(
      newlyAssigned.map((uid) => ({
        teamId: team.id,
        userId: uid,
        action: ActivityType.TASKFLOW_ASSIGNED,
        timestamp: new Date(),
      })),
    );
  }
  for (const uid of newlyAssigned) {
    const [assignee] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    if (assignee?.email) {
      sendTaskflowNotification({
        to: assignee.email,
        taskTitle,
        taskId,
        type: 'assigned',
        dueDate: dueForMail,
        creatorName: user.name || user.email,
      }).catch(() => {});
    }
  }

  const assigneeIds = await getTaskAssigneeIds(taskId);

  try {
    await syncChronosMirrorForTaskflowTask({
      teamId: team.id,
      taskId,
      title: updated[0].title,
      dueDate: updated[0].dueDate,
    });
  } catch {
    // M6.9 — espelho Chronos best-effort.
  }

  const hookPayloadPatch = await buildTaskWebhookPayload(team.id, 'task.updated', taskId);
  if (hookPayloadPatch) {
    const tms =
      updated[0].updatedAt instanceof Date ? updated[0].updatedAt.getTime() : Date.now();
    dispatchTaskflowWebhooksFireAndForget(
      team.id,
      'task.updated',
      `task.updated:${taskId}:${tms}`,
      hookPayloadPatch,
    );
  }

  return NextResponse.json({ ...updated[0], assigneeIds });
}

/**
 * Exclui uma tarefa do Taskflow.
 */
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const taskId = Number(searchParams.get('id'));
  if (!taskId) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const visOptsDel = taskflowBoardOptionsForUser(user.id, user.role);
  const visWhereDel =
    visOptsDel.listScope === 'self'
      ? taskflowTaskInvolvesUserWhere(visOptsDel.viewerUserId)
      : undefined;

  const existing = await db
    .select({ id: taskflowTasks.id })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(
        eq(taskflowTasks.id, taskId),
        eq(taskflowBoards.teamId, team.id),
        ...(visWhereDel ? [visWhereDel] : []),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  await db.delete(taskflowTasks).where(eq(taskflowTasks.id, taskId));

  await db.insert(activityLogs).values({
    teamId: team.id,
    userId: user.id,
    action: ActivityType.TASKFLOW_DELETE,
    timestamp: new Date(),
  });

  return NextResponse.json({ ok: true });
}
