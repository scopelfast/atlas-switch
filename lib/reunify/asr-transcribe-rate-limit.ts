/** Limite simples de pedidos de transcrição por utilizador (E8.18). */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map<number, number[]>();

export function checkReunifyAsrTranscribeRateLimit(userId: number): boolean {
  const now = Date.now();
  const list = hits.get(userId) || [];
  const recent = list.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return false;
  }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}
