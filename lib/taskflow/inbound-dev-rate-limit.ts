/**
 * E8.10 — rate limit em memória para inbound dev (por IP). MVP: 30 pedidos / hora.
 * Em várias instâncias o estado não é partilhado.
 */
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;

export function checkTaskflowInboundDevRateLimit(ip: string): boolean {
  const key = ip.slice(0, 45) || 'unknown';
  const now = Date.now();
  const list = buckets.get(key) ?? [];
  const pruned = list.filter((t) => now - t < WINDOW_MS);
  if (pruned.length >= MAX_PER_WINDOW) {
    return false;
  }
  pruned.push(now);
  buckets.set(key, pruned);
  return true;
}
