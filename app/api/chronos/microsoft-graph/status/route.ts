import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getMicrosoftGraphLink } from '@/lib/db/user-microsoft-graph';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/** Estado da ligação Microsoft 365 (sem tokens). */
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

  const platformEnabled = (await getPlatformSetting('integrations.microsoft_graph')) === 'true';
  const row = await getMicrosoftGraphLink(user.id);

  return NextResponse.json({
    platformEnabled,
    linked: Boolean(row),
    graphEmail: row?.graphEmail ?? null,
    envReady: Boolean(
      process.env.MICROSOFT_CLIENT_ID?.trim() &&
        process.env.MICROSOFT_CLIENT_SECRET?.trim() &&
        process.env.MICROSOFT_REDIRECT_URI?.trim(),
    ),
  });
}
