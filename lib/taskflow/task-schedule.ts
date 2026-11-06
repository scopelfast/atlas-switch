/** M6.2 — limites e parsing para duração estimada (horas). */
export const MAX_ESTIMATED_DURATION_HOURS = 8760;

export function parseEstimatedDurationHours(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: true, value: null };
  }
  if (raw === null || raw === '') {
    return { ok: true, value: null };
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: 'estimatedDurationHours deve ser um número ≥ 0.' };
  }
  if (n > MAX_ESTIMATED_DURATION_HOURS) {
    return {
      ok: false,
      error: `estimatedDurationHours não pode exceder ${MAX_ESTIMATED_DURATION_HOURS} h.`,
    };
  }
  return { ok: true, value: n === 0 ? null : n };
}

export function parsePlannedStartIso(
  raw: unknown,
): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: true, value: null };
  }
  if (raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'plannedStartAt deve ser uma data ISO ou vazio.' };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: 'plannedStartAt inválido.' };
  }
  return { ok: true, value: d };
}

/** Valor para `<input type="datetime-local" />` a partir de ISO guardado na BD. */
export function datetimeLocalFromIso(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converte valor de `datetime-local` para ISO (UTC) para a API. */
export function isoFromDateTimeLocal(s: string | null | undefined): string | null {
  if (s == null || !String(s).trim()) {
    return null;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

export function formatDateTimePtShort(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Chave YYYY-MM-DD no fuso local (ex.: células do calendário). */
export function formatLocalDateKey(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatLocalDateKeyFromIso(iso: string): string {
  return formatLocalDateKey(new Date(iso));
}
