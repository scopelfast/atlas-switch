import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { startIntervention } from '@/lib/db/taskflow-interventions';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export async function POST(request: Request) {
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

  let body: { taskId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const taskId = Number(body?.taskId);
  if (!taskId) {
    return NextResponse.json({ error: 'taskId é obrigatório' }, { status: 400 });
  }

  try {
    const row = await startIntervention({
      teamId: team.id,
      userId: user.id,
      taskId,
      role: user.role,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao iniciar intervenção';
    const status = message.includes('Já existe') || message.includes('encerrada') ? 409 : 400;
    console.error('[POST /api/taskflow/interventions]', e);
    return NextResponse.json({ error: message }, { status });
  }
}
