import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { ensureDefaultStatusDefinitions } from '@/lib/db/taskflow';
import { taskflowBoardOptionsForUser, taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  projectusProjects,
  taskflowBoards,
  taskflowColumns,
  taskflowStatusDefinitions,
  taskflowTasks,
} from '@/lib/db/schema';

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'projectus'))) {
    return NextResponse.json(
      { error: 'O módulo Projectus não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get('projectId'));
  if (!projectId) {
    return NextResponse.json({ error: 'projectId é obrigatório' }, { status: 400 });
  }

  const project = await db
    .select()
    .from(projectusProjects)
    .where(and(eq(projectusProjects.id, projectId), eq(projectusProjects.teamId, team.id)))
    .limit(1);

  if (!project[0]) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  await ensureDefaultStatusDefinitions(team.id);

  const { listScope, viewerUserId } = taskflowBoardOptionsForUser(user.id, user.role);
  const visibilityWhere =
    listScope === 'self' ? taskflowTaskInvolvesUserWhere(viewerUserId) : undefined;

  const tasks = await db
    .select({
      id: taskflowTasks.id,
      title: taskflowTasks.title,
      priority: taskflowTasks.priority,
      status: taskflowStatusDefinitions.fixedSituation,
      statusId: taskflowTasks.statusId,
      statusName: taskflowStatusDefinitions.name,
      taskType: taskflowTasks.taskType,
      dueDate: taskflowTasks.dueDate,
      plannedStartAt: taskflowTasks.plannedStartAt,
      estimatedDurationHours: taskflowTasks.estimatedDurationHours,
      columnId: taskflowTasks.columnId,
      columnName: taskflowColumns.name,
    })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .innerJoin(taskflowColumns, eq(taskflowTasks.columnId, taskflowColumns.id))
    .innerJoin(
      taskflowStatusDefinitions,
      eq(taskflowTasks.statusId, taskflowStatusDefinitions.id),
    )
    .where(
      and(
        eq(taskflowBoards.teamId, team.id),
        eq(taskflowTasks.projectId, projectId),
        ...(visibilityWhere ? [visibilityWhere] : []),
      ),
    )
    .orderBy(taskflowTasks.createdAt);

  return NextResponse.json(tasks);
}
