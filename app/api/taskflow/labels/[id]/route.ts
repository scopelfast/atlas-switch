import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { taskflowBoards, taskflowLabels, taskflowTaskLabels } from '@/lib/db/schema';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { normalizeLabelColorForApi } from '@/lib/taskflow/label-color';
import { normalizeLabelPriority } from '@/lib/taskflow/label-priority';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

async function assertLabelInTeam(labelId: number, teamId: number) {
  const rows = await db
    .select({ id: taskflowLabels.id })
    .from(taskflowLabels)
    .innerJoin(taskflowBoards, eq(taskflowLabels.boardId, taskflowBoards.id))
    .where(and(eq(taskflowLabels.id, labelId), eq(taskflowBoards.teamId, teamId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id: rawId } = await context.params;
  const labelId = Number(rawId);
  if (!Number.isFinite(labelId) || labelId < 1) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const owned = await assertLabelInTeam(labelId, team.id);
  if (!owned) {
    return NextResponse.json({ error: 'Label não encontrada' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const updates: Partial<{
    name: string;
    color: string;
    priority: string;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name não pode ser vazio' }, { status: 400 });
    }
    updates.name = name;
  }
  if (body.color !== undefined) {
    const raw =
      typeof body.color === 'string' && body.color.trim() ? body.color.trim() : 'slate';
    const colorNorm = normalizeLabelColorForApi(raw);
    if (!colorNorm.ok) {
      return NextResponse.json({ error: colorNorm.error }, { status: 400 });
    }
    updates.color = colorNorm.value;
  }
  if (body.priority !== undefined) {
    updates.priority = normalizeLabelPriority(body.priority);
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
  }

  const [updated] = await db
    .update(taskflowLabels)
    .set(updates)
    .where(eq(taskflowLabels.id, labelId))
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

  const { id: rawId } = await context.params;
  const labelId = Number(rawId);
  if (!Number.isFinite(labelId) || labelId < 1) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const owned = await assertLabelInTeam(labelId, team.id);
  if (!owned) {
    return NextResponse.json({ error: 'Label não encontrada' }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(taskflowTaskLabels).where(eq(taskflowTaskLabels.labelId, labelId));
    await tx.delete(taskflowLabels).where(eq(taskflowLabels.id, labelId));
  });

  return NextResponse.json({ ok: true });
}
