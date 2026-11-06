import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { chronosAgendaItems, saasPlanModules, teamPlans } from '@/lib/db/schema';

export const CHRONOS_TASKFLOW_TIMEZONE = 'America/Sao_Paulo';

/** Lembretes em minutos antes do evento: D-1, H-1, 30m, 15m, no horário. */
export const TASKFLOW_CHRONOS_REMINDER_OFFSETS = [1440, 60, 30, 15, 0] as const;

export const TASKFLOW_CHRONOS_REMINDER_OFFSETS_CSV = TASKFLOW_CHRONOS_REMINDER_OFFSETS.join(',');

export function parseTaskflowReminderOffsetsCsv(csv: string | null | undefined): number[] {
  if (!csv?.trim()) {
    return [...TASKFLOW_CHRONOS_REMINDER_OFFSETS];
  }
  const parsed = csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  return parsed.length > 0 ? parsed : [...TASKFLOW_CHRONOS_REMINDER_OFFSETS];
}

/**
 * Plano ATIVO do time inclui módulo `chronos` habilitado no catálogo do plano.
 */
export async function teamHasChronosModule(teamId: number): Promise<boolean> {
  const row = await db
    .select({ id: teamPlans.id })
    .from(teamPlans)
    .innerJoin(saasPlanModules, eq(teamPlans.planId, saasPlanModules.planId))
    .where(
      and(
        eq(teamPlans.teamId, teamId),
        eq(teamPlans.status, 'ATIVO'),
        eq(saasPlanModules.moduleKey, 'chronos'),
        eq(saasPlanModules.enabled, true),
      ),
    )
    .limit(1);
  return row.length > 0;
}

export function chronosLocalDateTimeFromDue(
  due: Date,
  timeZone = CHRONOS_TASKFLOW_TIMEZONE,
): { date: string; startTime: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(due);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const y = get('year');
  const m = get('month');
  const d = get('day');
  let h = get('hour');
  let min = get('minute');
  if (h.length === 1) h = `0${h}`;
  if (min.length === 1) min = `0${min}`;
  return { date: `${y}-${m}-${d}`, startTime: `${h}:${min}` };
}

function endTimeAfterStart(startTime: string, addMinutes: number): string {
  const [hs, ms] = startTime.split(':').map(Number);
  if (Number.isNaN(hs) || Number.isNaN(ms)) {
    return startTime;
  }
  let total = hs * 60 + ms + addMinutes;
  if (total >= 24 * 60) {
    total = 24 * 60 - 1;
  }
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function mirrorDescription(): string {
  return [
    'Prazo sincronizado a partir do Taskflow.',
    `Lembretes (minutos antes do evento): ${TASKFLOW_CHRONOS_REMINDER_OFFSETS.join(', ')} (1440 = véspera; 0 = no horário).`,
  ].join(' ');
}

function coerceDueDate(due: Date | string | null | undefined): Date | null {
  if (due == null) return null;
  const d = due instanceof Date ? due : new Date(due);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type SyncChronosMirrorForTaskflowTaskInput = {
  teamId: number;
  taskId: number;
  title: string;
  dueDate: Date | string | null | undefined;
};

/**
 * Remove o espelho existente; se o módulo Chronos estiver activo e houver prazo, recria um registo em `chronos_agenda_items`.
 */
export async function syncChronosMirrorForTaskflowTask(input: SyncChronosMirrorForTaskflowTaskInput) {
  const { teamId, taskId, title } = input;
  const due = coerceDueDate(input.dueDate);

  await db
    .delete(chronosAgendaItems)
    .where(
      and(eq(chronosAgendaItems.teamId, teamId), eq(chronosAgendaItems.taskflowTaskId, taskId)),
    );

  const has = await teamHasChronosModule(teamId);
  if (!has || !due) {
    return;
  }

  const { date, startTime } = chronosLocalDateTimeFromDue(due);
  const endTime = endTimeAfterStart(startTime, 30);
  const now = new Date();

  await db.insert(chronosAgendaItems).values({
    teamId,
    date,
    startTime,
    endTime,
    durationMinutes: 30,
    title,
    description: mirrorDescription(),
    type: 'FOCO',
    location: null,
    reminderMinutes: TASKFLOW_CHRONOS_REMINDER_OFFSETS[0],
    recurrence: null,
    timezone: CHRONOS_TASKFLOW_TIMEZONE,
    source: 'TASKFLOW',
    status: 'AGENDADO',
    taskflowTaskId: taskId,
    taskflowReminderOffsets: TASKFLOW_CHRONOS_REMINDER_OFFSETS_CSV,
    createdAt: now,
    updatedAt: now,
  });
}
