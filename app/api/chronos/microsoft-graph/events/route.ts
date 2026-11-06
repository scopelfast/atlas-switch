import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getMicrosoftGraphAccessToken } from '@/lib/db/user-microsoft-graph';
import { fetchMicrosoftCalendarView } from '@/lib/microsoft-graph/calendar';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pré-visualização só leitura do calendário Microsoft na janela [from, to] (datas YYYY-MM-DD, UTC meia-noite).
 * Não escreve em `chronos_agenda_items`.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!hasPermission(normalizeRole(user.role), 'chronos.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
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
  if ((await getPlatformSetting('integrations.microsoft_graph')) !== 'true') {
    return NextResponse.json({ error: 'Integração desligada na instância.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: 'Indique from e to no formato YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const access = await getMicrosoftGraphAccessToken(user.id);
    const startIso = `${from}T00:00:00.000Z`;
    const endIso = `${to}T23:59:59.999Z`;
    const events = await fetchMicrosoftCalendarView(access, startIso, endIso);
    return NextResponse.json({ events, disclaimer: 'Somente leitura; não substitui compromissos Chronos.' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao ler Microsoft 365.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
