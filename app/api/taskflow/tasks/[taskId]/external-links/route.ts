import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { activityLogs, ActivityType } from '@/lib/db/schema';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowTaskForTeam } from '@/lib/db/taskflow';
import {
  insertTaskflowExternalLink,
  listTaskflowExternalLinks,
} from '@/lib/db/taskflow-external-links';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, context: RouteContext) {
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
  const taskId = Number((await context.params).taskId);
  if (!Number.isFinite(taskId) || taskId < 1) {
    return NextResponse.json({ error: 'taskId inválido' }, { status: 400 });
  }
  const task = await getTaskflowTaskForTeam(taskId, team.id, taskflowBoardOptionsForUser(user.id, user.role));
  if (!task) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }
  const links = await listTaskflowExternalLinks(team.id, taskId);
  return NextResponse.json({ links });
}

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
  const taskId = Number((await context.params).taskId);
  if (!Number.isFinite(taskId) || taskId < 1) {
    return NextResponse.json({ error: 'taskId inválido' }, { status: 400 });
  }
  const task = await getTaskflowTaskForTeam(taskId, team.id, taskflowBoardOptionsForUser(user.id, user.role));
  if (!task) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!url.startsWith('https://') || url.length > 2048) {
    return NextResponse.json(
      { error: 'url é obrigatória e deve começar por https:// (máx. 2048 caracteres)' },
      { status: 400 },
    );
  }
  const provider =
    typeof o.provider === 'string' && o.provider.trim()
      ? o.provider.trim().slice(0, 32)
      : 'manual';
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 240) : '';
  const externalRef =
    typeof o.externalRef === 'string'
      ? o.externalRef.trim().slice(0, 120)
      : typeof o.external_ref === 'string'
        ? o.external_ref.trim().slice(0, 120)
        : '';

  const row = await insertTaskflowExternalLink({
    teamId: team.id,
    taskId,
    provider,
    url,
    title: title || null,
    externalRef: externalRef || null,
  });
  if (!row) {
    return NextResponse.json({ error: 'Não foi possível criar a ligação' }, { status: 500 });
  }

  await db.insert(activityLogs).values({
    teamId: team.id,
    userId: user.id,
    action: ActivityType.TASKFLOW_DEV_LINK_ADDED,
    timestamp: new Date(),
  });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
