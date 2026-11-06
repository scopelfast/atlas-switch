import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { saasPlanModules, teamPlans } from '@/lib/db/schema';

/**
 * Retorna `true` quando há pelo menos um plano ATIVO com o módulo habilitado.
 * Sem plano ATIVO, devolve `true` para não bloquear ambientes de dev/pre-contrato.
 */
export async function teamHasModuleEnabled(teamId: number, moduleKey: string): Promise<boolean> {
  const activePlanRows = await db
    .select({ id: teamPlans.id })
    .from(teamPlans)
    .where(and(eq(teamPlans.teamId, teamId), eq(teamPlans.status, 'ATIVO')))
    .limit(1);

  if (activePlanRows.length === 0) {
    return true;
  }

  const enabledRows = await db
    .select({ id: teamPlans.id })
    .from(teamPlans)
    .innerJoin(saasPlanModules, eq(teamPlans.planId, saasPlanModules.planId))
    .where(
      and(
        eq(teamPlans.teamId, teamId),
        eq(teamPlans.status, 'ATIVO'),
        eq(saasPlanModules.moduleKey, moduleKey),
        eq(saasPlanModules.enabled, true),
      ),
    )
    .limit(1);

  return enabledRows.length > 0;
}
