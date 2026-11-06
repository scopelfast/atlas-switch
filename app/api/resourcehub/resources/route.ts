import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { resourcehubResources } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'resourcehub'))) {
    return NextResponse.json(
      { error: 'O módulo ResourceHub não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const resources = await db
    .select()
    .from(resourcehubResources)
    .where(eq(resourcehubResources.teamId, team.id))
    .orderBy(resourcehubResources.createdAt);

  return NextResponse.json(resources);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'resourcehub'))) {
    return NextResponse.json(
      { error: 'O módulo ResourceHub não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const type = typeof body?.type === 'string' ? body.type.trim() : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : 'DISPONIVEL';
  const capacityHoursPerWeek =
    typeof body?.capacityHoursPerWeek === 'number' ? body.capacityHoursPerWeek : 40;
  const costRateCents = typeof body?.costRateCents === 'number' ? body.costRateCents : 0;
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';

  if (!name || !type) {
    return NextResponse.json({ error: 'name e type são obrigatórios' }, { status: 400 });
  }

  const created = await db
    .insert(resourcehubResources)
    .values({
      teamId: team.id,
      name,
      type,
      status,
      capacityHoursPerWeek,
      costRateCents,
      notes: notes || null,
    })
    .returning();

  return NextResponse.json(created[0], { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'resourcehub'))) {
    return NextResponse.json(
      { error: 'O módulo ResourceHub não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const resource = await db
    .select()
    .from(resourcehubResources)
    .where(and(eq(resourcehubResources.id, id), eq(resourcehubResources.teamId, team.id)))
    .limit(1);

  if (!resource[0]) {
    return NextResponse.json({ error: 'Recurso não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(resourcehubResources)
    .set({
      name: typeof body?.name === 'string' ? body.name.trim() : resource[0].name,
      type: typeof body?.type === 'string' ? body.type.trim() : resource[0].type,
      status: typeof body?.status === 'string' ? body.status.trim() : resource[0].status,
      capacityHoursPerWeek:
        typeof body?.capacityHoursPerWeek === 'number'
          ? body.capacityHoursPerWeek
          : resource[0].capacityHoursPerWeek,
      costRateCents:
        typeof body?.costRateCents === 'number' ? body.costRateCents : resource[0].costRateCents,
      notes: typeof body?.notes === 'string' ? body.notes.trim() : resource[0].notes,
      updatedAt: new Date(),
    })
    .where(eq(resourcehubResources.id, id))
    .returning();

  return NextResponse.json(updated[0]);
}

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'resourcehub'))) {
    return NextResponse.json(
      { error: 'O módulo ResourceHub não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  await db
    .delete(resourcehubResources)
    .where(and(eq(resourcehubResources.id, id), eq(resourcehubResources.teamId, team.id)));

  return NextResponse.json({ ok: true });
}
