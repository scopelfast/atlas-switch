import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { isPostgresUndefinedTableError } from '@/lib/db/pg-errors';
import { reunifyMeetingHistory } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export const runtime = 'nodejs';

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

  try {
    const rows = await db
      .select()
      .from(reunifyMeetingHistory)
      .where(and(eq(reunifyMeetingHistory.teamId, team.id), eq(reunifyMeetingHistory.meetingId, meetingId)))
      .orderBy(desc(reunifyMeetingHistory.createdAt))
      .limit(50);
    return NextResponse.json(rows);
  } catch (e) {
    if (isPostgresUndefinedTableError(e)) {
      return NextResponse.json([]);
    }
    throw e;
  }
}
