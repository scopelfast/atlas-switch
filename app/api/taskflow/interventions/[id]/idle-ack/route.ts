import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { ActivityType, activityLogs } from '@/lib/db/schema';
import { ackTimerInterventionIdle } from '@/lib/db/taskflow-interventions';
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

  let body: { response?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const response = body.response === 'yes' || body.response === 'no' ? body.response : null;
  if (!response) {
    return NextResponse.json({ error: 'response deve ser «yes» ou «no»' }, { status: 400 });
  }

  try {
    const row = await ackTimerInterventionIdle({
      teamId: team.id,
      userId: user.id,
      interventionId,
      response,
      role: user.role,
    });

    if (response === 'no') {
      await db.insert(activityLogs).values({
        teamId: team.id,
        userId: user.id,
        action: ActivityType.TASKFLOW_INTERVENTION_STOP,
        timestamp: new Date(),
      });
    }

    return NextResponse.json(row);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao registar resposta';
    console.error('[POST /api/taskflow/interventions/.../idle-ack]', e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
