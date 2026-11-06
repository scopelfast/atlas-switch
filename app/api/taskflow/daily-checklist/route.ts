import { NextResponse } from 'next/server';
import { and, asc, eq, sql } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowTaskForTeam } from '@/lib/db/taskflow';
import {
  taskflowBoardOptionsForUser,
  taskflowTaskInvolvesUserWhere,
} from '@/lib/taskflow/task-visibility';
import { db } from '@/lib/db/drizzle';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  taskflowBoards,
  taskflowDailyChecklist,
  taskflowTasks,
} from '@/lib/db/schema';

/**
 * Retorna o checklist diário do usuário para a data informada.
 */
export async function GET(request: Request) {
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
  const dateStr = searchParams.get('date');
  const date = dateStr || new Date().toISOString().slice(0, 10);

  const { listScope, viewerUserId } = taskflowBoardOptionsForUser(user.id, user.role);
  const vis =
    listScope === 'self' ? taskflowTaskInvolvesUserWhere(viewerUserId) : undefined;

  const items = await db
    .select({
      id: taskflowDailyChecklist.id,
      taskId: taskflowDailyChecklist.taskId,
      position: taskflowDailyChecklist.position,
      checked: taskflowDailyChecklist.checked,
      checklistDate: taskflowDailyChecklist.checklistDate,
      taskTitle: taskflowTasks.title,
      taskPriority: taskflowTasks.priority,
      taskDueDate: taskflowTasks.dueDate,
    })
    .from(taskflowDailyChecklist)
    .innerJoin(taskflowTasks, eq(taskflowDailyChecklist.taskId, taskflowTasks.id))
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(
        eq(taskflowDailyChecklist.teamId, team.id),
        eq(taskflowDailyChecklist.userId, user.id),
        eq(taskflowDailyChecklist.checklistDate, date),
        eq(taskflowBoards.teamId, team.id),
        ...(vis ? [vis] : []),
      ),
    )
    .orderBy(asc(taskflowDailyChecklist.position));

  return NextResponse.json(items);
}

/**
 * Adiciona uma tarefa ao checklist diário.
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
  const taskId = Number(body?.taskId);
  const dateStr = typeof body?.date === 'string' ? body.date : null;
  const date = dateStr || new Date().toISOString().slice(0, 10);

  if (!taskId) {
    return NextResponse.json(
      { error: 'taskId é obrigatório' },
      { status: 400 },
    );
  }

  const vis = taskflowBoardOptionsForUser(user.id, user.role);
  const taskRow = await getTaskflowTaskForTeam(taskId, team.id, vis);

  if (!taskRow) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const existing = await db
    .select({ id: taskflowDailyChecklist.id })
    .from(taskflowDailyChecklist)
    .where(
      and(
        eq(taskflowDailyChecklist.teamId, team.id),
        eq(taskflowDailyChecklist.userId, user.id),
        eq(taskflowDailyChecklist.taskId, taskId),
        eq(taskflowDailyChecklist.checklistDate, date),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return NextResponse.json(existing[0], { status: 200 });
  }

  const [maxPos] = await db
    .select({
      max: sql<number>`max(${taskflowDailyChecklist.position})`,
    })
    .from(taskflowDailyChecklist)
    .where(
      and(
        eq(taskflowDailyChecklist.teamId, team.id),
        eq(taskflowDailyChecklist.userId, user.id),
        eq(taskflowDailyChecklist.checklistDate, date),
      ),
    );

  const nextPosition = (Number(maxPos?.max ?? 0) || 0) + 1;

  const [created] = await db
    .insert(taskflowDailyChecklist)
    .values({
      teamId: team.id,
      userId: user.id,
      taskId,
      checklistDate: date,
      position: nextPosition,
      checked: false,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

/**
 * Atualiza item do checklist (marca/desmarca ou remove).
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
  const id = Number(body?.id);
  const checked = body?.checked;

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(taskflowDailyChecklist)
    .where(
      and(
        eq(taskflowDailyChecklist.id, id),
        eq(taskflowDailyChecklist.teamId, team.id),
        eq(taskflowDailyChecklist.userId, user.id),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
  }

  const updates: { checked?: boolean } = {};
  if (typeof checked === 'boolean') {
    updates.checked = checked;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(existing[0]);
  }

  const [updated] = await db
    .update(taskflowDailyChecklist)
    .set(updates)
    .where(eq(taskflowDailyChecklist.id, id))
    .returning();

  return NextResponse.json(updated);
}

/**
 * Remove item do checklist diário.
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

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const existing = await db
    .select({ id: taskflowDailyChecklist.id })
    .from(taskflowDailyChecklist)
    .where(
      and(
        eq(taskflowDailyChecklist.id, id),
        eq(taskflowDailyChecklist.teamId, team.id),
        eq(taskflowDailyChecklist.userId, user.id),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
  }

  await db.delete(taskflowDailyChecklist).where(eq(taskflowDailyChecklist.id, id));
  return NextResponse.json({ ok: true });
}
