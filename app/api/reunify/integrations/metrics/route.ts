import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getIntegrationSyncMetrics } from '@/lib/db/integration-sync-events';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * IM3.1 — métricas operacionais de sincronização (janela padrão: 24h).
 */
export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const hoursRaw = Number(url.searchParams.get('hours') ?? '24');
  const lookbackHours = Number.isFinite(hoursRaw) ? Math.max(1, Math.min(24 * 30, hoursRaw)) : 24;
  const integrationKey = url.searchParams.get('integrationKey')?.trim() || 'reunify_to_chronos';

  const metrics = await getIntegrationSyncMetrics(team.id, integrationKey, lookbackHours);
  return NextResponse.json(metrics);
}
