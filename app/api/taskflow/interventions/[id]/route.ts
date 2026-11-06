import { NextResponse } from 'next/server';
import { canConfigureTaskflowBoard, hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { ActivityType, activityLogs } from '@/lib/db/schema';
import {
  deleteInterventionById,
  getInterventionRowForTeam,
  updateInterventionById,
} from '@/lib/db/taskflow-interventions';
import { isInterventionBusinessError } from '@/lib/taskflow/intervention-errors';
import { parsePlannedStartIso } from '@/lib/taskflow/task-schedule';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

type RouteContext = { params: Promise<{ id: string }> };

function canEditOrDeleteIntervention(params: {
  actorUserId: number;
  interventionOwnerId: number;
  role: ReturnType<typeof normalizeRole>;
}): boolean {
  const { actorUserId, interventionOwnerId, role } = params;
  if (!hasPermission(role, 'taskflow.view')) {
    return false;
  }
  if (actorUserId === interventionOwnerId) {
    return true;
  }
  return canConfigureTaskflowBoard(role);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
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

  const role = normalizeRole(user.role);
  const { id: rawId } = await context.params;
  const interventionId = Number(rawId);
  if (!interventionId) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await getInterventionRowForTeam(team.id, interventionId);
  if (!existing) {
    return NextResponse.json({ error: 'Intervenção não encontrada' }, { status: 404 });
  }

  if (!canEditOrDeleteIntervention({ actorUserId: user.id, interventionOwnerId: existing.userId, role })) {
    return NextResponse.json({ error: 'Sem permissão para editar este registo' }, { status: 403 });
  }

  let body: {
    startedAt?: unknown;
    endedAt?: unknown;
    reportedStatus?: unknown;
    details?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  let startedAt: Date | undefined;
  let endedAt: Date | undefined;
  if (body.startedAt !== undefined) {
    const p = parsePlannedStartIso(body.startedAt);
    if (!p.ok || !p.value) {
      return NextResponse.json({ error: p.ok ? 'startedAt obrigatório' : p.error }, { status: 400 });
    }
    startedAt = p.value;
  }
  if (body.endedAt !== undefined) {
    const p = parsePlannedStartIso(body.endedAt);
    if (!p.ok || !p.value) {
      return NextResponse.json({ error: p.ok ? 'endedAt obrigatório' : p.error }, { status: 400 });
    }
    endedAt = p.value;
  }

  const reportedStatus =
    body.reportedStatus !== undefined && typeof body.reportedStatus === 'string'
      ? body.reportedStatus
      : undefined;
  const details =
    body.details === undefined
      ? undefined
      : typeof body.details === 'string'
        ? body.details
        : null;

  try {
    const row = await updateInterventionById({
      teamId: team.id,
      interventionId,
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(endedAt !== undefined ? { endedAt } : {}),
      ...(reportedStatus !== undefined ? { reportedStatus } : {}),
      ...(details !== undefined ? { details } : {}),
    });

    await db.insert(activityLogs).values({
      teamId: team.id,
      userId: user.id,
      action: ActivityType.TASKFLOW_INTERVENTION_EDIT,
      timestamp: new Date(),
    });

    return NextResponse.json(row);
  } catch (e: unknown) {
    if (isInterventionBusinessError(e)) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : 'Erro ao actualizar intervenção';
    const status =
      message.includes('não encontrada') || message.includes('ainda aberta') ? 409 : 400;
    console.error('[PATCH /api/taskflow/interventions/[id]]', e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
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

  const role = normalizeRole(user.role);
  const { id: rawId } = await context.params;
  const interventionId = Number(rawId);
  if (!interventionId) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await getInterventionRowForTeam(team.id, interventionId);
  if (!existing) {
    return NextResponse.json({ error: 'Intervenção não encontrada' }, { status: 404 });
  }

  if (!canEditOrDeleteIntervention({ actorUserId: user.id, interventionOwnerId: existing.userId, role })) {
    return NextResponse.json({ error: 'Sem permissão para apagar este registo' }, { status: 403 });
  }

  try {
    await deleteInterventionById(team.id, interventionId);

    await db.insert(activityLogs).values({
      teamId: team.id,
      userId: user.id,
      action: ActivityType.TASKFLOW_INTERVENTION_DELETE,
      timestamp: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao apagar intervenção';
    const status =
      message.includes('não encontrada') || message.includes('ainda aberta') ? 409 : 400;
    console.error('[DELETE /api/taskflow/interventions/[id]]', e);
    return NextResponse.json({ error: message }, { status });
  }
}
