import { createHmac } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getTaskAssigneeIds } from '@/lib/db/taskflow';
import {
  taskflowBoards,
  taskflowWebhookDeliveries,
  taskflowWebhooks,
  taskflowTasks,
} from '@/lib/db/schema';

/** Limite por time (MVP; planos SaaS podem restringir depois). */
export const TASKFLOW_WEBHOOK_MAX_PER_TEAM = 5;

export type TaskflowWebhookEventType = 'task.created' | 'task.updated';

function parseEventsCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function webhookWantsEvent(webhookEvents: string, eventType: string): boolean {
  return parseEventsCsv(webhookEvents).includes(eventType.toLowerCase());
}

/** HTTPS apenas; bloqueia localhost e redes privadas comuns (mitigação SSRF básica). */
export function isAllowedOutboundWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return false;
  if (host === '[::1]' || host === '::1') return false;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
  }
  return true;
}

export async function buildTaskWebhookPayload(
  teamId: number,
  eventType: TaskflowWebhookEventType,
  taskId: number,
): Promise<Record<string, unknown> | null> {
  const rows = await db
    .select({
      id: taskflowTasks.id,
      title: taskflowTasks.title,
      columnId: taskflowTasks.columnId,
      statusId: taskflowTasks.statusId,
      priority: taskflowTasks.priority,
      dueDate: taskflowTasks.dueDate,
      teamId: taskflowBoards.teamId,
    })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(and(eq(taskflowTasks.id, taskId), eq(taskflowBoards.teamId, teamId)))
    .limit(1);
  const t = rows[0];
  if (!t) return null;
  const assigneeIds = await getTaskAssigneeIds(taskId);
  const due =
    t.dueDate instanceof Date
      ? t.dueDate.toISOString()
      : t.dueDate
        ? new Date(t.dueDate as string | number).toISOString()
        : null;
  return {
    event: eventType,
    teamId: t.teamId,
    task: {
      id: t.id,
      title: t.title,
      columnId: t.columnId,
      statusId: t.statusId,
      priority: t.priority,
      dueDate: due,
      assigneeIds,
    },
    sentAt: new Date().toISOString(),
  };
}

async function dispatchTaskflowWebhooks(
  teamId: number,
  eventType: TaskflowWebhookEventType,
  dedupeKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const key = dedupeKey.slice(0, 200);
  const hooks = await db
    .select()
    .from(taskflowWebhooks)
    .where(and(eq(taskflowWebhooks.teamId, teamId), eq(taskflowWebhooks.enabled, true)));

  const bodyStr = JSON.stringify(payload);

  for (const h of hooks) {
    if (!isAllowedOutboundWebhookUrl(h.targetUrl)) continue;
    if (!webhookWantsEvent(h.events, eventType)) continue;

    const inserted = await db
      .insert(taskflowWebhookDeliveries)
      .values({
        webhookId: h.id,
        dedupeKey: key,
      })
      .onConflictDoNothing()
      .returning({ id: taskflowWebhookDeliveries.id });

    if (inserted.length === 0) continue;
    const deliveryId = inserted[0].id;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AtlasSwitch-Webhook/1',
      'X-Atlas-Event': eventType,
    };
    if (h.secret) {
      const sig = createHmac('sha256', h.secret).update(bodyStr).digest('hex');
      headers['X-Atlas-Webhook-Signature'] = sig;
    }

    try {
      const res = await fetch(h.targetUrl, {
        method: 'POST',
        headers,
        body: bodyStr,
        signal: AbortSignal.timeout(8000),
      });
      const errText = res.ok ? null : (await res.text().catch(() => '')).slice(0, 800);
      await db
        .update(taskflowWebhookDeliveries)
        .set({ httpStatus: res.status, errorMessage: errText })
        .where(eq(taskflowWebhookDeliveries.id, deliveryId));
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 800) : 'fetch_error';
      await db
        .update(taskflowWebhookDeliveries)
        .set({ httpStatus: null, errorMessage: msg })
        .where(eq(taskflowWebhookDeliveries.id, deliveryId));
    }
  }
}

/**
 * Entrega assíncrona (não bloqueia a resposta HTTP da mutação Taskflow).
 * Deduplicação: par único (`webhook_id`, `dedupe_key`) — não reenvia o mesmo evento ao mesmo endpoint.
 */
export function dispatchTaskflowWebhooksFireAndForget(
  teamId: number,
  eventType: TaskflowWebhookEventType,
  dedupeKey: string,
  payload: Record<string, unknown>,
): void {
  void dispatchTaskflowWebhooks(teamId, eventType, dedupeKey, payload).catch((e) =>
    console.error('[E8.5 taskflow webhooks]', e),
  );
}
