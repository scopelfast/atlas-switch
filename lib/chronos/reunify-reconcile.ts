import { and, eq } from 'drizzle-orm';
import { recordIntegrationSyncEvent } from '@/lib/db/integration-sync-events';
import { db } from '@/lib/db/drizzle';
import { isPostgresUndefinedColumnError, isPostgresUndefinedTableError } from '@/lib/db/pg-errors';
import { chronosAgendaItems, reunifyMeetingParticipants, reunifyMeetings } from '@/lib/db/schema';

type MeetingRow = {
  id: number;
  date: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  title: string;
  location: string | null;
  summary: string | null;
  status: string;
};

export type ReconcileReunifyToChronosResult = {
  scanned: number;
  created: number;
  updated: number;
  removed: number;
};

function mapMeetingStatusToChronosStatus(status: string): 'AGENDADO' | 'CONCLUIDO' | 'CANCELADO' {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'FINALIZADA') return 'CONCLUIDO';
  if (normalized === 'CANCELADA') return 'CANCELADO';
  return 'AGENDADO';
}

function normalizeParticipants(values: number[]): number[] {
  const out = values.filter((v) => Number.isInteger(v) && v > 0);
  return out.length > 0 ? Array.from(new Set(out)) : [];
}

/**
 * IM3.2 — reconciliação Reunify -> Chronos por time.
 */
export async function reconcileReunifyToChronosForTeam(
  teamId: number,
): Promise<ReconcileReunifyToChronosResult> {
  const integrationKey = 'reunify_to_chronos';

  try {
    const meetings = await db
      .select({
        id: reunifyMeetings.id,
        date: reunifyMeetings.date,
        startTime: reunifyMeetings.startTime,
        endTime: reunifyMeetings.endTime,
        durationMinutes: reunifyMeetings.durationMinutes,
        title: reunifyMeetings.title,
        location: reunifyMeetings.location,
        summary: reunifyMeetings.summary,
        status: reunifyMeetings.status,
      })
      .from(reunifyMeetings)
      .where(eq(reunifyMeetings.teamId, teamId));

    let participantRows: Array<{ meetingId: number; userId: number }> = [];
    try {
      participantRows = await db
        .select({
          meetingId: reunifyMeetingParticipants.meetingId,
          userId: reunifyMeetingParticipants.userId,
        })
        .from(reunifyMeetingParticipants)
        .where(eq(reunifyMeetingParticipants.teamId, teamId));
    } catch (e) {
      if (!(isPostgresUndefinedTableError(e) || isPostgresUndefinedColumnError(e))) {
        throw e;
      }
    }

    const participantsByMeeting = new Map<number, number[]>();
    for (const row of participantRows) {
      const arr = participantsByMeeting.get(row.meetingId) ?? [];
      arr.push(row.userId);
      participantsByMeeting.set(row.meetingId, arr);
    }

    const agendaRows = await db
      .select({
        id: chronosAgendaItems.id,
        reunifyMeetingId: chronosAgendaItems.reunifyMeetingId,
        participantUserId: chronosAgendaItems.participantUserId,
        date: chronosAgendaItems.date,
        startTime: chronosAgendaItems.startTime,
        endTime: chronosAgendaItems.endTime,
        durationMinutes: chronosAgendaItems.durationMinutes,
        title: chronosAgendaItems.title,
        status: chronosAgendaItems.status,
        location: chronosAgendaItems.location,
        description: chronosAgendaItems.description,
      })
      .from(chronosAgendaItems)
      .where(and(eq(chronosAgendaItems.teamId, teamId), eq(chronosAgendaItems.source, 'REUNIFY')));

    const agendaByKey = new Map<string, (typeof agendaRows)[number]>();
    for (const row of agendaRows) {
      if (row.reunifyMeetingId == null) continue;
      const key = `${row.reunifyMeetingId}:${row.participantUserId ?? 'none'}`;
      agendaByKey.set(key, row);
    }

    let created = 0;
    let updated = 0;
    let removed = 0;
    let scanned = 0;

    const expectedKeys = new Set<string>();
    for (const meeting of meetings as MeetingRow[]) {
      const participants = normalizeParticipants(participantsByMeeting.get(meeting.id) ?? []);
      const targets = participants.length > 0 ? participants : [null];
      const normalizedStatus = mapMeetingStatusToChronosStatus(meeting.status);
      const isScheduled = meeting.status.trim().toUpperCase() === 'AGENDADA';

      for (const participant of targets) {
        const key = `${meeting.id}:${participant ?? 'none'}`;
        expectedKeys.add(key);
        scanned += 1;
        const existing = agendaByKey.get(key);
        const nextPayload = {
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
          status: normalizedStatus,
          reunifyMeetingId: meeting.id,
          participantUserId: participant,
          updatedAt: new Date(),
        };

        if (!existing) {
          if (!isScheduled) {
            continue;
          }
          await db.insert(chronosAgendaItems).values({
            ...nextPayload,
            createdAt: new Date(),
          });
          created += 1;
          await recordIntegrationSyncEvent({
            teamId,
            integrationKey,
            entityType: 'reunify_meeting',
            entityId: meeting.id,
            operation: 'RECONCILE_CREATE',
            status: 'RECONCILED',
            payload: { participantUserId: participant },
          });
          continue;
        }

        const changed =
          existing.date !== nextPayload.date ||
          existing.startTime !== nextPayload.startTime ||
          (existing.endTime ?? null) !== (nextPayload.endTime ?? null) ||
          (existing.durationMinutes ?? null) !== (nextPayload.durationMinutes ?? null) ||
          existing.title !== nextPayload.title ||
          (existing.location ?? null) !== (nextPayload.location ?? null) ||
          (existing.description ?? null) !== (nextPayload.description ?? null) ||
          existing.status !== nextPayload.status;

        if (changed) {
          await db.update(chronosAgendaItems).set(nextPayload).where(eq(chronosAgendaItems.id, existing.id));
          updated += 1;
          await recordIntegrationSyncEvent({
            teamId,
            integrationKey,
            entityType: 'reunify_meeting',
            entityId: meeting.id,
            operation: 'RECONCILE_UPDATE',
            status: 'RECONCILED',
            payload: { participantUserId: participant, agendaItemId: existing.id },
          });
        }
      }
    }

    for (const row of agendaRows) {
      if (row.reunifyMeetingId == null) continue;
      const key = `${row.reunifyMeetingId}:${row.participantUserId ?? 'none'}`;
      if (expectedKeys.has(key)) continue;
      await db.delete(chronosAgendaItems).where(eq(chronosAgendaItems.id, row.id));
      removed += 1;
      await recordIntegrationSyncEvent({
        teamId,
        integrationKey,
        entityType: 'reunify_meeting',
        entityId: row.reunifyMeetingId,
        operation: 'RECONCILE_DELETE_ORPHAN',
        status: 'RECONCILED',
        payload: { agendaItemId: row.id, participantUserId: row.participantUserId },
      });
    }

    return {
      scanned,
      created,
      updated,
      removed,
    };
  } catch (e) {
    await recordIntegrationSyncEvent({
      teamId,
      integrationKey,
      entityType: 'reunify_meeting',
      operation: 'RECONCILE_BATCH',
      status: 'ERROR',
      message: e instanceof Error ? e.message : 'Falha na reconciliação',
    });
    throw e;
  }
}
