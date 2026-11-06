import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { taskflowLabels, taskflowTaskLabels, taskflowTasks } from '@/lib/db/schema';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowTaskForTeam } from '@/lib/db/taskflow';
import { taskPriorityFromAppliedLabelRows } from '@/lib/taskflow/label-priority';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * Substitui labels de uma tarefa do Taskflow.
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
  const labelIds = Array.isArray(body?.labelIds)
    ? body.labelIds.map((id: number) => Number(id)).filter(Boolean)
    : [];

  if (!taskId) {
    return NextResponse.json({ error: 'taskId é obrigatório' }, { status: 400 });
  }

  const vis = taskflowBoardOptionsForUser(user.id, user.role);
  const taskRow = await getTaskflowTaskForTeam(taskId, team.id, vis);

  if (!taskRow) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const validLabels = labelIds.length
    ? await db
        .select({ id: taskflowLabels.id, priority: taskflowLabels.priority })
        .from(taskflowLabels)
        .where(
          and(
            eq(taskflowLabels.boardId, taskRow.boardId),
            inArray(taskflowLabels.id, labelIds),
          ),
        )
    : [];

  const derivedPriority = taskPriorityFromAppliedLabelRows(validLabels);

  await db.transaction(async (tx) => {
    await tx.delete(taskflowTaskLabels).where(eq(taskflowTaskLabels.taskId, taskId));

    if (validLabels.length > 0) {
      await tx.insert(taskflowTaskLabels).values(
        validLabels.map((label) => ({
          taskId,
          labelId: label.id,
          createdAt: new Date(),
        })),
      );
    }

    if (derivedPriority !== null) {
      await tx
        .update(taskflowTasks)
        .set({ priority: derivedPriority, updatedAt: new Date() })
        .where(eq(taskflowTasks.id, taskId));
    }
  });

  return NextResponse.json({
    ok: true,
    taskPriority: derivedPriority,
  });
}
