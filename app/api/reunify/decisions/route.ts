import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { reunifyDecisions, reunifyMeetings } from '@/lib/db/schema';
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

  const decisions = await db
    .select()
    .from(reunifyDecisions)
    .where(eq(reunifyDecisions.meetingId, meetingId))
    .orderBy(reunifyDecisions.createdAt);

  return NextResponse.json(decisions);
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
    .insert(reunifyDecisions)
    .values({
      meetingId,
      title,
      owner: owner || null,
      decidedAt: new Date(),
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

  const decision = await db
    .select()
    .from(reunifyDecisions)
    .where(eq(reunifyDecisions.id, id))
    .limit(1);

  if (!decision[0]) {
    return NextResponse.json({ error: 'Decisão não encontrada' }, { status: 404 });
  }

  const meeting = await ensureMeeting(team.id, decision[0].meetingId);
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  await db.delete(reunifyDecisions).where(eq(reunifyDecisions.id, id));
  return NextResponse.json({ ok: true });
}
