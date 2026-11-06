import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowWeeklyCapacityLoad } from '@/lib/db/taskflow-weekly-capacity';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * E8.6 — carga semanal (estimativa partilhada em tarefas abertas + horas reais de intervenções na semana UTC).
 * Query opcional: `week=YYYY-MM-DD` (qualquer dia da semana desejada).
 */
export async function GET(request: Request) {
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

  const weekParam = new URL(request.url).searchParams.get('week');
  let anchor = new Date();
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    const parsed = new Date(`${weekParam}T12:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      anchor = parsed;
    }
  }

  try {
    const vis = taskflowBoardOptionsForUser(user.id, user.role);
    const payload = await getTaskflowWeeklyCapacityLoad(team.id, anchor, {
      listScope: vis.listScope,
      viewerUserId: vis.viewerUserId,
    });
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao calcular carga semanal';
    console.error('[GET /api/taskflow/weekly-capacity]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
