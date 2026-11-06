export type GoogleCalendarEventRow = {
  id: string;
  subject: string;
  startIso: string;
  endIso: string;
  isAllDay: boolean;
  location?: string | null;
};

type GcalTime = { date?: string; dateTime?: string; timeZone?: string };

type GcalEventItem = {
  id?: string;
  summary?: string;
  start?: GcalTime;
  end?: GcalTime;
  location?: string;
};

function parseWindow(start: GcalTime | undefined, end: GcalTime | undefined): {
  startIso: string;
  endIso: string;
  isAllDay: boolean;
} | null {
  if (!start) return null;
  if (typeof start.date === 'string') {
    const sd = start.date;
    const endDate =
      end && typeof end.date === 'string' && end.date.length > 0 ? end.date : sd;
    const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
    endExclusive.setUTCMilliseconds(endExclusive.getUTCMilliseconds() - 1);
    return {
      startIso: `${sd}T00:00:00.000Z`,
      endIso: endExclusive.toISOString(),
      isAllDay: true,
    };
  }
  if (typeof start.dateTime === 'string') {
    const st = start.dateTime;
    const et = end?.dateTime || st;
    const startD = new Date(st);
    const endD = new Date(et);
    if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) {
      return null;
    }
    return { startIso: startD.toISOString(), endIso: endD.toISOString(), isAllDay: false };
  }
  return null;
}

/**
 * Lista eventos do calendário principal (só leitura). Não grava no Chronos.
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMinIso: string,
  timeMaxIso: string,
): Promise<GoogleCalendarEventRow[]> {
  const params = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(45_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    items?: unknown;
    error?: { message?: string };
  };
  if (!res.ok) {
    const msg = json.error?.message || 'Falha ao ler Google Calendar.';
    throw new Error(msg);
  }
  const items = Array.isArray(json.items) ? json.items : [];
  const out: GoogleCalendarEventRow[] = [];
  for (const row of items) {
    if (!row || typeof row !== 'object') continue;
    const e = row as GcalEventItem;
    if (!e.id) continue;
    const win = parseWindow(e.start, e.end);
    if (!win) continue;
    out.push({
      id: e.id,
      subject: typeof e.summary === 'string' && e.summary.trim() ? e.summary : '(sem título)',
      startIso: win.startIso,
      endIso: win.endIso,
      isAllDay: win.isAllDay,
      location: typeof e.location === 'string' ? e.location : null,
    });
  }
  out.sort((a, b) => a.startIso.localeCompare(b.startIso));
  return out;
}
