/**
 * M6.10 — situações fixas que encerram o ciclo operacional da tarefa (não mover no Kanban nem trocar responsáveis).
 */
export function isTaskflowStatusTerminal(fixedSituation: string | null | undefined): boolean {
  const s = typeof fixedSituation === 'string' ? fixedSituation.trim().toUpperCase() : '';
  return s === 'DONE' || s === 'CANCELLED';
}
