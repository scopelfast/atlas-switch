import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowWebhooks } from '@/lib/db/schema';
import { isAllowedOutboundWebhookUrl } from '@/lib/taskflow/webhook-outbound';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

async function getWebhookForTeam(teamId: number, id: number) {
  const [row] = await db
    .select()
    .from(taskflowWebhooks)
    .where(and(eq(taskflowWebhooks.id, id), eq(taskflowWebhooks.teamId, teamId)))
    .limit(1);
  return row;
}

/** E8.5 — atualizar webhook. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
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

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await getWebhookForTeam(team.id, id);
  if (!existing) {
    return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const patch = body as Record<string, unknown>;
  const next: Partial<typeof taskflowWebhooks.$inferInsert> = {};

  if (typeof patch.name === 'string') {
    const n = patch.name.trim();
    if (!n) return NextResponse.json({ error: 'name vazio' }, { status: 400 });
    next.name = n;
  }
  if (typeof patch.targetUrl === 'string') {
    const u = patch.targetUrl.trim();
    if (!u) return NextResponse.json({ error: 'targetUrl vazio' }, { status: 400 });
    if (!isAllowedOutboundWebhookUrl(u)) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }
    next.targetUrl = u;
  }
  if (typeof patch.events === 'string') {
    next.events = patch.events.trim().slice(0, 200) || 'task.created,task.updated';
  }
  if (typeof patch.enabled === 'boolean') {
    next.enabled = patch.enabled;
  }
  if (patch.secret !== undefined) {
    if (patch.secret === null || patch.secret === '') {
      next.secret = null;
    } else if (typeof patch.secret === 'string') {
      next.secret = patch.secret.trim().slice(0, 128) || null;
    }
  }

  if (Object.keys(next).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  next.updatedAt = new Date();

  const [updated] = await db
    .update(taskflowWebhooks)
    .set(next)
    .where(eq(taskflowWebhooks.id, id))
    .returning({
      id: taskflowWebhooks.id,
      name: taskflowWebhooks.name,
      targetUrl: taskflowWebhooks.targetUrl,
      events: taskflowWebhooks.events,
      enabled: taskflowWebhooks.enabled,
      secret: taskflowWebhooks.secret,
    });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    targetUrl: updated.targetUrl,
    events: updated.events,
    enabled: updated.enabled,
    hasSecret: Boolean(updated.secret?.length),
  });
}

/** E8.5 — remover webhook. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
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

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const del = await db
    .delete(taskflowWebhooks)
    .where(and(eq(taskflowWebhooks.id, id), eq(taskflowWebhooks.teamId, team.id)))
    .returning({ id: taskflowWebhooks.id });

  if (del.length === 0) {
    return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
