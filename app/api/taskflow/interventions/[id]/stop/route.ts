import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { ActivityType, activityLogs } from '@/lib/db/schema';
import { stopIntervention } from '@/lib/db/taskflow-interventions';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
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

  const { id: rawId } = await context.params;
  const interventionId = Number(rawId);
  if (!interventionId) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  let body: { reportedStatus?: unknown; details?: unknown; syncTaskStatusId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const reportedStatus =
    typeof body.reportedStatus === 'string' ? body.reportedStatus : '';
  const details = typeof body.details === 'string' ? body.details : null;

  let syncTaskStatusId: number | null | undefined;
  if (body.syncTaskStatusId !== undefined && body.syncTaskStatusId !== null && body.syncTaskStatusId !== '') {
    const n = Number(body.syncTaskStatusId);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: 'syncTaskStatusId inválido' }, { status: 400 });
    }
    syncTaskStatusId = Math.trunc(n);
  }

  try {
    const row = await stopIntervention({
      teamId: team.id,
      userId: user.id,
      interventionId,
      reportedStatus,
      details,
      role: user.role,
      syncTaskStatusId,
    });

    await db.insert(activityLogs).values({
      teamId: team.id,
      userId: user.id,
      action: ActivityType.TASKFLOW_INTERVENTION_STOP,
      timestamp: new Date(),
    });

    return NextResponse.json(row);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao encerrar intervenção';
    const status =
      message.includes('já foi encerrada') || message.includes('não encontrada') ? 409 : 400;
    console.error('[POST /api/taskflow/interventions/.../stop]', e);
    return NextResponse.json({ error: message }, { status });
  }
}
