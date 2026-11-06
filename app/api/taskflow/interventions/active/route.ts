import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { processTimerIdleAndGetActiveForUser } from '@/lib/db/taskflow-interventions';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!hasPermission(normalizeRole(user.role), 'taskflow.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  try {
    const { active } = await processTimerIdleAndGetActiveForUser(team.id, user.id);
    return NextResponse.json({ active });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao consultar intervenção';
    console.error('[GET /api/taskflow/interventions/active]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
