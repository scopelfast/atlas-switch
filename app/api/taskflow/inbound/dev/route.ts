import { NextResponse } from 'next/server';
import { activityLogs, ActivityType } from '@/lib/db/schema';
import { db } from '@/lib/db/drizzle';
import {
  getTaskflowTaskTeamId,
  insertTaskflowExternalLink,
} from '@/lib/db/taskflow-external-links';
import { resolveTeamIdFromInboundSecret } from '@/lib/db/team-taskflow-dev-integration';
import { getClientIp } from '@/lib/http/client-ip';
import { parseInboundDevLinkPayload } from '@/lib/taskflow/inbound-dev-payload';
import { checkTaskflowInboundDevRateLimit } from '@/lib/taskflow/inbound-dev-rate-limit';
const SECRET_HEADER = 'x-atlas-taskflow-dev-secret';

/**
 * E8.10 — inbound autenticado por segredo do time (sem cookie).
 * Corpo JSON: `{ "taskId", "url" (https), "title"?, "provider"?, "externalRef"? }`.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkTaskflowInboundDevRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  const secret = request.headers.get(SECRET_HEADER)?.trim() ?? '';
  if (!secret) {
    return NextResponse.json({ error: 'Cabeçalho X-Atlas-Taskflow-Dev-Secret em falta' }, { status: 401 });
  }

  const teamId = await resolveTeamIdFromInboundSecret(secret);
  if (teamId == null) {
    return NextResponse.json({ error: 'Segredo inválido' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = parseInboundDevLinkPayload(body);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Payload inválido: exija taskId (número) e url (https://…)' },
      { status: 400 },
    );
  }

  const taskTeam = await getTaskflowTaskTeamId(parsed.taskId);
  if (taskTeam !== teamId) {
    console.warn('[inbound/dev] taskId não pertence ao time do segredo', { taskId: parsed.taskId, teamId });
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const row = await insertTaskflowExternalLink({
    teamId,
    taskId: parsed.taskId,
    provider: parsed.provider,
    url: parsed.url,
    title: parsed.title,
    externalRef: parsed.externalRef,
  });
  if (!row) {
    return NextResponse.json({ error: 'Não foi possível criar a ligação' }, { status: 500 });
  }

  await db.insert(activityLogs).values({
    teamId,
    userId: null,
    action: ActivityType.TASKFLOW_DEV_LINK_ADDED,
    timestamp: new Date(),
    ipAddress: ip.slice(0, 45),
  });

  return NextResponse.json({ ok: true, linkId: row.id }, { status: 201 });
}
