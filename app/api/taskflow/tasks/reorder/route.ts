import { NextResponse } from 'next/server';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { taskflowBoards, taskflowStatusDefinitions, taskflowTasks } from '@/lib/db/schema';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowBoardOptionsForUser, taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

type ReorderPayload = {
  columnId: number;
  taskIds: number[];
};

/**
 * Atualiza a ordem das tarefas em uma coluna do Taskflow.
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

  const body = (await request.json()) as ReorderPayload;
  const columnId = Number(body?.columnId);
  const taskIds = Array.isArray(body?.taskIds)
    ? body.taskIds.map((id) => Number(id)).filter(Boolean)
    : [];

  if (!columnId) {
    return NextResponse.json(
      { error: 'columnId é obrigatório' },
      { status: 400 },
    );
  }

  const { listScope, viewerUserId } = taskflowBoardOptionsForUser(user.id, user.role);
  const vis =
    listScope === 'self' ? taskflowTaskInvolvesUserWhere(viewerUserId) : undefined;

  const existing = await db
    .select({ id: taskflowTasks.id })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(
        eq(taskflowTasks.columnId, columnId),
        eq(taskflowBoards.teamId, team.id),
        ...(vis ? [vis] : []),
      ),
    );

  const existingIds = new Set(existing.map((row) => row.id));
  const validIds = taskIds.filter((id) => existingIds.has(id));

  if (taskIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  if (validIds.length === 0) {
    return NextResponse.json({ error: 'Nenhuma tarefa válida' }, { status: 400 });
  }

  const terminalCount = await db
    .select({ id: taskflowTasks.id })
    .from(taskflowTasks)
    .innerJoin(
      taskflowStatusDefinitions,
      eq(taskflowTasks.statusId, taskflowStatusDefinitions.id),
    )
    .where(
      and(
        inArray(taskflowTasks.id, validIds),
        or(
          eq(taskflowStatusDefinitions.fixedSituation, 'DONE'),
          eq(taskflowStatusDefinitions.fixedSituation, 'CANCELLED'),
        ),
      ),
    );

  if (terminalCount.length > 0) {
    return NextResponse.json(
      {
        error:
          'Não é possível reordenar tarefas concluídas ou canceladas no quadro.',
      },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    for (let index = 0; index < validIds.length; index += 1) {
      await tx
        .update(taskflowTasks)
        .set({ position: index, updatedAt: new Date() })
        .where(eq(taskflowTasks.id, validIds[index]));
    }
  });

  return NextResponse.json({ ok: true });
}
