import { NextResponse } from 'next/server';
import { isOwnerLike, normalizeRole } from '@/lib/auth/permissions';
import { reconcileReunifyToChronosForTeam } from '@/lib/chronos/reunify-reconcile';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * IM3.2 — reconciliação on-demand do espelho Reunify -> Chronos.
 */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isOwnerLike(normalizeRole(user.role))) {
    return NextResponse.json(
      { error: 'Apenas owner/admin podem executar reconciliação.' },
      { status: 403 },
    );
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
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  try {
    const result = await reconcileReunifyToChronosForTeam(team.id);

    return NextResponse.json({
      ...result,
      note: 'Reconciliação Reunify->Chronos concluída.',
    });
  } catch (e) {
    console.error('[POST /api/chronos/agenda/reconcile-reunify]', e);
    return NextResponse.json({ error: 'Falha ao reconciliar agenda Reunify/Chronos.' }, { status: 500 });
  }
}
