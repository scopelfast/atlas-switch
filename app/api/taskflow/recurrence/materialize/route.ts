import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { materializeTaskflowRecurrences } from '@/lib/db/taskflow';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * Gera instâncias de tarefas recorrentes até ao horizonte configurado (M6.6).
 */
export async function POST() {
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
    const { created } = await materializeTaskflowRecurrences(team.id);
    return NextResponse.json({ ok: true, created });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao materializar recorrências';
    console.error('[POST /api/taskflow/recurrence/materialize]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
