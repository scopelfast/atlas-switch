import { NextResponse } from 'next/server';
import { canConfigureTaskflowBoard, hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { listPendingPortalSubmissions } from '@/lib/db/taskflow-portal';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/** E8.7 — fila de moderação (owner/admin/gestor com configurar quadro). */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const role = normalizeRole(user.role);
  if (!hasPermission(role, 'taskflow.view') || !canConfigureTaskflowBoard(role)) {
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

  const rows = await listPendingPortalSubmissions(team.id);
  return NextResponse.json(rows);
}
