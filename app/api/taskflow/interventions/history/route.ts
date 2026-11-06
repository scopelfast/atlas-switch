import { NextResponse } from 'next/server';
import { canConfigureTaskflowBoard, hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { listInterventionHistory } from '@/lib/db/taskflow-interventions';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const role = normalizeRole(user.role);
  if (!hasPermission(role, 'taskflow.view')) {
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

  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get('limit') ?? '40');

  try {
    const items = await listInterventionHistory({
      teamId: team.id,
      viewerUserId: user.id,
      listAllTeam: canConfigureTaskflowBoard(role),
      limit: Number.isFinite(rawLimit) ? rawLimit : 40,
    });
    return NextResponse.json({ items });
  } catch (e: unknown) {
    console.error('[GET /api/taskflow/interventions/history]', e);
    return NextResponse.json({ error: 'Erro ao listar histórico' }, { status: 500 });
  }
}
