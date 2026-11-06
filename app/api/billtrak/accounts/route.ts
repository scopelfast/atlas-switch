import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { billtrakAccounts } from '@/lib/db/schema';
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
  if (!(await teamHasModuleEnabled(team.id, 'billtrak'))) {
    return NextResponse.json(
      { error: 'O módulo BillTrak não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const accounts = await db
    .select()
    .from(billtrakAccounts)
    .where(eq(billtrakAccounts.teamId, team.id))
    .orderBy(billtrakAccounts.createdAt);

  return NextResponse.json(accounts);
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
  if (!(await teamHasModuleEnabled(team.id, 'billtrak'))) {
    return NextResponse.json(
      { error: 'O módulo BillTrak não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const type = typeof body?.type === 'string' ? body.type.trim() : '';
  const balanceCents = typeof body?.balanceCents === 'number' ? body.balanceCents : 0;

  if (!name || !type) {
    return NextResponse.json({ error: 'name e type são obrigatórios' }, { status: 400 });
  }

  const created = await db
    .insert(billtrakAccounts)
    .values({
      teamId: team.id,
      name,
      type,
      balanceCents,
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
  if (!(await teamHasModuleEnabled(team.id, 'billtrak'))) {
    return NextResponse.json(
      { error: 'O módulo BillTrak não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const account = await db
    .select()
    .from(billtrakAccounts)
    .where(and(eq(billtrakAccounts.id, id), eq(billtrakAccounts.teamId, team.id)))
    .limit(1);

  if (!account[0]) {
    return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });
  }

  const updated = await db
    .update(billtrakAccounts)
    .set({
      name: typeof body?.name === 'string' ? body.name.trim() : account[0].name,
      type: typeof body?.type === 'string' ? body.type.trim() : account[0].type,
      balanceCents:
        typeof body?.balanceCents === 'number' ? body.balanceCents : account[0].balanceCents,
      updatedAt: new Date(),
    })
    .where(eq(billtrakAccounts.id, id))
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
  if (!(await teamHasModuleEnabled(team.id, 'billtrak'))) {
    return NextResponse.json(
      { error: 'O módulo BillTrak não está habilitado no plano ativo deste time.' },
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
    .delete(billtrakAccounts)
    .where(and(eq(billtrakAccounts.id, id), eq(billtrakAccounts.teamId, team.id)));

  return NextResponse.json({ ok: true });
}
