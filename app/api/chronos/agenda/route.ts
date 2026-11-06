import { NextResponse } from 'next/server';
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import { hasPermission, isOwnerLike, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { isPostgresUndefinedColumnError, isPostgresUniqueViolationError } from '@/lib/db/pg-errors';
import { chronosAgendaItems, reunifyMeetings } from '@/lib/db/schema';
import { parseTaskflowReminderOffsetsCsv } from '@/lib/chronos/taskflow-task-mirror';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

function moduleDisabledResponse(moduleLabel: string) {
  return NextResponse.json(
    { error: `O módulo ${moduleLabel} não está habilitado no plano ativo deste time.` },
    { status: 403 },
  );
}

/** Colunas estáveis antes da M6.9 (fallback se migração `0036` não estiver na BD). */
const chronosAgendaBaseSelect = {
  id: chronosAgendaItems.id,
  teamId: chronosAgendaItems.teamId,
  date: chronosAgendaItems.date,
  startTime: chronosAgendaItems.startTime,
  endTime: chronosAgendaItems.endTime,
  durationMinutes: chronosAgendaItems.durationMinutes,
  title: chronosAgendaItems.title,
  description: chronosAgendaItems.description,
  type: chronosAgendaItems.type,
  location: chronosAgendaItems.location,
  reminderMinutes: chronosAgendaItems.reminderMinutes,
  recurrence: chronosAgendaItems.recurrence,
  timezone: chronosAgendaItems.timezone,
  source: chronosAgendaItems.source,
  status: chronosAgendaItems.status,
  createdAt: chronosAgendaItems.createdAt,
  updatedAt: chronosAgendaItems.updatedAt,
} as const;

/** Colunas após vínculo Reunify↔Chronos (fallback se migração `0058` não estiver na BD). */
const chronosAgendaSelectWithReunify = {
  ...chronosAgendaBaseSelect,
  reunifyMeetingId: chronosAgendaItems.reunifyMeetingId,
} as const;

const chronosAgendaSelectWithReunifyAndParticipant = {
  ...chronosAgendaSelectWithReunify,
  participantUserId: chronosAgendaItems.participantUserId,
} as const;

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function computeDurationMinutes(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) {
    return null;
  }
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) {
    return null;
  }
  return Math.max(0, end - start);
}

/**
 * Retorna a agenda do dia para o Chronos (MVP).
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'chronos'))) {
    return moduleDisabledResponse('Chronos');
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);
  const fromDate = from || defaultDate;
  const toDate = to || fromDate;

  const where = and(
    eq(chronosAgendaItems.teamId, team.id),
    gte(chronosAgendaItems.date, fromDate),
    lte(chronosAgendaItems.date, toDate),
  );
  const orderBy = [asc(chronosAgendaItems.date), asc(chronosAgendaItems.startTime)];

  let agenda: Array<
    Record<string, unknown> & {
      taskflowTaskId?: number | null;
      taskflowReminderOffsets?: string | null;
      reunifyMeetingId?: number | null;
      participantUserId?: number | null;
    }
  > = [];
  try {
    try {
      agenda = await db
        .select({
          ...chronosAgendaSelectWithReunifyAndParticipant,
          taskflowTaskId: chronosAgendaItems.taskflowTaskId,
          taskflowReminderOffsets: chronosAgendaItems.taskflowReminderOffsets,
        })
        .from(chronosAgendaItems)
        .where(where)
        .orderBy(...orderBy);
    } catch (e) {
      if (!isPostgresUndefinedColumnError(e)) {
        throw e;
      }
      try {
        agenda = await db
          .select({
            ...chronosAgendaBaseSelect,
            taskflowTaskId: chronosAgendaItems.taskflowTaskId,
            taskflowReminderOffsets: chronosAgendaItems.taskflowReminderOffsets,
          })
          .from(chronosAgendaItems)
          .where(where)
          .orderBy(...orderBy);
      } catch (e2) {
        if (!isPostgresUndefinedColumnError(e2)) {
          throw e2;
        }
        agenda = await db
          .select(chronosAgendaBaseSelect)
          .from(chronosAgendaItems)
          .where(where)
          .orderBy(...orderBy);
      }
    }
  } catch (e) {
    console.error('[GET /api/chronos/agenda]', e);
    return NextResponse.json({ error: 'Erro ao carregar a agenda' }, { status: 500 });
  }

  const filteredAgenda =
    isOwnerLike(user.role) || normalizeRole(user.role) === 'gestor'
      ? agenda
      : agenda.filter((row) => {
          const participantUserId = (row as { participantUserId?: number | null }).participantUserId ?? null;
          return participantUserId == null || participantUserId === user.id;
        });

  return NextResponse.json(
    filteredAgenda.map((row) => ({
      ...row,
      taskflowTaskId: row.taskflowTaskId ?? null,
      taskflowReminderOffsets: row.taskflowReminderOffsets ?? null,
      reunifyMeetingId: (row as { reunifyMeetingId?: number | null }).reunifyMeetingId ?? null,
      participantUserId: (row as { participantUserId?: number | null }).participantUserId ?? null,
      reminderOffsetsMinutes: parseTaskflowReminderOffsetsCsv(row.taskflowReminderOffsets ?? null),
    })),
  );
}

/**
 * Cria um compromisso para o Chronos (MVP).
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!hasPermission(normalizeRole(user.role), 'chronos.view')) {
    return NextResponse.json({ error: 'Sem permissão para criar compromissos no Chronos.' }, { status: 403 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'chronos'))) {
    return moduleDisabledResponse('Chronos');
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const date = typeof body?.date === 'string' ? body.date.trim() : '';
  const startTime = typeof body?.startTime === 'string' ? body.startTime.trim() : '';
  const endTime = typeof body?.endTime === 'string' ? body.endTime.trim() : '';
  const durationMinutes =
    typeof body?.durationMinutes === 'number'
      ? body.durationMinutes
      : computeDurationMinutes(startTime, endTime);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const type = typeof body?.type === 'string' ? body.type.trim() : '';
  const location = typeof body?.location === 'string' ? body.location.trim() : '';
  const reminderMinutes = typeof body?.reminderMinutes === 'number' ? body.reminderMinutes : null;
  const recurrence = typeof body?.recurrence === 'string' ? body.recurrence.trim() : null;
  const timezone = typeof body?.timezone === 'string' ? body.timezone.trim() : null;
  const source = typeof body?.source === 'string' ? body.source.trim() : 'MANUAL';
  const status = typeof body?.status === 'string' ? body.status.trim() : 'AGENDADO';
  const rawParticipantUserId = body?.participantUserId;
  let participantUserId: number | null = null;
  if (typeof rawParticipantUserId === 'number' && Number.isInteger(rawParticipantUserId) && rawParticipantUserId > 0) {
    participantUserId = rawParticipantUserId;
  } else if (
    typeof rawParticipantUserId === 'string' &&
    /^\d+$/.test(rawParticipantUserId.trim())
  ) {
    participantUserId = Number(rawParticipantUserId.trim());
  }

  const rawReunify = body?.reunifyMeetingId;
  let reunifyMeetingId: number | null = null;
  if (typeof rawReunify === 'number' && Number.isInteger(rawReunify) && rawReunify > 0) {
    reunifyMeetingId = rawReunify;
  } else if (typeof rawReunify === 'string' && /^\d+$/.test(rawReunify.trim())) {
    reunifyMeetingId = Number(rawReunify.trim());
  }

  if (!date || !startTime || !title || !type) {
    return NextResponse.json(
      { error: 'date, startTime, title e type são obrigatórios' },
      { status: 400 },
    );
  }

  if (reunifyMeetingId != null) {
    const [meetingOk] = await db
      .select({ id: reunifyMeetings.id })
      .from(reunifyMeetings)
      .where(and(eq(reunifyMeetings.id, reunifyMeetingId), eq(reunifyMeetings.teamId, team.id)))
      .limit(1);
    if (!meetingOk) {
      return NextResponse.json({ error: 'reunifyMeetingId inválido ou de outro time.' }, { status: 400 });
    }
  }

  const returningColsBase = {
    id: chronosAgendaItems.id,
    date: chronosAgendaItems.date,
    startTime: chronosAgendaItems.startTime,
    endTime: chronosAgendaItems.endTime,
    durationMinutes: chronosAgendaItems.durationMinutes,
    title: chronosAgendaItems.title,
    description: chronosAgendaItems.description,
    type: chronosAgendaItems.type,
    location: chronosAgendaItems.location,
    reminderMinutes: chronosAgendaItems.reminderMinutes,
    recurrence: chronosAgendaItems.recurrence,
    timezone: chronosAgendaItems.timezone,
    source: chronosAgendaItems.source,
    status: chronosAgendaItems.status,
  } as const;
  const returningColsWithReunify = {
    ...returningColsBase,
    reunifyMeetingId: chronosAgendaItems.reunifyMeetingId,
    participantUserId: chronosAgendaItems.participantUserId,
  } as const;

  let canUseReunifyLinkColumn = reunifyMeetingId != null;
  if (canUseReunifyLinkColumn && reunifyMeetingId != null) {
    try {
      const participantWhere =
        participantUserId == null
          ? isNull(chronosAgendaItems.participantUserId)
          : eq(chronosAgendaItems.participantUserId, participantUserId);
      const [already] = await db
        .select(returningColsWithReunify)
        .from(chronosAgendaItems)
        .where(
          and(
            eq(chronosAgendaItems.teamId, team.id),
            eq(chronosAgendaItems.reunifyMeetingId, reunifyMeetingId),
            participantWhere,
          ),
        )
        .limit(1);
      if (already) {
        return NextResponse.json({ ...already, idempotent: true as const }, { status: 200 });
      }
    } catch (e) {
      if (!isPostgresUndefinedColumnError(e)) {
        console.error('[POST /api/chronos/agenda] dedupe reunify', e);
        return NextResponse.json({ error: 'Erro ao criar compromisso na agenda' }, { status: 500 });
      }
      canUseReunifyLinkColumn = false;
    }
  }

  if (!canUseReunifyLinkColumn && reunifyMeetingId != null) {
    const [meetingForFallback] = await db
      .select({
        id: reunifyMeetings.id,
        date: reunifyMeetings.date,
        startTime: reunifyMeetings.startTime,
        endTime: reunifyMeetings.endTime,
        title: reunifyMeetings.title,
      })
      .from(reunifyMeetings)
      .where(and(eq(reunifyMeetings.id, reunifyMeetingId), eq(reunifyMeetings.teamId, team.id)))
      .limit(1);

    if (meetingForFallback) {
      const [alreadyFallback] = await db
        .select(returningColsBase)
        .from(chronosAgendaItems)
        .where(
          and(
            eq(chronosAgendaItems.teamId, team.id),
            eq(chronosAgendaItems.source, 'REUNIFY'),
            eq(chronosAgendaItems.date, meetingForFallback.date),
            eq(chronosAgendaItems.startTime, meetingForFallback.startTime),
            eq(chronosAgendaItems.title, meetingForFallback.title),
          ),
        )
        .limit(1);
      if (alreadyFallback) {
        return NextResponse.json({ ...alreadyFallback, idempotent: true as const }, { status: 200 });
      }
    }
  }

  try {
    const insertValues = {
      teamId: team.id,
      date,
      startTime,
      endTime: endTime || null,
      durationMinutes,
      title,
      description: description || null,
      type,
      location: location || null,
      reminderMinutes,
      recurrence,
      timezone: timezone || null,
      source,
      status,
      ...(participantUserId != null ? { participantUserId } : {}),
      ...(canUseReunifyLinkColumn && reunifyMeetingId != null ? { reunifyMeetingId } : {}),
    };

    let created: Array<Record<string, unknown>>;
    try {
      created = await db
        .insert(chronosAgendaItems)
        .values(insertValues)
        .returning(canUseReunifyLinkColumn ? returningColsWithReunify : returningColsBase);
    } catch (e) {
      if (!(canUseReunifyLinkColumn && isPostgresUndefinedColumnError(e))) {
        throw e;
      }
      created = await db
        .insert(chronosAgendaItems)
        .values({
          teamId: team.id,
          date,
          startTime,
          endTime: endTime || null,
          durationMinutes,
          title,
          description: description || null,
          type,
          location: location || null,
          reminderMinutes,
          recurrence,
          timezone: timezone || null,
          source,
          status,
        })
        .returning(returningColsBase);
    }

    return NextResponse.json(created[0], { status: 201 });
  } catch (e) {
    if (canUseReunifyLinkColumn && reunifyMeetingId != null && isPostgresUniqueViolationError(e)) {
      try {
        const participantWhere =
          participantUserId == null
            ? isNull(chronosAgendaItems.participantUserId)
            : eq(chronosAgendaItems.participantUserId, participantUserId);
        const [row] = await db
          .select(returningColsWithReunify)
          .from(chronosAgendaItems)
          .where(
            and(
              eq(chronosAgendaItems.teamId, team.id),
              eq(chronosAgendaItems.reunifyMeetingId, reunifyMeetingId),
              participantWhere,
            ),
          )
          .limit(1);
        if (row) {
          return NextResponse.json({ ...row, idempotent: true as const }, { status: 200 });
        }
      } catch (e2) {
        if (!isPostgresUndefinedColumnError(e2)) {
          console.error('[POST /api/chronos/agenda] unique reunify', e2);
          return NextResponse.json({ error: 'Erro ao criar compromisso na agenda' }, { status: 500 });
        }
      }
    }
    console.error('[POST /api/chronos/agenda]', e);
    return NextResponse.json({ error: 'Erro ao criar compromisso na agenda' }, { status: 500 });
  }
}

/**
 * Atualiza um compromisso do Chronos.
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
  if (!(await teamHasModuleEnabled(team.id, 'chronos'))) {
    return moduleDisabledResponse('Chronos');
  }

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  let existing: typeof chronosAgendaItems.$inferSelect[];
  try {
    existing = await db
      .select()
      .from(chronosAgendaItems)
      .where(and(eq(chronosAgendaItems.id, id), eq(chronosAgendaItems.teamId, team.id)))
      .limit(1);
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) {
      console.error('[PATCH /api/chronos/agenda]', e);
      return NextResponse.json({ error: 'Erro ao carregar o compromisso' }, { status: 500 });
    }
    const base = await db
      .select(chronosAgendaBaseSelect)
      .from(chronosAgendaItems)
      .where(and(eq(chronosAgendaItems.id, id), eq(chronosAgendaItems.teamId, team.id)))
      .limit(1);
    existing = base.map((row) => ({
      ...row,
      taskflowTaskId: null,
      taskflowReminderOffsets: null,
    })) as typeof chronosAgendaItems.$inferSelect[];
  }

  if (!existing[0]) {
    return NextResponse.json({ error: 'Compromisso não encontrado' }, { status: 404 });
  }

  if (existing[0].taskflowTaskId != null) {
    return NextResponse.json(
      {
        error:
          'Este compromisso é espelhado pelo Taskflow; altere o prazo ou o título na tarefa correspondente.',
      },
      { status: 400 },
    );
  }

  const date = typeof body?.date === 'string' ? body.date.trim() : null;
  const startTime = typeof body?.startTime === 'string' ? body.startTime.trim() : null;
  const endTime = typeof body?.endTime === 'string' ? body.endTime.trim() : null;
  const durationMinutes =
    typeof body?.durationMinutes === 'number'
      ? body.durationMinutes
      : computeDurationMinutes(startTime || existing[0].startTime, endTime);

  const updated = await db
    .update(chronosAgendaItems)
    .set({
      date: date || existing[0].date,
      startTime: startTime || existing[0].startTime,
      endTime: endTime ?? existing[0].endTime,
      durationMinutes: durationMinutes ?? existing[0].durationMinutes,
      title: typeof body?.title === 'string' ? body.title.trim() : existing[0].title,
      description:
        typeof body?.description === 'string'
          ? body.description.trim()
          : existing[0].description,
      type: typeof body?.type === 'string' ? body.type.trim() : existing[0].type,
      location:
        typeof body?.location === 'string' ? body.location.trim() : existing[0].location,
      reminderMinutes:
        typeof body?.reminderMinutes === 'number'
          ? body.reminderMinutes
          : existing[0].reminderMinutes,
      recurrence:
        typeof body?.recurrence === 'string' ? body.recurrence.trim() : existing[0].recurrence,
      timezone:
        typeof body?.timezone === 'string' ? body.timezone.trim() : existing[0].timezone,
      source: typeof body?.source === 'string' ? body.source.trim() : existing[0].source,
      status: typeof body?.status === 'string' ? body.status.trim() : existing[0].status,
      updatedAt: new Date(),
    })
    .where(eq(chronosAgendaItems.id, id))
    .returning({
      id: chronosAgendaItems.id,
      date: chronosAgendaItems.date,
      startTime: chronosAgendaItems.startTime,
      endTime: chronosAgendaItems.endTime,
      durationMinutes: chronosAgendaItems.durationMinutes,
      title: chronosAgendaItems.title,
      description: chronosAgendaItems.description,
      type: chronosAgendaItems.type,
      location: chronosAgendaItems.location,
      reminderMinutes: chronosAgendaItems.reminderMinutes,
      recurrence: chronosAgendaItems.recurrence,
      timezone: chronosAgendaItems.timezone,
      source: chronosAgendaItems.source,
      status: chronosAgendaItems.status,
    });

  return NextResponse.json(updated[0]);
}

/**
 * Remove um compromisso do Chronos.
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
  if (!(await teamHasModuleEnabled(team.id, 'chronos'))) {
    return moduleDisabledResponse('Chronos');
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  let id = idParam ? Number(idParam) : NaN;

  if (!id || Number.isNaN(id)) {
    try {
      const body = await request.json();
      id = Number(body?.id);
    } catch {
      id = NaN;
    }
  }

  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  await db
    .delete(chronosAgendaItems)
    .where(and(eq(chronosAgendaItems.id, id), eq(chronosAgendaItems.teamId, team.id)));

  return NextResponse.json({ ok: true });
}
