import { NextResponse } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { createTask, ensureDefaultBoard } from '@/lib/db/taskflow';
import { db } from '@/lib/db/drizzle';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  reunifyActionItems,
  reunifyMeetings,
  taskflowBoards,
  taskflowColumns,
  taskflowTasks,
} from '@/lib/db/schema';

async function taskflowTaskForTeam(taskId: number, teamId: number) {
  const rows = await db
    .select({ task: taskflowTasks })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(and(eq(taskflowTasks.id, taskId), eq(taskflowBoards.teamId, teamId)))
    .limit(1);
  return rows[0]?.task ?? null;
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  let body: { actionItemId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const actionItemId = Number(body?.actionItemId);
  if (!actionItemId) {
    return NextResponse.json({ error: 'actionItemId é obrigatório' }, { status: 400 });
  }

  const actionRows = await db
    .select()
    .from(reunifyActionItems)
    .where(eq(reunifyActionItems.id, actionItemId))
    .limit(1);

  const action = actionRows[0];
  if (!action) {
    return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 });
  }

  const meetingRows = await db
    .select({
      id: reunifyMeetings.id,
      title: reunifyMeetings.title,
      date: reunifyMeetings.date,
      startTime: reunifyMeetings.startTime,
      endTime: reunifyMeetings.endTime,
    })
    .from(reunifyMeetings)
    .where(
      and(eq(reunifyMeetings.id, action.meetingId), eq(reunifyMeetings.teamId, team.id)),
    )
    .limit(1);

  const meeting = meetingRows[0];
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  if (action.taskflowTaskId != null) {
    const linked = await taskflowTaskForTeam(action.taskflowTaskId, team.id);
    if (linked) {
      return NextResponse.json(
        { idempotent: true, task: linked, message: 'Esta ação já tinha tarefa no Taskflow.' },
        { status: 200 },
      );
    }
    await db
      .update(reunifyActionItems)
      .set({ taskflowTaskId: null, updatedAt: new Date() })
      .where(eq(reunifyActionItems.id, actionItemId));
  }

  const board = await ensureDefaultBoard(team.id);
  const columns = await db
    .select()
    .from(taskflowColumns)
    .where(eq(taskflowColumns.boardId, board.id))
    .orderBy(asc(taskflowColumns.position))
    .limit(1);

  if (!columns[0]) {
    return NextResponse.json({ error: 'Coluna não encontrada' }, { status: 404 });
  }

  const raw = action.dueDate;
  const dueDate =
    raw != null
      ? (typeof raw === 'string' ? raw.slice(0, 10) : (raw as Date).toISOString().slice(0, 10))
      : new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const description = `Reunify · ${meeting.title}`;

  let created;
  try {
    created = await createTask(team.id, {
      boardId: board.id,
      columnId: columns[0].id,
      title: action.title,
      description,
      priority: 'MEDIUM',
      dueDate,
      assigneeId: action.ownerId || user.id,
      createdById: user.id,
      taskType: 'meeting_action',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao criar tarefa';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const linked = await db
    .update(reunifyActionItems)
    .set({ taskflowTaskId: created.id, updatedAt: new Date() })
    .where(and(eq(reunifyActionItems.id, actionItemId), isNull(reunifyActionItems.taskflowTaskId)))
    .returning({ id: reunifyActionItems.id });

  if (linked.length === 0) {
    await db.delete(taskflowTasks).where(eq(taskflowTasks.id, created.id));
    const again = await db
      .select({ taskflowTaskId: reunifyActionItems.taskflowTaskId })
      .from(reunifyActionItems)
      .where(eq(reunifyActionItems.id, actionItemId))
      .limit(1);
    const tid = again[0]?.taskflowTaskId;
    if (tid == null) {
      return NextResponse.json(
        { error: 'Não foi possível associar a tarefa à ação; tente novamente.' },
        { status: 409 },
      );
    }
    const winner = await taskflowTaskForTeam(tid, team.id);
    if (!winner) {
      return NextResponse.json(
        { error: 'Estado inconsistente da ação; contacte o suporte.' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        idempotent: true,
        task: winner,
        message: 'Outro pedido já criou a tarefa para esta ação.',
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { idempotent: false, task: created, message: 'Tarefa criada no Taskflow.' },
    { status: 201 },
  );
}
