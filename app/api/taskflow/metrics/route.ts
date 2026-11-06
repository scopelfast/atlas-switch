import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getLatestTaskflowBoardIdForTeam } from '@/lib/db/taskflow-board-resolve';
import { taskflowColumns, taskflowTaskEvents, taskflowTasks } from '@/lib/db/schema';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowBoardOptionsForUser, taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

function diffInDays(start: Date, end: Date) {
  const oneDay = 1000 * 60 * 60 * 24;
  const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endMid.getTime() - startMid.getTime()) / oneDay);
}

/**
 * Retorna métricas avançadas do Taskflow.
 */
export async function GET() {
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

  try {
  const boardId = await getLatestTaskflowBoardIdForTeam(team.id);
  if (boardId == null) {
    return NextResponse.json({
      cycleTimeAvg: 0,
      bottleneckColumnId: null,
      bottleneckDays: 0,
    });
  }

  const columns = await db
    .select()
    .from(taskflowColumns)
    .where(eq(taskflowColumns.boardId, boardId));

  const productionCols = columns.filter((col) => col.phaseType === 'PRODUCTION');
  const inProgressIds = productionCols.length
    ? productionCols.map((col) => col.id)
    : columns
        .filter((col) => col.phaseType !== 'FINAL' && col.phaseType !== 'INITIAL')
        .map((col) => col.id);
  const doneIds = columns.filter((col) => col.phaseType === 'FINAL').map((col) => col.id);

  const { listScope, viewerUserId } = taskflowBoardOptionsForUser(user.id, user.role);
  const vis =
    listScope === 'self' ? taskflowTaskInvolvesUserWhere(viewerUserId) : undefined;

  const completedTasks =
    doneIds.length === 0
      ? []
      : await db
          .select()
          .from(taskflowTasks)
          .where(
            and(
              eq(taskflowTasks.boardId, boardId),
              inArray(taskflowTasks.columnId, doneIds),
              ...(vis ? [vis] : []),
            ),
          );

  const completedIds = completedTasks.map((task) => task.id);
  const events = completedIds.length
    ? await db
        .select()
        .from(taskflowTaskEvents)
        .where(inArray(taskflowTaskEvents.taskId, completedIds))
    : [];

  const cycleTimes: number[] = [];
  completedTasks.forEach((task) => {
    const taskEvents = events.filter((event) => event.taskId === task.id);
    const startEvent = taskEvents.find((event) =>
      inProgressIds.includes(event.toColumnId || 0),
    );
    const endEvent = taskEvents.find((event) =>
      doneIds.includes(event.toColumnId || 0),
    );
    if (startEvent && endEvent) {
      cycleTimes.push(diffInDays(startEvent.createdAt, endEvent.createdAt));
    }
  });

  const cycleTimeAvg =
    cycleTimes.length === 0
      ? 0
      : Math.round(cycleTimes.reduce((acc, value) => acc + value, 0) / cycleTimes.length);

  const openTasks = await db
    .select()
    .from(taskflowTasks)
    .where(
      and(eq(taskflowTasks.boardId, boardId), ...(vis ? [vis] : [])),
    );

  const now = new Date();
  const columnAges = columns.map((column) => {
    const tasks = openTasks.filter((task) => task.columnId === column.id);
    const avgAge =
      tasks.length === 0
        ? 0
        : Math.round(
            tasks.reduce((acc, task) => acc + diffInDays(task.updatedAt, now), 0) /
              tasks.length,
          );
    return { columnId: column.id, avgAge };
  });

  const bottleneck = columnAges.sort((a, b) => b.avgAge - a.avgAge)[0];

  return NextResponse.json({
    cycleTimeAvg,
    bottleneckColumnId: bottleneck?.columnId || null,
    bottleneckDays: bottleneck?.avgAge || 0,
  });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao calcular métricas';
    console.error('[GET /api/taskflow/metrics]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
