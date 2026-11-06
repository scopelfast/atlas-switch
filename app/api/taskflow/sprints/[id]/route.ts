import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowSprints } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
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
  const { id: raw } = await context.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }
  const [existing] = await db
    .select()
    .from(taskflowSprints)
    .where(and(eq(taskflowSprints.id, id), eq(taskflowSprints.teamId, team.id)))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Sprint não encontrado' }, { status: 404 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const updates: Partial<typeof taskflowSprints.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === 'string' && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (body.startAt !== undefined) {
    const d = new Date(String(body.startAt));
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'startAt inválido' }, { status: 400 });
    }
    updates.startAt = d;
  }
  if (body.endAt !== undefined) {
    const d = new Date(String(body.endAt));
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'endAt inválido' }, { status: 400 });
    }
    updates.endAt = d;
  }
  const startEff = (updates.startAt as Date | undefined) ?? existing.startAt;
  const endEff = (updates.endAt as Date | undefined) ?? existing.endAt;
  if (startEff >= endEff) {
    return NextResponse.json({ error: 'startAt deve ser anterior a endAt' }, { status: 400 });
  }
  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }
  const [row] = await db
    .update(taskflowSprints)
    .set(updates)
    .where(eq(taskflowSprints.id, id))
    .returning();
  return NextResponse.json(row);
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
  const { id: raw } = await context.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }
  const deleted = await db
    .delete(taskflowSprints)
    .where(and(eq(taskflowSprints.id, id), eq(taskflowSprints.teamId, team.id)))
    .returning({ id: taskflowSprints.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Sprint não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
