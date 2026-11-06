import { and, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isOwnerLike, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { isPostgresUndefinedColumnError } from '@/lib/db/pg-errors';
import { chronosAgendaItems } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

type AgendaReunifyRow = {
  id: number;
  date: string;
  startTime: string;
  title: string;
  reunifyMeetingId?: number | null;
  participantUserId?: number | null;
};

function fallbackKey(row: AgendaReunifyRow) {
  return `${row.date}::${row.startTime}::${row.title.trim().toLowerCase()}`;
}

export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isOwnerLike(normalizeRole(user.role))) {
    return NextResponse.json(
      { error: 'Apenas owner/admin podem deduplicar a agenda.' },
      { status: 403 },
    );
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'chronos'))) {
    return NextResponse.json(
      { error: 'O módulo Chronos não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  let rows: AgendaReunifyRow[] = [];
  let usingReunifyLink = true;

  try {
    rows = await db
      .select({
        id: chronosAgendaItems.id,
        date: chronosAgendaItems.date,
        startTime: chronosAgendaItems.startTime,
        title: chronosAgendaItems.title,
        reunifyMeetingId: chronosAgendaItems.reunifyMeetingId,
        participantUserId: chronosAgendaItems.participantUserId,
      })
      .from(chronosAgendaItems)
      .where(and(eq(chronosAgendaItems.teamId, team.id), eq(chronosAgendaItems.source, 'REUNIFY')))
      .orderBy(desc(chronosAgendaItems.id));
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) {
      console.error('[POST /api/chronos/agenda/dedupe-reunify]', e);
      return NextResponse.json({ error: 'Falha ao carregar agenda Reunify.' }, { status: 500 });
    }
    usingReunifyLink = false;
    rows = await db
      .select({
        id: chronosAgendaItems.id,
        date: chronosAgendaItems.date,
        startTime: chronosAgendaItems.startTime,
        title: chronosAgendaItems.title,
      })
      .from(chronosAgendaItems)
      .where(and(eq(chronosAgendaItems.teamId, team.id), eq(chronosAgendaItems.source, 'REUNIFY')))
      .orderBy(desc(chronosAgendaItems.id));
  }

  const keep = new Set<number>();
  const seen = new Set<string>();

  for (const row of rows) {
    const key =
      usingReunifyLink && row.reunifyMeetingId != null
        ? `meeting:${row.reunifyMeetingId}:participant:${row.participantUserId ?? 'none'}`
        : `fallback:${fallbackKey(row)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    keep.add(row.id);
  }

  const idsToDelete = rows.map((r) => r.id).filter((id) => !keep.has(id));
  if (idsToDelete.length > 0) {
    await db
      .delete(chronosAgendaItems)
      .where(
        and(
          eq(chronosAgendaItems.teamId, team.id),
          eq(chronosAgendaItems.source, 'REUNIFY'),
          inArray(chronosAgendaItems.id, idsToDelete),
        ),
      );
  }

  return NextResponse.json({
    scanned: rows.length,
    removed: idsToDelete.length,
    kept: keep.size,
  });
}

