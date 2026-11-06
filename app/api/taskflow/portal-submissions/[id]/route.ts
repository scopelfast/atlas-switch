import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, hasPermission, normalizeRole } from '@/lib/auth/permissions';
import {
  assertTaskflowColumnBelongsToTeam,
  buildTaskDescriptionFromPortalSubmission,
  getPortalSubmissionForTeam,
} from '@/lib/db/taskflow-portal';
import { createTask, getTaskAssigneeIds } from '@/lib/db/taskflow';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  activityLogs,
  taskflowPortalSubmissions,
  taskflowTaskEvents,
  users,
} from '@/lib/db/schema';
import { ActivityType } from '@/lib/db/schema';
import { sendTaskflowNotification } from '@/lib/email/mailer';
import { formatDateTimePtShort } from '@/lib/taskflow/task-schedule';
import {
  buildTaskWebhookPayload,
  dispatchTaskflowWebhooksFireAndForget,
} from '@/lib/taskflow/webhook-outbound';

/** E8.7 — aprovar ou recusar pedido do portal. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const role = normalizeRole(user.role);
  if (!hasPermission(role, 'taskflow.view') || !canConfigureTaskflowBoard(role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
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

  const submissionId = Number((await context.params).id);
  if (!Number.isFinite(submissionId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const action = (body as { action?: string }).action;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action deve ser approve ou reject' }, { status: 400 });
  }

  const sub = await getPortalSubmissionForTeam(team.id, submissionId);
  if (!sub || sub.status !== 'pending') {
    return NextResponse.json({ error: 'Pedido não encontrado ou já tratado' }, { status: 404 });
  }

  if (action === 'reject') {
    await db
      .update(taskflowPortalSubmissions)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedByUserId: user.id,
      })
      .where(
        and(eq(taskflowPortalSubmissions.id, sub.id), eq(taskflowPortalSubmissions.teamId, team.id)),
      );
    await db.insert(activityLogs).values({
      teamId: team.id,
      userId: user.id,
      action: ActivityType.TASKFLOW_PORTAL_REJECT,
      timestamp: new Date(),
    });
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  const columnId = team.taskflowPublicPortalColumnId;
  if (!columnId) {
    return NextResponse.json(
      { error: 'O portal não tem coluna de destino configurada (owner/admin).' },
      { status: 400 },
    );
  }
  const { boardId } = await assertTaskflowColumnBelongsToTeam(team.id, columnId);

  const description = buildTaskDescriptionFromPortalSubmission(sub);
  let task;
  try {
    task = await createTask(team.id, {
      boardId,
      columnId,
      title: sub.title,
      description,
      createdById: user.id,
      taskType: 'generic',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao criar tarefa';
    return NextResponse.json({ error: message }, { status: 400 });
  }

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

  await db.insert(activityLogs).values({
    teamId: team.id,
    userId: user.id,
    action: ActivityType.TASKFLOW_PORTAL_APPROVE,
    timestamp: new Date(),
  });

  const notifyIds = await getTaskAssigneeIds(task.id);
  const creatorId = task.createdById ?? null;
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

  const hookPayload = await buildTaskWebhookPayload(team.id, 'task.created', task.id);
  if (hookPayload && createdEvRow) {
    dispatchTaskflowWebhooksFireAndForget(
      team.id,
      'task.created',
      `task.created:${task.id}:${createdEvRow.id}`,
      hookPayload,
    );
  }

  await db
    .update(taskflowPortalSubmissions)
    .set({
      status: 'approved',
      reviewedAt: new Date(),
      reviewedByUserId: user.id,
      taskId: task.id,
    })
    .where(
      and(eq(taskflowPortalSubmissions.id, sub.id), eq(taskflowPortalSubmissions.teamId, team.id)),
    );

  const assigneeIds = await getTaskAssigneeIds(task.id);
  return NextResponse.json({ ...task, assigneeIds, submissionStatus: 'approved' });
}
