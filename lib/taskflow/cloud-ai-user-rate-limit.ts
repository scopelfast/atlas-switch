/**
 * E8.11 — limite em memória por utilizador (evita abuso rápido). MVP: 40 pedidos / hora.
 */
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 40;

export function checkTaskflowCloudAiUserRateLimit(userId: number): boolean {
  const key = String(userId);
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
