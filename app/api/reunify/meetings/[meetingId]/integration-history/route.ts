import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { listIntegrationSyncEventsForEntity } from '@/lib/db/integration-sync-events';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

type RouteContext = { params: Promise<{ meetingId: string }> };

/**
 * IM3.3 — trilha de integração por reunião (Reunify -> Chronos).
 */
export async function GET(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!hasPermission(normalizeRole(user.role), 'reunify.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const meetingId = Number((await context.params).meetingId);
  if (!Number.isFinite(meetingId) || meetingId < 1) {
    return NextResponse.json({ error: 'meetingId inválido' }, { status: 400 });
  }

  const rows = await listIntegrationSyncEventsForEntity(team.id, 'reunify_meeting', meetingId, 200);
  return NextResponse.json(rows);
}
