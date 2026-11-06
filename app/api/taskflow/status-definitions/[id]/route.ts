import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowStatusDefinitions, taskflowTasks } from '@/lib/db/schema';
import { normalizeLabelColorForApi } from '@/lib/taskflow/label-color';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão para gerir o catálogo de status.' }, { status: 403 });
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

  const statusId = Number((await context.params).id);
  if (!statusId) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(taskflowStatusDefinitions)
    .where(
      and(
        eq(taskflowStatusDefinitions.id, statusId),
        eq(taskflowStatusDefinitions.teamId, team.id),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Status não encontrado' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Partial<typeof taskflowStatusDefinitions.$inferInsert> = {
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

  if (typeof body?.color === 'string') {
    const colorNorm = normalizeLabelColorForApi(body.color);
    if (!colorNorm.ok) {
      return NextResponse.json({ error: colorNorm.error }, { status: 400 });
    }
    updates.color = colorNorm.value;
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
    .update(taskflowStatusDefinitions)
    .set(updates)
    .where(eq(taskflowStatusDefinitions.id, statusId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão para gerir o catálogo de status.' }, { status: 403 });
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

  const statusId = Number((await context.params).id);
  if (!statusId) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await db
    .select({ id: taskflowStatusDefinitions.id })
    .from(taskflowStatusDefinitions)
    .where(
      and(
        eq(taskflowStatusDefinitions.id, statusId),
        eq(taskflowStatusDefinitions.teamId, team.id),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Status não encontrado' }, { status: 404 });
  }

  const [usage] = await db
    .select({ n: count() })
    .from(taskflowTasks)
    .where(eq(taskflowTasks.statusId, statusId));

  if (Number(usage?.n ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Não é possível excluir: existem tarefas com este status.' },
      { status: 400 },
    );
  }

  await db.delete(taskflowStatusDefinitions).where(eq(taskflowStatusDefinitions.id, statusId));

  return NextResponse.json({ ok: true });
}
