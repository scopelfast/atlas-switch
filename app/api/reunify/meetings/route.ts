import { NextResponse } from 'next/server';
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { recordIntegrationSyncEvent } from '@/lib/db/integration-sync-events';
import { isPostgresUndefinedColumnError, isPostgresUndefinedTableError } from '@/lib/db/pg-errors';
import { unlinkUploadFilesForMeeting } from '@/lib/db/reunify-meeting-captures';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  chronosAgendaItems,
  reunifyMeetingHistory,
  reunifyMeetingParticipants,
  reunifyMeetings,
  teamMembers,
} from '@/lib/db/schema';

export const runtime = 'nodejs';

function moduleDisabledResponse(moduleLabel: string) {
  return NextResponse.json(
    { error: `O módulo ${moduleLabel} não está habilitado no plano ativo deste time.` },
    { status: 403 },
  );
}

type ReunifyMeetingRow = {
  id: number;
  date: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  title: string;
  status: string;
  cancelReason: string | null;
  canceledAt: Date | null;
  canceledByUserId: number | null;
  rescheduledFromMeetingId: number | null;
  location: string | null;
  summary: string | null;
};

type ReunifyMeetingWithParticipants = ReunifyMeetingRow & {
  participantUserIds: number[];
  participantCount: number;
};

function isScheduledMeetingStatus(status: string) {
  return status.trim().toUpperCase() === 'AGENDADA';
}

function normalizeMeetingStatus(status: string) {
  return status.trim().toUpperCase();
}

const reunifyMeetingSelectLegacy = {
  id: reunifyMeetings.id,
  date: reunifyMeetings.date,
  startTime: reunifyMeetings.startTime,
  endTime: reunifyMeetings.endTime,
  durationMinutes: reunifyMeetings.durationMinutes,
  title: reunifyMeetings.title,
  titulo: reunifyMeetings.title,
  status: reunifyMeetings.status,
  location: reunifyMeetings.location,
  summary: reunifyMeetings.summary,
};

const reunifyMeetingSelectWithLifecycle = {
  ...reunifyMeetingSelectLegacy,
  cancelReason: reunifyMeetings.cancelReason,
  canceledAt: reunifyMeetings.canceledAt,
  canceledByUserId: reunifyMeetings.canceledByUserId,
  rescheduledFromMeetingId: reunifyMeetings.rescheduledFromMeetingId,
};

function addLifecycleDefaults<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    cancelReason: (row as { cancelReason?: string | null }).cancelReason ?? null,
    canceledAt: (row as { canceledAt?: Date | null }).canceledAt ?? null,
    canceledByUserId: (row as { canceledByUserId?: number | null }).canceledByUserId ?? null,
    rescheduledFromMeetingId:
      (row as { rescheduledFromMeetingId?: number | null }).rescheduledFromMeetingId ?? null,
  };
}

function normalizeParticipantUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map((value) => {
      if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
      }
      if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        return Number(value.trim());
      }
      return null;
    })
    .filter((value): value is number => value != null);
  return Array.from(new Set(normalized));
}

async function logMeetingHistory(args: {
  teamId: number;
  meetingId: number;
  actionType: 'CREATE' | 'UPDATE' | 'COMPLETE' | 'CANCEL' | 'RESCHEDULE' | 'DELETE';
  performedByUserId: number | null;
  payload?: unknown;
}) {
  try {
    await db.insert(reunifyMeetingHistory).values({
      teamId: args.teamId,
      meetingId: args.meetingId,
      actionType: args.actionType,
      payload: args.payload == null ? null : JSON.stringify(args.payload),
      performedByUserId: args.performedByUserId,
    });
  } catch (e) {
    if (!isPostgresUndefinedTableError(e)) {
      console.error('[reunify meeting history] failed to persist event', e);
    }
  }
}

async function validateTeamMemberIds(teamId: number, userIds: number[]) {
  if (userIds.length === 0) return [] as number[];
  const rows = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), inArray(teamMembers.userId, userIds)));
  const allowed = new Set(rows.map((row) => row.userId));
  return userIds.filter((id) => allowed.has(id));
}

async function getParticipantsByMeetingIds(meetingIds: number[]) {
  const map = new Map<number, number[]>();
  if (meetingIds.length === 0) return map;
  try {
    const rows = await db
      .select({
        meetingId: reunifyMeetingParticipants.meetingId,
        userId: reunifyMeetingParticipants.userId,
      })
      .from(reunifyMeetingParticipants)
      .where(inArray(reunifyMeetingParticipants.meetingId, meetingIds));
    for (const row of rows) {
      const arr = map.get(row.meetingId) ?? [];
      arr.push(row.userId);
      map.set(row.meetingId, arr);
    }
  } catch (e) {
    if (!(isPostgresUndefinedColumnError(e) || isPostgresUndefinedTableError(e))) {
      throw e;
    }
  }
  return map;
}

function mapMeetingStatusToChronosStatus(status: string): 'AGENDADO' | 'CONCLUIDO' | 'CANCELADO' {
  const normalized = normalizeMeetingStatus(status);
  if (normalized === 'FINALIZADA') {
    return 'CONCLUIDO';
  }
  if (normalized === 'CANCELADA') {
    return 'CANCELADO';
  }
  return 'AGENDADO';
}

async function syncReunifyMeetingToChronos(args: {
  teamId: number;
  meeting: ReunifyMeetingRow;
  participantUserIds?: number[];
}) {
  const { teamId, meeting } = args;
  const integrationKey = 'reunify_to_chronos';
  const participantUserIds = Array.isArray(args.participantUserIds)
    ? Array.from(new Set(args.participantUserIds.filter((id) => Number.isInteger(id) && id > 0)))
    : [];
  const canAutoCreateChronos = isScheduledMeetingStatus(meeting.status);
  const chronosStatus = mapMeetingStatusToChronosStatus(meeting.status);

  const basePayload = {
    teamId,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    durationMinutes: meeting.durationMinutes,
    title: meeting.title,
    description: meeting.summary,
    type: 'REUNIAO' as const,
    location: meeting.location,
    source: 'REUNIFY',
    status: chronosStatus,
    updatedAt: new Date(),
  };

  try {
    const existingRows = await db
      .select({
        id: chronosAgendaItems.id,
        participantUserId: chronosAgendaItems.participantUserId,
      })
      .from(chronosAgendaItems)
      .where(and(eq(chronosAgendaItems.teamId, teamId), eq(chronosAgendaItems.reunifyMeetingId, meeting.id)));

    const existingByParticipant = new Map<number | null, number>();
    for (const row of existingRows) {
      existingByParticipant.set(row.participantUserId ?? null, row.id);
    }

    const targetParticipants = participantUserIds.length > 0 ? participantUserIds : [null];

    for (const participant of targetParticipants) {
      const existingId = existingByParticipant.get(participant);
      if (existingId) {
        await db
          .update(chronosAgendaItems)
          .set({
            ...basePayload,
            participantUserId: participant,
          })
          .where(eq(chronosAgendaItems.id, existingId));
      } else if (canAutoCreateChronos) {
        await db.insert(chronosAgendaItems).values({
          ...basePayload,
          reunifyMeetingId: meeting.id,
          participantUserId: participant,
        });
      }
    }

    const targetSet = new Set(targetParticipants);
    for (const row of existingRows) {
      const participant = row.participantUserId ?? null;
      if (!targetSet.has(participant)) {
        await db.delete(chronosAgendaItems).where(eq(chronosAgendaItems.id, row.id));
      }
    }
    await recordIntegrationSyncEvent({
      teamId,
      integrationKey,
      entityType: 'reunify_meeting',
      entityId: meeting.id,
      operation: 'UPSERT_LINKED',
      status: 'SUCCESS',
      payload: {
        mode: 'reunify_meeting_id',
        targetParticipants,
        existingRows: existingRows.length,
      },
    });
    return;
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) {
      console.error('[syncReunifyMeetingToChronos] reunify link', e);
      await recordIntegrationSyncEvent({
        teamId,
        integrationKey,
        entityType: 'reunify_meeting',
        entityId: meeting.id,
        operation: 'UPSERT_LINKED',
        status: 'ERROR',
        message: e instanceof Error ? e.message : 'Erro ao sincronizar por reunify_meeting_id',
      });
      return;
    }
  }

  try {
    const [fallbackExisting] = await db
      .select({ id: chronosAgendaItems.id })
      .from(chronosAgendaItems)
      .where(
        and(
          eq(chronosAgendaItems.teamId, teamId),
          eq(chronosAgendaItems.date, meeting.date),
          eq(chronosAgendaItems.startTime, meeting.startTime),
          eq(chronosAgendaItems.title, meeting.title),
          eq(chronosAgendaItems.source, 'REUNIFY'),
        ),
      )
      .limit(1);

    if (fallbackExisting) {
      await db
        .update(chronosAgendaItems)
        .set(basePayload)
        .where(eq(chronosAgendaItems.id, fallbackExisting.id));
      await recordIntegrationSyncEvent({
        teamId,
        integrationKey,
        entityType: 'reunify_meeting',
        entityId: meeting.id,
        operation: 'UPSERT_FALLBACK',
        status: 'SUCCESS',
        payload: { mode: 'fallback_key', updatedAgendaItemId: fallbackExisting.id },
      });
      return;
    }
    if (!canAutoCreateChronos) {
      await recordIntegrationSyncEvent({
        teamId,
        integrationKey,
        entityType: 'reunify_meeting',
        entityId: meeting.id,
        operation: 'UPSERT_FALLBACK',
        status: 'SKIPPED',
        message: 'Reunião não agendada; sem criação automática no Chronos.',
      });
      return;
    }

    await db.insert(chronosAgendaItems).values(basePayload);
    await recordIntegrationSyncEvent({
      teamId,
      integrationKey,
      entityType: 'reunify_meeting',
      entityId: meeting.id,
      operation: 'UPSERT_FALLBACK',
      status: 'SUCCESS',
      payload: { mode: 'fallback_key', created: true },
    });
  } catch (e) {
    console.error('[syncReunifyMeetingToChronos] fallback', e);
    await recordIntegrationSyncEvent({
      teamId,
      integrationKey,
      entityType: 'reunify_meeting',
      entityId: meeting.id,
      operation: 'UPSERT_FALLBACK',
      status: 'ERROR',
      message: e instanceof Error ? e.message : 'Erro em sincronização fallback',
    });
  }
}

/**
 * Retorna as reuniões do Reunify (MVP).
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
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return moduleDisabledResponse('Reunify');
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');

  /** Lista completa do time (até 500) — o dashboard filtra por período no cliente. */
  if (scope === 'team') {
    let meetings: any[] = [];
    try {
      meetings = await db
        .select(reunifyMeetingSelectWithLifecycle)
        .from(reunifyMeetings)
        .where(eq(reunifyMeetings.teamId, team.id))
        .orderBy(desc(reunifyMeetings.date), desc(reunifyMeetings.id))
        .limit(500);
    } catch (e) {
      if (!isPostgresUndefinedColumnError(e)) {
        throw e;
      }
      meetings = await db
        .select(reunifyMeetingSelectLegacy)
        .from(reunifyMeetings)
        .where(eq(reunifyMeetings.teamId, team.id))
        .orderBy(desc(reunifyMeetings.date), desc(reunifyMeetings.id))
        .limit(500);
    }
    const participantMap = await getParticipantsByMeetingIds(meetings.map((m) => m.id));
    return NextResponse.json(
      meetings.map((m) => {
        const base = addLifecycleDefaults(m);
        const ids = participantMap.get(m.id) ?? [];
        return {
          ...base,
          participantUserIds: ids,
          participantCount: ids.length,
        };
      }),
    );
  }

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = from || today;
  const toDate = to || fromDate;

  let meetings: any[] = [];
  try {
    meetings = await db
      .select(reunifyMeetingSelectWithLifecycle)
      .from(reunifyMeetings)
      .where(
        and(
          eq(reunifyMeetings.teamId, team.id),
          gte(reunifyMeetings.date, fromDate),
          lte(reunifyMeetings.date, toDate),
        ),
      )
      .orderBy(asc(reunifyMeetings.date), asc(reunifyMeetings.startTime));
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) {
      throw e;
    }
    meetings = await db
      .select(reunifyMeetingSelectLegacy)
      .from(reunifyMeetings)
      .where(
        and(
          eq(reunifyMeetings.teamId, team.id),
          gte(reunifyMeetings.date, fromDate),
          lte(reunifyMeetings.date, toDate),
        ),
      )
      .orderBy(asc(reunifyMeetings.date), asc(reunifyMeetings.startTime));
  }

  const participantMap = await getParticipantsByMeetingIds(meetings.map((m) => m.id));
  return NextResponse.json(
    meetings.map((m) => {
      const base = addLifecycleDefaults(m);
      const ids = participantMap.get(m.id) ?? [];
      return {
        ...base,
        participantUserIds: ids,
        participantCount: ids.length,
      };
    }),
  );
}

/**
 * Cria uma reunião no Reunify (MVP).
 */
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
    return moduleDisabledResponse('Reunify');
  }

  const body = await request.json();
  const date = typeof body?.date === 'string' ? body.date.trim() : '';
  const startTime = typeof body?.startTime === 'string' ? body.startTime.trim() : '';
  const endTime = typeof body?.endTime === 'string' ? body.endTime.trim() : '';
  const durationMinutes =
    typeof body?.durationMinutes === 'number' ? body.durationMinutes : null;
  const title =
    typeof body?.title === 'string'
      ? body.title.trim()
      : typeof body?.titulo === 'string'
        ? body.titulo.trim()
        : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : '';
  const location = typeof body?.location === 'string' ? body.location.trim() : '';
  const summary = typeof body?.summary === 'string' ? body.summary.trim() : '';
  const participantUserIdsInput = normalizeParticipantUserIds(body?.participantUserIds);

  if (!date || !startTime || !title || !status) {
    return NextResponse.json(
      { error: 'date, startTime, title e status são obrigatórios' },
      { status: 400 },
    );
  }

  const participantUserIds = await validateTeamMemberIds(team.id, participantUserIdsInput);
  if (participantUserIdsInput.length > 0 && participantUserIds.length !== participantUserIdsInput.length) {
    return NextResponse.json(
      { error: 'Há participantes inválidos (fora do time) no pedido.' },
      { status: 400 },
    );
  }

  let created: any[] = [];
  try {
    created = await db
      .insert(reunifyMeetings)
      .values({
        teamId: team.id,
        date,
        startTime,
        endTime: endTime || null,
        durationMinutes,
        title,
        status,
        cancelReason: null,
        canceledAt: null,
        canceledByUserId: null,
        rescheduledFromMeetingId:
          typeof body?.rescheduledFromMeetingId === 'number' && body.rescheduledFromMeetingId > 0
            ? body.rescheduledFromMeetingId
            : null,
        location: location || null,
        summary: summary || null,
      })
      .returning(reunifyMeetingSelectWithLifecycle);
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) {
      throw e;
    }
    created = await db
      .insert(reunifyMeetings)
      .values({
        teamId: team.id,
        date,
        startTime,
        endTime: endTime || null,
        durationMinutes,
        title,
        status,
        location: location || null,
        summary: summary || null,
      })
      .returning(reunifyMeetingSelectLegacy);
  }

  const createdRow = addLifecycleDefaults(created[0]) as ReunifyMeetingRow;
  if (participantUserIds.length > 0) {
    try {
      await db.insert(reunifyMeetingParticipants).values(
        participantUserIds.map((userId) => ({
          meetingId: createdRow.id,
          teamId: team.id,
          userId,
        })),
      );
    } catch (e) {
      if (isPostgresUndefinedColumnError(e) || isPostgresUndefinedTableError(e)) {
        return NextResponse.json(
          { error: 'Este ambiente ainda não suporta participantes de reunião. Rode a migração 0059_reunify_meeting_participants.' },
          { status: 400 },
        );
      }
      throw e;
    }
  }
  const createdWithParticipants: ReunifyMeetingWithParticipants = {
    ...createdRow,
    participantUserIds,
    participantCount: participantUserIds.length,
  };
  await logMeetingHistory({
    teamId: team.id,
    meetingId: createdRow.id,
    actionType: createdRow.rescheduledFromMeetingId ? 'RESCHEDULE' : 'CREATE',
    performedByUserId: user.id,
    payload: {
      status: createdRow.status,
      date: createdRow.date,
      startTime: createdRow.startTime,
      reason: createdRow.cancelReason,
      participantCount: participantUserIds.length,
    },
  });
  void syncReunifyMeetingToChronos({
    teamId: team.id,
    meeting: createdRow,
    participantUserIds,
  });

  return NextResponse.json(createdWithParticipants, { status: 201 });
}

/**
 * Atualiza dados de uma reunião.
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
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return moduleDisabledResponse('Reunify');
  }

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  let meeting: any[] = [];
  try {
    meeting = await db
      .select(reunifyMeetingSelectWithLifecycle)
      .from(reunifyMeetings)
      .where(and(eq(reunifyMeetings.id, id), eq(reunifyMeetings.teamId, team.id)))
      .limit(1);
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) {
      throw e;
    }
    meeting = await db
      .select(reunifyMeetingSelectLegacy)
      .from(reunifyMeetings)
      .where(and(eq(reunifyMeetings.id, id), eq(reunifyMeetings.teamId, team.id)))
      .limit(1);
  }
  const meetingRow = addLifecycleDefaults(meeting[0] ?? {});

  if (!meeting[0]) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  const nextStatus =
    typeof body?.status === 'string' && body.status.trim().length > 0
      ? body.status.trim().toUpperCase()
      : meetingRow.status;
  const isCanceling = nextStatus === 'CANCELADA';
  const isCancelingTransition = isCanceling && meetingRow.status !== 'CANCELADA';
  const hasCancelReasonField = Object.prototype.hasOwnProperty.call(body || {}, 'cancelReason');
  const cancelReasonInput = typeof body?.cancelReason === 'string' ? body.cancelReason.trim() : '';
  const effectiveCancelReason = hasCancelReasonField
    ? cancelReasonInput
    : isCanceling
      ? meetingRow.cancelReason || ''
      : '';
  if (isCanceling && !effectiveCancelReason) {
    return NextResponse.json(
      { error: 'Informe o motivo do cancelamento.' },
      { status: 400 },
    );
  }
  const rescheduledFromMeetingId =
    typeof body?.rescheduledFromMeetingId === 'number' && body.rescheduledFromMeetingId > 0
      ? body.rescheduledFromMeetingId
      : body?.rescheduledFromMeetingId === null
        ? null
        : meetingRow.rescheduledFromMeetingId;

  const hasParticipantsField = Object.prototype.hasOwnProperty.call(body || {}, 'participantUserIds');
  const participantUserIdsInput = hasParticipantsField
    ? normalizeParticipantUserIds(body?.participantUserIds)
    : null;
  const participantUserIds = hasParticipantsField
    ? await validateTeamMemberIds(team.id, participantUserIdsInput || [])
    : null;
  if (
    hasParticipantsField &&
    participantUserIdsInput &&
    participantUserIds &&
    participantUserIds.length !== participantUserIdsInput.length
  ) {
    return NextResponse.json(
      { error: 'Há participantes inválidos (fora do time) no pedido.' },
      { status: 400 },
    );
  }

  const basePatchPayload = {
    date: typeof body?.date === 'string' ? body.date : meetingRow.date,
    startTime:
      typeof body?.startTime === 'string' ? body.startTime.trim() : meetingRow.startTime,
    endTime:
      typeof body?.endTime === 'string' ? body.endTime.trim() : meetingRow.endTime,
    durationMinutes:
      typeof body?.durationMinutes === 'number'
        ? body.durationMinutes
        : meetingRow.durationMinutes,
    title:
      typeof body?.title === 'string'
        ? body.title.trim()
        : typeof body?.titulo === 'string'
          ? body.titulo.trim()
          : meetingRow.title,
    status: nextStatus,
    location:
      typeof body?.location === 'string' ? body.location.trim() : meetingRow.location,
    summary:
      typeof body?.summary === 'string' ? body.summary.trim() : meetingRow.summary,
    updatedAt: new Date(),
  };

  let updated: any[] = [];
  try {
    updated = await db
      .update(reunifyMeetings)
      .set({
        ...basePatchPayload,
        cancelReason: isCanceling
          ? effectiveCancelReason
          : hasCancelReasonField
            ? cancelReasonInput || null
            : null,
        canceledAt: isCanceling ? (isCancelingTransition ? new Date() : meetingRow.canceledAt) : null,
        canceledByUserId: isCanceling ? (isCancelingTransition ? user.id : meetingRow.canceledByUserId) : null,
        rescheduledFromMeetingId,
      })
      .where(eq(reunifyMeetings.id, id))
      .returning(reunifyMeetingSelectWithLifecycle);
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) {
      throw e;
    }
    const lifecycleRequested =
      isCanceling || hasCancelReasonField || Object.prototype.hasOwnProperty.call(body || {}, 'rescheduledFromMeetingId');
    if (lifecycleRequested) {
      return NextResponse.json(
        { error: 'Este ambiente ainda não suporta motivo de cancelamento/reagendamento. Rode as migrações mais recentes.' },
        { status: 400 },
      );
    }
    updated = await db
      .update(reunifyMeetings)
      .set(basePatchPayload)
      .where(eq(reunifyMeetings.id, id))
      .returning(reunifyMeetingSelectLegacy);
  }

  const updatedRow = addLifecycleDefaults(updated[0]) as ReunifyMeetingRow;
  let responseParticipantIds: number[] = [];
  if (hasParticipantsField && participantUserIds) {
    try {
      await db
        .delete(reunifyMeetingParticipants)
        .where(eq(reunifyMeetingParticipants.meetingId, id));
      if (participantUserIds.length > 0) {
        await db.insert(reunifyMeetingParticipants).values(
          participantUserIds.map((userId) => ({
            meetingId: id,
            teamId: team.id,
            userId,
          })),
        );
      }
      responseParticipantIds = participantUserIds;
    } catch (e) {
      if (isPostgresUndefinedColumnError(e) || isPostgresUndefinedTableError(e)) {
        return NextResponse.json(
          { error: 'Este ambiente ainda não suporta participantes de reunião. Rode a migração 0059_reunify_meeting_participants.' },
          { status: 400 },
        );
      }
      throw e;
    }
  } else {
    const participantMap = await getParticipantsByMeetingIds([id]);
    responseParticipantIds = participantMap.get(id) ?? [];
  }
  void syncReunifyMeetingToChronos({
    teamId: team.id,
    meeting: updatedRow,
    participantUserIds: responseParticipantIds,
  });
  const actionType =
    updatedRow.status === 'FINALIZADA' && meetingRow.status !== 'FINALIZADA'
      ? 'COMPLETE'
      : updatedRow.status === 'CANCELADA' && meetingRow.status !== 'CANCELADA'
        ? 'CANCEL'
        : body?.rescheduledFromMeetingId
          ? 'RESCHEDULE'
          : 'UPDATE';
  await logMeetingHistory({
    teamId: team.id,
    meetingId: updatedRow.id,
    actionType,
    performedByUserId: user.id,
    payload: {
      beforeStatus: meetingRow.status,
      afterStatus: updatedRow.status,
      cancelReason: updatedRow.cancelReason,
      date: updatedRow.date,
      startTime: updatedRow.startTime,
      participantCount: responseParticipantIds.length,
    },
  });

  return NextResponse.json({
    ...updatedRow,
    participantUserIds: responseParticipantIds,
    participantCount: responseParticipantIds.length,
  });
}

/**
 * Remove uma reunião.
 */
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (normalizeRole(user.role) !== 'owner') {
    return NextResponse.json(
      { error: 'Somente o proprietário pode excluir reuniões.' },
      { status: 403 },
    );
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return moduleDisabledResponse('Reunify');
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const [meetingToDelete] = await db
    .select({
      id: reunifyMeetings.id,
      date: reunifyMeetings.date,
      startTime: reunifyMeetings.startTime,
      title: reunifyMeetings.title,
    })
    .from(reunifyMeetings)
    .where(and(eq(reunifyMeetings.id, id), eq(reunifyMeetings.teamId, team.id)))
    .limit(1);

  if (!meetingToDelete) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  await unlinkUploadFilesForMeeting(team.id, id);

  try {
    await db
      .delete(chronosAgendaItems)
      .where(and(eq(chronosAgendaItems.teamId, team.id), eq(chronosAgendaItems.reunifyMeetingId, id)));
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) {
      console.error('[DELETE /api/reunify/meetings] chronos link cleanup', e);
    } else {
      try {
        await db
          .delete(chronosAgendaItems)
          .where(
            and(
              eq(chronosAgendaItems.teamId, team.id),
              eq(chronosAgendaItems.source, 'REUNIFY'),
              eq(chronosAgendaItems.date, meetingToDelete.date),
              eq(chronosAgendaItems.startTime, meetingToDelete.startTime),
              eq(chronosAgendaItems.title, meetingToDelete.title),
            ),
          );
      } catch (fallbackErr) {
        console.error('[DELETE /api/reunify/meetings] chronos fallback cleanup', fallbackErr);
      }
    }
  }

  await db
    .delete(reunifyMeetings)
    .where(and(eq(reunifyMeetings.id, id), eq(reunifyMeetings.teamId, team.id)));
  await logMeetingHistory({
    teamId: team.id,
    meetingId: id,
    actionType: 'DELETE',
    performedByUserId: user.id,
    payload: {
      title: meetingToDelete.title,
      date: meetingToDelete.date,
      startTime: meetingToDelete.startTime,
    },
  });

  return NextResponse.json({ ok: true });
}
