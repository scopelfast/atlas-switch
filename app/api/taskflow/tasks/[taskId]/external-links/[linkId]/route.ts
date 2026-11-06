import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowTaskForTeam } from '@/lib/db/taskflow';
import { deleteTaskflowExternalLink } from '@/lib/db/taskflow-external-links';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

type RouteContext = { params: Promise<{ taskId: string; linkId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
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
  const { taskId: taskIdStr, linkId: linkIdStr } = await context.params;
  const taskId = Number(taskIdStr);
  const linkId = Number(linkIdStr);
  if (!Number.isFinite(taskId) || taskId < 1 || !Number.isFinite(linkId) || linkId < 1) {
    return NextResponse.json({ error: 'Identificadores inválidos' }, { status: 400 });
  }
  const task = await getTaskflowTaskForTeam(taskId, team.id, taskflowBoardOptionsForUser(user.id, user.role));
  if (!task) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const ok = await deleteTaskflowExternalLink(team.id, taskId, linkId);
  if (!ok) {
    return NextResponse.json({ error: 'Ligação não encontrada' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
