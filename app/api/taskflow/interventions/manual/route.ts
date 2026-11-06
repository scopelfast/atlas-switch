import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { ActivityType, activityLogs } from '@/lib/db/schema';
import { createManualIntervention } from '@/lib/db/taskflow-interventions';
import { isInterventionBusinessError } from '@/lib/taskflow/intervention-errors';
import { parsePlannedStartIso } from '@/lib/taskflow/task-schedule';
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

  let body: {
    taskId?: unknown;
    startedAt?: unknown;
    endedAt?: unknown;
    reportedStatus?: unknown;
    details?: unknown;
    syncTaskStatusId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const taskId = Number(body?.taskId);
  if (!taskId) {
    return NextResponse.json({ error: 'taskId é obrigatório' }, { status: 400 });
  }

  const started = parsePlannedStartIso(body.startedAt);
  const ended = parsePlannedStartIso(body.endedAt);
  if (!started.ok) {
    return NextResponse.json({ error: started.error }, { status: 400 });
  }
  if (!ended.ok) {
    return NextResponse.json({ error: ended.error }, { status: 400 });
  }
  if (!started.value || !ended.value) {
    return NextResponse.json({ error: 'startedAt e endedAt são obrigatórios' }, { status: 400 });
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
    const row = await createManualIntervention({
      teamId: team.id,
      userId: user.id,
      taskId,
      role: user.role,
      startedAt: started.value,
      endedAt: ended.value,
      reportedStatus,
      details,
      syncTaskStatusId,
    });

    await db.insert(activityLogs).values({
      teamId: team.id,
      userId: user.id,
      action: ActivityType.TASKFLOW_INTERVENTION_MANUAL,
      timestamp: new Date(),
    });

    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if (isInterventionBusinessError(e)) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : 'Erro ao registar intervenção manual';
    console.error('[POST /api/taskflow/interventions/manual]', e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
