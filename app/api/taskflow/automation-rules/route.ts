import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { taskflowAdvancedRules } from '@/lib/db/schema';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * Lista regras avançadas do Taskflow.
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

  const rules = await db
    .select()
    .from(taskflowAdvancedRules)
    .where(eq(taskflowAdvancedRules.teamId, team.id))
    .orderBy(taskflowAdvancedRules.createdAt);

  return NextResponse.json(rules);
}

/**
 * Cria uma regra avançada.
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
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const dueInDays = body?.dueInDays !== undefined ? Number(body.dueInDays) : null;
  const priorityEquals =
    typeof body?.priorityEquals === 'string' ? body.priorityEquals : null;
  const assigneeMissing = Boolean(body?.assigneeMissing);
  const actionSetPriority =
    typeof body?.actionSetPriority === 'string' ? body.actionSetPriority : null;
  const actionAssignCreator = Boolean(body?.actionAssignCreator);

  if (!name) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
  }

  const created = await db
    .insert(taskflowAdvancedRules)
    .values({
      teamId: team.id,
      name,
      enabled: true,
      dueInDays: Number.isFinite(dueInDays) ? dueInDays : null,
      priorityEquals,
      assigneeMissing,
      actionSetPriority,
      actionAssignCreator,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json(created[0], { status: 201 });
}

/**
 * Atualiza uma regra avançada.
 */
export async function PATCH(request: Request) {
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
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const updates: Partial<typeof taskflowAdvancedRules.$inferInsert> = {};
  if (typeof body?.name === 'string') {
    updates.name = body.name.trim();
  }
  if (body?.enabled !== undefined) {
    updates.enabled = Boolean(body.enabled);
  }
  if (body?.dueInDays !== undefined) {
    updates.dueInDays = body.dueInDays === null ? null : Number(body.dueInDays);
  }
  if (body?.priorityEquals !== undefined) {
    updates.priorityEquals = body.priorityEquals || null;
  }
  if (body?.assigneeMissing !== undefined) {
    updates.assigneeMissing = Boolean(body.assigneeMissing);
  }
  if (body?.actionSetPriority !== undefined) {
    updates.actionSetPriority = body.actionSetPriority || null;
  }
  if (body?.actionAssignCreator !== undefined) {
    updates.actionAssignCreator = Boolean(body.actionAssignCreator);
  }

  const updated = await db
    .update(taskflowAdvancedRules)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(taskflowAdvancedRules.id, id), eq(taskflowAdvancedRules.teamId, team.id)))
    .returning();

  return NextResponse.json(updated[0]);
}

/**
 * Remove uma regra avançada.
 */
export async function DELETE(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  await db
    .delete(taskflowAdvancedRules)
    .where(and(eq(taskflowAdvancedRules.id, id), eq(taskflowAdvancedRules.teamId, team.id)));

  return NextResponse.json({ ok: true });
}
