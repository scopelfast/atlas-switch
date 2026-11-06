export type MicrosoftCalendarEventRow = {
  id: string;
  subject: string;
  startIso: string;
  endIso: string;
  isAllDay: boolean;
  location?: string | null;
};

type GraphCalendarEvent = {
  id?: string;
  subject?: string;
  isAllDay?: boolean;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
};

function toIso(graphDate: { dateTime?: string; timeZone?: string } | undefined): string {
  if (!graphDate?.dateTime) return '';
  const raw = graphDate.dateTime;
  if (graphDate.timeZone === 'UTC' && !raw.endsWith('Z') && !raw.includes('+')) {
    return `${raw}Z`;
  }
  return raw;
}

/**
 * Lê janela do calendário principal (calendarView). Não grava no Chronos.
 */
export async function fetchMicrosoftCalendarView(
  accessToken: string,
  startIso: string,
  endIso: string,
): Promise<MicrosoftCalendarEventRow[]> {
  const params = new URLSearchParams({
    startDateTime: startIso,
    endDateTime: endIso,
  });
  const url = `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="America/Sao_Paulo"',
    },
    signal: AbortSignal.timeout(45_000),
  });
  const json = (await res.json().catch(() => ({}))) as { value?: unknown; error?: { message?: string } };
  if (!res.ok) {
    const msg = json.error?.message || 'Falha ao ler calendário Microsoft.';
    throw new Error(msg);
  }
  const value = Array.isArray(json.value) ? json.value : [];
  const out: MicrosoftCalendarEventRow[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const e = row as GraphCalendarEvent;
    if (!e.id) continue;
    const startIso = toIso(e.start);
    const endIso = toIso(e.end);
    if (!startIso || !endIso) continue;
    out.push({
      id: e.id,
      subject: typeof e.subject === 'string' ? e.subject : '(sem título)',
      startIso,
      endIso,
      isAllDay: Boolean(e.isAllDay),
      location: e.location?.displayName ?? null,
    });
  }
  out.sort((a, b) => a.startIso.localeCompare(b.startIso));
  return out;
}
