/**
 * M3.1 — prioridade da tag alinhada às quatro faixas do memorial (Urgente, Alta, Média, Baixa).
 * Valores persistidos em inglês, maiúsculas, coerentes com `taskflow_tasks.priority` (M3.2).
 */
export const LABEL_PRIORITY_VALUES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;

export type LabelPriority = (typeof LABEL_PRIORITY_VALUES)[number];

const SET = new Set<string>(LABEL_PRIORITY_VALUES);

const ALIASES: Record<string, LabelPriority> = {
  URGENTE: 'URGENT',
  ALTA: 'HIGH',
  MEDIA: 'MEDIUM',
  MEDIO: 'MEDIUM',
  BAIXA: 'LOW',
};

export function normalizeLabelPriority(raw: unknown): LabelPriority {
  if (typeof raw !== 'string') return 'MEDIUM';
  const u = raw.trim().toUpperCase();
  if (SET.has(u)) return u as LabelPriority;
  return ALIASES[u] ?? 'MEDIUM';
}

/**
 * M3.2 — prioridade da tarefa = a mais urgente entre as tags aplicadas (idempotente para o mesmo conjunto).
 * `null` quando não há tags: não altera `taskflow_tasks.priority` (evita apagar prioridade manual ao limpar tags).
 */
export function taskPriorityFromAppliedLabelRows(
  rows: readonly { priority: string | null | undefined }[],
): LabelPriority | null {
  if (rows.length === 0) return null;
  let best: LabelPriority = 'LOW';
  let bestKey = labelPrioritySortKey(best);
  for (const row of rows) {
    const p = normalizeLabelPriority(row.priority);
    const k = labelPrioritySortKey(p);
    if (k < bestKey) {
      bestKey = k;
      best = p;
    }
  }
  return best;
}

/** Ordem de exibição: mais urgente primeiro. */
export function labelPrioritySortKey(p: string): number {
  switch (p) {
    case 'URGENT':
      return 0;
    case 'HIGH':
      return 1;
    case 'MEDIUM':
      return 2;
    case 'LOW':
      return 3;
    default:
      return 9;
  }
}
