import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { deleteMicrosoftGraphLink } from '@/lib/db/user-microsoft-graph';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/** Remove ligação Microsoft Graph do utilizador (I8.3 — retirar consentimento). */
export async function DELETE() {
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

  await deleteMicrosoftGraphLink(user.id);
  return NextResponse.json({ ok: true });
}
