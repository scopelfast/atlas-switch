import { NextResponse } from 'next/server';
import { reconcileReunifyToChronosForTeam } from '@/lib/chronos/reunify-reconcile';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

type TeamReconcileRun = {
  teamId: number;
  status: 'reconciled' | 'skipped' | 'error';
  reason?: string;
  scanned?: number;
  created?: number;
  updated?: number;
  removed?: number;
};

function readCronSecretFromRequest(request: Request): string {
  const headerSecret = request.headers.get('x-atlas-cron-secret')?.trim();
  if (headerSecret) return headerSecret;
  const authHeader = request.headers.get('authorization')?.trim() ?? '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

/**
 * IM3.2 — reconciliação agendada Reunify -> Chronos.
 * Chamar por scheduler externo com `x-atlas-cron-secret` (ou Authorization Bearer).
 */
export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || process.env.ATLAS_CRON_SECRET?.trim() || '';
  const providedSecret = readCronSecretFromRequest(request);

  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET/ATLAS_CRON_SECRET não configurado para job agendado.' },
      { status: 503 },
    );
  }
  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const onlyTeamIdRaw = Number(url.searchParams.get('teamId'));
  const maxTeamsRaw = Number(url.searchParams.get('maxTeams') ?? '100');
  const maxTeams = Number.isFinite(maxTeamsRaw) ? Math.max(1, Math.min(1000, maxTeamsRaw)) : 100;

  const targetTeams =
    Number.isInteger(onlyTeamIdRaw) && onlyTeamIdRaw > 0
      ? [{ id: onlyTeamIdRaw }]
      : await db.select({ id: teams.id }).from(teams).limit(maxTeams);

  const runs: TeamReconcileRun[] = [];
  let totals = { scanned: 0, created: 0, updated: 0, removed: 0 };

  for (const row of targetTeams) {
    const teamId = row.id;
    try {
      const [hasChronos, hasReunify] = await Promise.all([
        teamHasModuleEnabled(teamId, 'chronos'),
        teamHasModuleEnabled(teamId, 'reunify'),
      ]);

      if (!hasChronos || !hasReunify) {
        runs.push({
          teamId,
          status: 'skipped',
          reason: !hasChronos
            ? 'Módulo Chronos não habilitado no plano ativo.'
            : 'Módulo Reunify não habilitado no plano ativo.',
        });
        continue;
      }

      const result = await reconcileReunifyToChronosForTeam(teamId);
      totals = {
        scanned: totals.scanned + result.scanned,
        created: totals.created + result.created,
        updated: totals.updated + result.updated,
        removed: totals.removed + result.removed,
      };
      runs.push({ teamId, status: 'reconciled', ...result });
    } catch (e) {
      runs.push({
        teamId,
        status: 'error',
        reason: e instanceof Error ? e.message : 'Falha desconhecida',
      });
    }
  }

  return NextResponse.json({
    executedAt: new Date().toISOString(),
    totalTeams: targetTeams.length,
    reconciledTeams: runs.filter((r) => r.status === 'reconciled').length,
    skippedTeams: runs.filter((r) => r.status === 'skipped').length,
    errorTeams: runs.filter((r) => r.status === 'error').length,
    totals,
    runs,
  });
}
