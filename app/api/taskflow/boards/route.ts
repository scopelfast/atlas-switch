import { NextResponse } from 'next/server';
import { canConfigureTaskflowBoard, hasPermission, normalizeRole } from '@/lib/auth/permissions';
import {
  createBoard,
  ensureDefaultBoard,
  getBoardData,
  listTaskflowBoardSummaries,
} from '@/lib/db/taskflow';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';

/**
 * `GET` — dados do quadro (por omissão o mais recente do time).
 * `GET ?list=1` — lista de quadros (E8.8).
 * `GET ?boardId=` — quadro explícito do time.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const role = normalizeRole(user.role);
  if (!hasPermission(role, 'taskflow.view')) {
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

  const url = new URL(request.url);
  if (url.searchParams.get('list') === '1') {
    try {
      await ensureDefaultBoard(team.id);
      const boards = await listTaskflowBoardSummaries(team.id);
      return NextResponse.json({ boards });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao listar quadros';
      console.error('[GET /api/taskflow/boards?list=1]', e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const boardIdRaw = url.searchParams.get('boardId');
  let boardId: number | undefined;
  if (boardIdRaw != null && boardIdRaw !== '') {
    const n = Number(boardIdRaw);
    if (Number.isFinite(n) && n > 0) {
      boardId = n;
    }
  }

  try {
    await ensureDefaultBoard(team.id);
    const vis = taskflowBoardOptionsForUser(user.id, user.role);
    const data = await getBoardData(team.id, { ...vis, boardId });

    if (!data) {
      return NextResponse.json({ error: 'Quadro não encontrado' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno ao carregar o board';
    console.error('[GET /api/taskflow/boards]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Cria um novo board Taskflow para o time (colunas padrão).
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const role = normalizeRole(user.role);
  if (!canConfigureTaskflowBoard(role)) {
    return NextResponse.json({ error: 'Sem permissão para configurar o Taskflow.' }, { status: 403 });
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
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description : null;

  if (!name) {
    return NextResponse.json({ error: 'Nome do board é obrigatório' }, { status: 400 });
  }

  const board = await createBoard(team.id, { name, description });

  return NextResponse.json(board, { status: 201 });
}
