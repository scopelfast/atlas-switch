import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { reunifyAgendaItems, reunifyMeetings } from '@/lib/db/schema';
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

  const agenda = await db
    .select()
    .from(reunifyAgendaItems)
    .where(eq(reunifyAgendaItems.meetingId, meetingId))
    .orderBy(reunifyAgendaItems.position);

  return NextResponse.json(agenda);
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
  const owner = typeof body?.owner === 'string' ? body.owner.trim() : '';
  const durationMinutes =
    typeof body?.durationMinutes === 'number' ? body.durationMinutes : null;
  const status = typeof body?.status === 'string' ? body.status.trim() : 'ABERTO';
  const position = typeof body?.position === 'number' ? body.position : 0;

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
    .insert(reunifyAgendaItems)
    .values({
      meetingId,
      title,
      owner: owner || null,
      durationMinutes,
      status,
      position,
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

  const item = await db
    .select()
    .from(reunifyAgendaItems)
    .where(eq(reunifyAgendaItems.id, id))
    .limit(1);

  if (!item[0]) {
    return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
  }

  const meeting = await ensureMeeting(team.id, item[0].meetingId);
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  const updated = await db
    .update(reunifyAgendaItems)
    .set({
      title: typeof body?.title === 'string' ? body.title.trim() : item[0].title,
      owner: typeof body?.owner === 'string' ? body.owner.trim() : item[0].owner,
      durationMinutes:
        typeof body?.durationMinutes === 'number'
          ? body.durationMinutes
          : item[0].durationMinutes,
      status: typeof body?.status === 'string' ? body.status.trim() : item[0].status,
      position: typeof body?.position === 'number' ? body.position : item[0].position,
      updatedAt: new Date(),
    })
    .where(eq(reunifyAgendaItems.id, id))
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

  const item = await db
    .select()
    .from(reunifyAgendaItems)
    .where(eq(reunifyAgendaItems.id, id))
    .limit(1);

  if (!item[0]) {
    return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
  }

  const meeting = await ensureMeeting(team.id, item[0].meetingId);
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  await db.delete(reunifyAgendaItems).where(eq(reunifyAgendaItems.id, id));
  return NextResponse.json({ ok: true });
}
