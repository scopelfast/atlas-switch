import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { taskflowBoards, taskflowLabels } from '@/lib/db/schema';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { normalizeLabelColorForApi } from '@/lib/taskflow/label-color';
import { labelPrioritySortKey, normalizeLabelPriority } from '@/lib/taskflow/label-priority';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * Retorna labels do board Taskflow do time (`boardId` opcional; por omissão o quadro mais recente).
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

  const boardIdParam = new URL(request.url).searchParams.get('boardId');
  let boardRow: { id: number } | undefined;
  if (boardIdParam != null && boardIdParam !== '') {
    const n = Number(boardIdParam);
    if (Number.isFinite(n) && n > 0) {
      const rows = await db
        .select({ id: taskflowBoards.id })
        .from(taskflowBoards)
        .where(and(eq(taskflowBoards.teamId, team.id), eq(taskflowBoards.id, n)))
        .limit(1);
      boardRow = rows[0];
    }
  }
  if (!boardRow) {
    const board = await db
      .select({ id: taskflowBoards.id })
      .from(taskflowBoards)
      .where(eq(taskflowBoards.teamId, team.id))
      .orderBy(desc(taskflowBoards.createdAt))
      .limit(1);
    boardRow = board[0];
  }

  if (!boardRow) {
    return NextResponse.json([]);
  }

  const labels = await db
    .select()
    .from(taskflowLabels)
    .where(eq(taskflowLabels.boardId, boardRow.id));

  const sorted = [...labels].sort(
    (a, b) =>
      labelPrioritySortKey(a.priority) - labelPrioritySortKey(b.priority) ||
      a.name.localeCompare(b.name, 'pt'),
  );

  return NextResponse.json(sorted);
}

/**
 * Cria uma nova label no Taskflow.
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
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const colorRaw = typeof body?.color === 'string' ? body.color.trim() : 'indigo';
  const colorNorm = normalizeLabelColorForApi(colorRaw);
  if (!colorNorm.ok) {
    return NextResponse.json({ error: colorNorm.error }, { status: 400 });
  }
  const color = colorNorm.value;
  const priority = normalizeLabelPriority(body?.priority);

  if (!boardId || !name) {
    return NextResponse.json(
      { error: 'boardId e name são obrigatórios' },
      { status: 400 },
    );
  }

  const board = await db
    .select({ id: taskflowBoards.id })
    .from(taskflowBoards)
    .where(and(eq(taskflowBoards.id, boardId), eq(taskflowBoards.teamId, team.id)))
    .limit(1);

  if (!board[0]) {
    return NextResponse.json({ error: 'Board inválido' }, { status: 400 });
  }

  const created = await db
    .insert(taskflowLabels)
    .values({
      boardId,
      name,
      color,
      priority,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json(created[0], { status: 201 });
}
