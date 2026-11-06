/**
 * Rate limit em memória por (teamId, IP). MVP: janela deslizante 1h; em várias instâncias não partilha estado.
 * E8.7 — anti-abuso do formulário público.
 */
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;

export function checkPublicPortalRateLimit(teamId: number, ip: string): boolean {
  const key = `${teamId}:${ip}`;
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
