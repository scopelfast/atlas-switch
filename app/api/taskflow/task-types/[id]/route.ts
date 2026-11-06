import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowTaskTypeDefinitions, taskflowTasks, taskflowBoards } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão para gerir tipos de tarefa.' }, { status: 403 });
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

  const typeId = Number((await context.params).id);
  if (!typeId) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(taskflowTaskTypeDefinitions)
    .where(
      and(
        eq(taskflowTaskTypeDefinitions.id, typeId),
        eq(taskflowTaskTypeDefinitions.teamId, team.id),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Tipo não encontrado' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Partial<typeof taskflowTaskTypeDefinitions.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof body?.name === 'string') {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: 'name não pode ser vazio' }, { status: 400 });
    }
    updates.name = name;
  }

  if (body?.description !== undefined) {
    updates.description =
      typeof body.description === 'string' ? body.description.trim() || null : null;
  }

  if (body?.position !== undefined && body?.position !== null && body?.position !== '') {
    const p = Number(body.position);
    if (!Number.isFinite(p)) {
      return NextResponse.json({ error: 'position inválido' }, { status: 400 });
    }
    updates.position = p;
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  const [updated] = await db
    .update(taskflowTaskTypeDefinitions)
    .set(updates)
    .where(eq(taskflowTaskTypeDefinitions.id, typeId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão para gerir tipos de tarefa.' }, { status: 403 });
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

  const typeId = Number((await context.params).id);
  if (!typeId) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await db
    .select({ code: taskflowTaskTypeDefinitions.code })
    .from(taskflowTaskTypeDefinitions)
    .where(
      and(
        eq(taskflowTaskTypeDefinitions.id, typeId),
        eq(taskflowTaskTypeDefinitions.teamId, team.id),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Tipo não encontrado' }, { status: 404 });
  }

  const code = existing[0].code;

  const [usage] = await db
    .select({ n: count() })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(eq(taskflowBoards.teamId, team.id), eq(taskflowTasks.taskType, code)),
    );

  if (Number(usage?.n ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Não é possível excluir: existem tarefas com este tipo.' },
      { status: 400 },
    );
  }

  await db.delete(taskflowTaskTypeDefinitions).where(eq(taskflowTaskTypeDefinitions.id, typeId));

  return NextResponse.json({ ok: true });
}
