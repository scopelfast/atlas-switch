export const RECURRENCE_RULES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type RecurrenceRule = (typeof RECURRENCE_RULES)[number];

export function isRecurrenceRule(s: string): s is RecurrenceRule {
  return (RECURRENCE_RULES as readonly string[]).includes(s);
}

/** Aceita body JSON; devolve null se omitido / vazio. */
export function parseRecurrenceRule(raw: unknown): RecurrenceRule | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const u = String(raw).trim().toUpperCase();
  if (!u) {
    return null;
  }
  if (!isRecurrenceRule(u)) {
    throw new Error('recurrenceRule inválido (use DAILY, WEEKLY ou MONTHLY)');
  }
  return u;
}

export function coerceRecurrenceRule(raw: string | null | undefined): RecurrenceRule | null {
  if (raw == null || raw === '') {
    return null;
  }
  const u = raw.trim().toUpperCase();
  return isRecurrenceRule(u) ? u : null;
}

/** Chave idempotente curta por tipo (UTC). */
export function buildOccurrenceKey(rule: RecurrenceRule, due: Date): string {
  const y = due.getUTCFullYear();
  const m = String(due.getUTCMonth() + 1).padStart(2, '0');
  const d = String(due.getUTCDate()).padStart(2, '0');
  if (rule === 'DAILY') {
    return `D:${y}-${m}-${d}`;
  }
  if (rule === 'WEEKLY') {
    return `W:${y}-${m}-${d}`;
  }
  return `M:${y}-${m}`;
}

export function advanceDueByRule(from: Date, rule: RecurrenceRule): Date {
  const x = new Date(from.getTime());
  if (rule === 'DAILY') {
    x.setUTCDate(x.getUTCDate() + 1);
  } else if (rule === 'WEEKLY') {
    x.setUTCDate(x.getUTCDate() + 7);
  } else {
    x.setUTCMonth(x.getUTCMonth() + 1);
  }
  return x;
}
