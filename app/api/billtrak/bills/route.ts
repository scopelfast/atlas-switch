import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { billtrakBills } from '@/lib/db/schema';
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

  const bills = await db
    .select()
    .from(billtrakBills)
    .where(eq(billtrakBills.teamId, team.id))
    .orderBy(billtrakBills.dueDate);

  return NextResponse.json(bills);
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
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const categoryId = body?.categoryId ? Number(body.categoryId) : null;
  const projectId = body?.projectId ? Number(body.projectId) : null;
  const status = typeof body?.status === 'string' ? body.status.trim() : 'PENDENTE';
  const amountCents = typeof body?.amountCents === 'number' ? body.amountCents : 0;
  const dueDate = typeof body?.dueDate === 'string' ? body.dueDate : '';
  const paidAt = typeof body?.paidAt === 'string' ? body.paidAt : null;
  const recurring = typeof body?.recurring === 'boolean' ? body.recurring : false;
  const recurrenceRule =
    typeof body?.recurrenceRule === 'string' ? body.recurrenceRule.trim() : null;
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : null;

  if (!title || !amountCents || !dueDate) {
    return NextResponse.json(
      { error: 'title, amountCents e dueDate são obrigatórios' },
      { status: 400 },
    );
  }

  const created = await db
    .insert(billtrakBills)
    .values({
      teamId: team.id,
      title,
      categoryId,
      projectId,
      status,
      amountCents,
      dueDate,
      paidAt: paidAt || null,
      recurring,
      recurrenceRule,
      notes,
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

  const bill = await db
    .select()
    .from(billtrakBills)
    .where(and(eq(billtrakBills.id, id), eq(billtrakBills.teamId, team.id)))
    .limit(1);

  if (!bill[0]) {
    return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });
  }

  const updated = await db
    .update(billtrakBills)
    .set({
      title: typeof body?.title === 'string' ? body.title.trim() : bill[0].title,
      categoryId: body?.categoryId ? Number(body.categoryId) : bill[0].categoryId,
      projectId: body?.projectId ? Number(body.projectId) : bill[0].projectId,
      status: typeof body?.status === 'string' ? body.status.trim() : bill[0].status,
      amountCents:
        typeof body?.amountCents === 'number' ? body.amountCents : bill[0].amountCents,
      dueDate: typeof body?.dueDate === 'string' ? body.dueDate : bill[0].dueDate,
      paidAt: typeof body?.paidAt === 'string' ? body.paidAt : bill[0].paidAt,
      recurring:
        typeof body?.recurring === 'boolean' ? body.recurring : bill[0].recurring,
      recurrenceRule:
        typeof body?.recurrenceRule === 'string'
          ? body.recurrenceRule.trim()
          : bill[0].recurrenceRule,
      notes: typeof body?.notes === 'string' ? body.notes.trim() : bill[0].notes,
      updatedAt: new Date(),
    })
    .where(eq(billtrakBills.id, id))
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
    .delete(billtrakBills)
    .where(and(eq(billtrakBills.id, id), eq(billtrakBills.teamId, team.id)));

  return NextResponse.json({ ok: true });
}
