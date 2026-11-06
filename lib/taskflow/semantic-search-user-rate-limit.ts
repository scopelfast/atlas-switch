/** Limite de pedidos de busca semântica por utilizador (MVP: 60 / hora). */
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 60;

export function checkSemanticSearchUserRateLimit(userId: number): boolean {
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
