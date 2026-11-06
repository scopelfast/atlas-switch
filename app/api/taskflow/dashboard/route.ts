import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowDashboardStats } from '@/lib/db/taskflow-dashboard-stats';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';

/**
 * E7.1 — agregados para gráficos (estado, carga por responsável, horas estimadas vs intervenções).
 */
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
    const vis = taskflowBoardOptionsForUser(user.id, user.role);
    const stats = await getTaskflowDashboardStats(team.id, {
      listScope: vis.listScope,
      viewerUserId: vis.viewerUserId,
    });
    return NextResponse.json(stats);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao carregar relatórios';
    console.error('[GET /api/taskflow/dashboard]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
