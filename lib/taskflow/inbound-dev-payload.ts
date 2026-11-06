export type InboundDevLinkNormalized = {
  taskId: number;
  url: string;
  title: string | null;
  provider: string;
  externalRef: string | null;
};

/** JSON mínimo: `taskId`, `url` (https). GitHub nativo não envia `taskId` — use Action/script que inclua estes campos. */
export function parseInboundDevLinkPayload(body: unknown): InboundDevLinkNormalized | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const o = body as Record<string, unknown>;
  const taskIdRaw = o.taskId ?? o.task_id;
  const taskId =
    typeof taskIdRaw === 'number'
      ? taskIdRaw
      : typeof taskIdRaw === 'string'
        ? Number(taskIdRaw)
        : NaN;
  if (!Number.isFinite(taskId) || taskId < 1) {
    return null;
  }
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!url.startsWith('https://') || url.length > 2048) {
    return null;
  }
  const titleRaw = typeof o.title === 'string' ? o.title.trim().slice(0, 240) : '';
  const providerRaw =
    typeof o.provider === 'string' && o.provider.trim()
      ? o.provider.trim().slice(0, 32)
      : 'github';
  const ext =
    typeof o.externalRef === 'string'
      ? o.externalRef.trim().slice(0, 120)
      : typeof o.external_ref === 'string'
        ? o.external_ref.trim().slice(0, 120)
        : '';
  return {
    taskId: Math.floor(taskId),
    url,
    title: titleRaw ? titleRaw : null,
    provider: providerRaw,
    externalRef: ext ? ext : null,
  };
}
