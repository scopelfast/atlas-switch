import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { billtrakTransactions } from '@/lib/db/schema';
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

  const transactions = await db
    .select()
    .from(billtrakTransactions)
    .where(eq(billtrakTransactions.teamId, team.id))
    .orderBy(billtrakTransactions.occurredAt);

  return NextResponse.json(transactions);
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
  const accountId = body?.accountId ? Number(body.accountId) : null;
  const billId = body?.billId ? Number(body.billId) : null;
  const type = typeof body?.type === 'string' ? body.type.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const amountCents = typeof body?.amountCents === 'number' ? body.amountCents : 0;
  const occurredAt = typeof body?.occurredAt === 'string' ? body.occurredAt : '';

  if (!type || !description || !amountCents || !occurredAt) {
    return NextResponse.json(
      { error: 'type, description, amountCents e occurredAt são obrigatórios' },
      { status: 400 },
    );
  }

  const created = await db
    .insert(billtrakTransactions)
    .values({
      teamId: team.id,
      accountId,
      billId,
      type,
      description,
      amountCents,
      occurredAt,
    })
    .returning();

  return NextResponse.json(created[0], { status: 201 });
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
    .delete(billtrakTransactions)
    .where(and(eq(billtrakTransactions.id, id), eq(billtrakTransactions.teamId, team.id)));

  return NextResponse.json({ ok: true });
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

  const tx = await db
    .select()
    .from(billtrakTransactions)
    .where(and(eq(billtrakTransactions.id, id), eq(billtrakTransactions.teamId, team.id)))
    .limit(1);

  if (!tx[0]) {
    return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 });
  }

  const updated = await db
    .update(billtrakTransactions)
    .set({
      accountId: body?.accountId ? Number(body.accountId) : tx[0].accountId,
      billId: body?.billId ? Number(body.billId) : tx[0].billId,
      type: typeof body?.type === 'string' ? body.type.trim() : tx[0].type,
      description:
        typeof body?.description === 'string' ? body.description.trim() : tx[0].description,
      amountCents:
        typeof body?.amountCents === 'number' ? body.amountCents : tx[0].amountCents,
      occurredAt: typeof body?.occurredAt === 'string' ? body.occurredAt : tx[0].occurredAt,
    })
    .where(eq(billtrakTransactions.id, id))
    .returning();

  return NextResponse.json(updated[0]);
}
