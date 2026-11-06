import { NextResponse } from 'next/server';
import { and, asc, count, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowWebhooks } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  isAllowedOutboundWebhookUrl,
  TASKFLOW_WEBHOOK_MAX_PER_TEAM,
} from '@/lib/taskflow/webhook-outbound';

function normalizeEvents(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    return 'task.created,task.updated';
  }
  return raw.trim().slice(0, 200);
}

/** E8.5 — listar webhooks do time (sem expor `secret`). */
export async function GET() {
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

  const rows = await db
    .select({
      id: taskflowWebhooks.id,
      name: taskflowWebhooks.name,
      targetUrl: taskflowWebhooks.targetUrl,
      events: taskflowWebhooks.events,
      enabled: taskflowWebhooks.enabled,
      secret: taskflowWebhooks.secret,
      createdAt: taskflowWebhooks.createdAt,
      updatedAt: taskflowWebhooks.updatedAt,
    })
    .from(taskflowWebhooks)
    .where(eq(taskflowWebhooks.teamId, team.id))
    .orderBy(asc(taskflowWebhooks.id));

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      targetUrl: r.targetUrl,
      events: r.events,
      enabled: r.enabled,
      hasSecret: Boolean(r.secret?.length),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  );
}

/** E8.5 — criar webhook. */
export async function POST(request: Request) {
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

  const [cnt] = await db
    .select({ n: count() })
    .from(taskflowWebhooks)
    .where(eq(taskflowWebhooks.teamId, team.id));
  if (Number(cnt?.n ?? 0) >= TASKFLOW_WEBHOOK_MAX_PER_TEAM) {
    return NextResponse.json(
      { error: `Limite de ${TASKFLOW_WEBHOOK_MAX_PER_TEAM} webhooks por time.` },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const name = typeof (body as { name?: unknown }).name === 'string' ? (body as { name: string }).name.trim() : '';
  const targetUrl =
    typeof (body as { targetUrl?: unknown }).targetUrl === 'string'
      ? (body as { targetUrl: string }).targetUrl.trim()
      : '';
  const secretRaw = (body as { secret?: unknown }).secret;
  const secret =
    typeof secretRaw === 'string' && secretRaw.trim() ? secretRaw.trim().slice(0, 128) : null;
  const events = normalizeEvents((body as { events?: unknown }).events);

  if (!name || !targetUrl) {
    return NextResponse.json({ error: 'name e targetUrl são obrigatórios' }, { status: 400 });
  }
  if (!isAllowedOutboundWebhookUrl(targetUrl)) {
    return NextResponse.json(
      { error: 'URL inválida: use https:// e evite localhost ou redes privadas.' },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(taskflowWebhooks)
    .values({
      teamId: team.id,
      name,
      targetUrl,
      secret,
      events,
      enabled: true,
      updatedAt: new Date(),
    })
    .returning({
      id: taskflowWebhooks.id,
      name: taskflowWebhooks.name,
      targetUrl: taskflowWebhooks.targetUrl,
      events: taskflowWebhooks.events,
      enabled: taskflowWebhooks.enabled,
    });

  return NextResponse.json({ ...created, hasSecret: Boolean(secret) }, { status: 201 });
}
