import { NextResponse } from 'next/server';
import { and, asc, count, desc, eq, ne } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowBoards, taskflowColumns } from '@/lib/db/schema';
import { type PhaseType, normalizePhaseType } from '@/lib/taskflow/column-phase';
import { normalizeLabelColorForApi } from '@/lib/taskflow/label-color';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

async function defaultBoard(teamId: number) {
  const rows = await db
    .select({ id: taskflowBoards.id })
    .from(taskflowBoards)
    .where(eq(taskflowBoards.teamId, teamId))
    .orderBy(desc(taskflowBoards.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

async function resolveBoardIdForTeam(teamId: number, boardIdRaw: unknown): Promise<number | null> {
  if (boardIdRaw != null && boardIdRaw !== '') {
    const n = Number(boardIdRaw);
    if (Number.isFinite(n) && n > 0) {
      const row = await db
        .select({ id: taskflowBoards.id })
        .from(taskflowBoards)
        .where(and(eq(taskflowBoards.teamId, teamId), eq(taskflowBoards.id, n)))
        .limit(1);
      if (row[0]) {
        return row[0].id;
      }
      return null;
    }
  }
  const fb = await defaultBoard(teamId);
  return fb?.id ?? null;
}

async function countPhaseOnBoard(boardId: number, phase: PhaseType, excludeColumnId?: number) {
  const parts = [eq(taskflowColumns.boardId, boardId), eq(taskflowColumns.phaseType, phase)];
  if (excludeColumnId) {
    parts.push(ne(taskflowColumns.id, excludeColumnId));
  }
  const [row] = await db.select({ c: count() }).from(taskflowColumns).where(and(...parts));
  return Number(row?.c ?? 0);
}

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
  const boardId = await resolveBoardIdForTeam(team.id, boardIdParam);
  if (boardId == null) {
    return NextResponse.json({ error: 'Quadro não encontrado' }, { status: 404 });
  }
  const board = { id: boardId };

  const columns = await db
    .select()
    .from(taskflowColumns)
    .where(eq(taskflowColumns.boardId, board.id))
    .orderBy(asc(taskflowColumns.position));

  return NextResponse.json(columns);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão para configurar fases do Kanban.' }, { status: 403 });
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

  const body = await request.json().catch(() => ({}));
  const boardId = await resolveBoardIdForTeam(team.id, body?.boardId);
  if (boardId == null) {
    return NextResponse.json({ error: 'Quadro não encontrado' }, { status: 404 });
  }
  const board = { id: boardId };

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const phase = normalizePhaseType(body?.phaseType);
  if (!name || !phase) {
    return NextResponse.json(
      { error: 'name e phaseType (INITIAL | PRODUCTION | FINAL) são obrigatórios' },
      { status: 400 },
    );
  }

  if (phase === 'INITIAL') {
    const n = await countPhaseOnBoard(board.id, 'INITIAL');
    if (n >= 1) {
      return NextResponse.json(
        { error: 'Já existe uma fase Inicial neste board. Altere a existente ou escolha outro tipo.' },
        { status: 400 },
      );
    }
  }

  let maxStayHours: number | null = null;
  if (body?.maxStayHours !== undefined && body?.maxStayHours !== null && body?.maxStayHours !== '') {
    const h = Number(body.maxStayHours);
    if (!Number.isFinite(h) || h < 1 || h > 8760) {
      return NextResponse.json(
        { error: 'maxStayHours deve ser um número entre 1 e 8760 (horas), ou vazio' },
        { status: 400 },
      );
    }
    maxStayHours = Math.floor(h);
  }

  let stripeColor: string | null = null;
  if (typeof body?.stripeColor === 'string' && body.stripeColor.trim()) {
    const sc = normalizeLabelColorForApi(body.stripeColor.trim());
    if (!sc.ok) {
      return NextResponse.json({ error: sc.error }, { status: 400 });
    }
    stripeColor = sc.value;
  }

  const description =
    typeof body?.description === 'string' && body.description.trim() ? body.description.trim() : null;

  const [maxPosRow] = await db
    .select({ position: taskflowColumns.position })
    .from(taskflowColumns)
    .where(eq(taskflowColumns.boardId, board.id))
    .orderBy(desc(taskflowColumns.position))
    .limit(1);
  const position = (maxPosRow?.position ?? 0) + 1;

  const [created] = await db
    .insert(taskflowColumns)
    .values({
      boardId: board.id,
      name,
      description,
      position,
      phaseType: phase,
      maxStayHours,
      stripeColor,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
