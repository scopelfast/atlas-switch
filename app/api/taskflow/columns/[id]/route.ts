import { NextResponse } from 'next/server';
import { and, count, eq, ne } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowBoards, taskflowColumns, taskflowTasks } from '@/lib/db/schema';
import { type PhaseType, normalizePhaseType } from '@/lib/taskflow/column-phase';
import { normalizeLabelColorForApi } from '@/lib/taskflow/label-color';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

async function columnOwnedByTeam(columnId: number, teamId: number) {
  const rows = await db
    .select({ col: taskflowColumns })
    .from(taskflowColumns)
    .innerJoin(taskflowBoards, eq(taskflowColumns.boardId, taskflowBoards.id))
    .where(
      and(eq(taskflowColumns.id, columnId), eq(taskflowBoards.teamId, teamId)),
    )
    .limit(1);
  return rows[0]?.col ?? null;
}

async function countPhaseOnBoard(boardId: number, phase: PhaseType, excludeColumnId: number) {
  const [row] = await db
    .select({ c: count() })
    .from(taskflowColumns)
    .where(
      and(
        eq(taskflowColumns.boardId, boardId),
        eq(taskflowColumns.phaseType, phase),
        ne(taskflowColumns.id, excludeColumnId),
      ),
    );
  return Number(row?.c ?? 0);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id: raw } = await context.params;
  const columnId = Number(raw);
  if (!Number.isFinite(columnId) || columnId < 1) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await columnOwnedByTeam(columnId, team.id);
  if (!existing) {
    return NextResponse.json({ error: 'Fase não encontrada' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const updates: Partial<{
    name: string;
    description: string | null;
    phaseType: string;
    maxStayHours: number | null;
    stripeColor: string | null;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name não pode ser vazio' }, { status: 400 });
    }
    updates.name = name;
  }
  if (body.description !== undefined) {
    updates.description =
      typeof body.description === 'string' && body.description.trim()
        ? String(body.description).trim()
        : null;
  }
  if (body.phaseType !== undefined) {
    const phase = normalizePhaseType(body.phaseType);
    if (!phase) {
      return NextResponse.json({ error: 'phaseType inválido' }, { status: 400 });
    }
    if (phase === 'INITIAL') {
      const others = await countPhaseOnBoard(existing.boardId, 'INITIAL', columnId);
      if (others >= 1) {
        return NextResponse.json(
          { error: 'Já existe outra fase Inicial neste board.' },
          { status: 400 },
        );
      }
    }
    updates.phaseType = phase;
  }
  if (body.maxStayHours !== undefined) {
    if (body.maxStayHours === null || body.maxStayHours === '') {
      updates.maxStayHours = null;
    } else {
      const h = Number(body.maxStayHours);
      if (!Number.isFinite(h) || h < 1 || h > 8760) {
        return NextResponse.json(
          { error: 'maxStayHours deve ser entre 1 e 8760 ou vazio' },
          { status: 400 },
        );
      }
      updates.maxStayHours = Math.floor(h);
    }
  }
  if (body.stripeColor !== undefined) {
    if (body.stripeColor === null || body.stripeColor === '') {
      updates.stripeColor = null;
    } else if (typeof body.stripeColor === 'string') {
      const sc = normalizeLabelColorForApi(body.stripeColor.trim());
      if (!sc.ok) {
        return NextResponse.json({ error: sc.error }, { status: 400 });
      }
      updates.stripeColor = sc.value;
    }
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
  }

  const [updated] = await db
    .update(taskflowColumns)
    .set(updates)
    .where(eq(taskflowColumns.id, columnId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id: raw } = await context.params;
  const columnId = Number(raw);
  if (!Number.isFinite(columnId) || columnId < 1) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await columnOwnedByTeam(columnId, team.id);
  if (!existing) {
    return NextResponse.json({ error: 'Fase não encontrada' }, { status: 404 });
  }

  const [taskCount] = await db
    .select({ c: count() })
    .from(taskflowTasks)
    .where(eq(taskflowTasks.columnId, columnId));

  if (Number(taskCount?.c ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Não é possível excluir: existem tarefas nesta fase. Mova-as primeiro.' },
      { status: 400 },
    );
  }

  await db.delete(taskflowColumns).where(eq(taskflowColumns.id, columnId));

  return NextResponse.json({ ok: true });
}
