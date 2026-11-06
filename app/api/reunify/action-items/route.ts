import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { reunifyActionItems, reunifyMeetings } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

async function ensureMeeting(teamId: number, meetingId: number) {
  const meeting = await db
    .select({ id: reunifyMeetings.id })
    .from(reunifyMeetings)
    .where(and(eq(reunifyMeetings.id, meetingId), eq(reunifyMeetings.teamId, teamId)))
    .limit(1);
  return meeting[0];
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const meetingId = Number(searchParams.get('meetingId'));
  if (!meetingId) {
    return NextResponse.json({ error: 'meetingId é obrigatório' }, { status: 400 });
  }

  const meeting = await ensureMeeting(team.id, meetingId);
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  const actions = await db
    .select()
    .from(reunifyActionItems)
    .where(eq(reunifyActionItems.meetingId, meetingId))
    .orderBy(reunifyActionItems.createdAt);

  return NextResponse.json(actions);
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
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const meetingId = Number(body?.meetingId);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const ownerId = body?.ownerId ? Number(body.ownerId) : null;
  const dueDate = typeof body?.dueDate === 'string' ? body.dueDate : null;
  const status = typeof body?.status === 'string' ? body.status.trim() : 'ABERTO';
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';

  if (!meetingId || !title) {
    return NextResponse.json(
      { error: 'meetingId e title são obrigatórios' },
      { status: 400 },
    );
  }

  const meeting = await ensureMeeting(team.id, meetingId);
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  const created = await db
    .insert(reunifyActionItems)
    .values({
      meetingId,
      title,
      ownerId,
      dueDate: dueDate || null,
      status,
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
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const action = await db
    .select()
    .from(reunifyActionItems)
    .where(eq(reunifyActionItems.id, id))
    .limit(1);

  if (!action[0]) {
    return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 });
  }

  const meeting = await ensureMeeting(team.id, action[0].meetingId);
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  const updated = await db
    .update(reunifyActionItems)
    .set({
      title: typeof body?.title === 'string' ? body.title.trim() : action[0].title,
      ownerId: body?.ownerId ? Number(body.ownerId) : action[0].ownerId,
      dueDate:
        typeof body?.dueDate === 'string' ? body.dueDate : action[0].dueDate,
      status: typeof body?.status === 'string' ? body.status.trim() : action[0].status,
      notes: typeof body?.notes === 'string' ? body.notes.trim() : action[0].notes,
      updatedAt: new Date(),
    })
    .where(eq(reunifyActionItems.id, id))
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
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const action = await db
    .select()
    .from(reunifyActionItems)
    .where(eq(reunifyActionItems.id, id))
    .limit(1);

  if (!action[0]) {
    return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 });
  }

  const meeting = await ensureMeeting(team.id, action[0].meetingId);
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  await db.delete(reunifyActionItems).where(eq(reunifyActionItems.id, id));
  return NextResponse.json({ ok: true });
}
