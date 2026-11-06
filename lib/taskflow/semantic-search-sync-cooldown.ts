/** Evita sincronizações repetidas em sequência (MVP: 90 s por equipa). */
const last = new Map<number, number>();
const WINDOW_MS = 90_000;

export function canStartSemanticSync(teamId: number): boolean {
  const now = Date.now();
  const prev = last.get(teamId) ?? 0;
  if (now - prev < WINDOW_MS) {
    return false;
  }
  last.set(teamId, now);
  return true;
}
