import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getGoogleCalendarLink } from '@/lib/db/user-google-calendar';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/** Estado da ligação Google Calendar (sem tokens). */
export async function GET() {
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

  const platformEnabled = (await getPlatformSetting('integrations.google_calendar')) === 'true';
  const row = await getGoogleCalendarLink(user.id);

  return NextResponse.json({
    platformEnabled,
    linked: Boolean(row),
    googleEmail: row?.googleEmail ?? null,
    envReady: Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim() &&
        process.env.GOOGLE_REDIRECT_URI?.trim(),
    ),
  });
}
