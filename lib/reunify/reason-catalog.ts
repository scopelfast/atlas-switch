export type ReunifyReasonType = 'CANCEL' | 'RESCHEDULE';

export type ReunifyReasonOption = {
  code: string;
  label: string;
};

export const DEFAULT_REUNIFY_REASON_CATALOG: Record<ReunifyReasonType, ReunifyReasonOption[]> = {
  CANCEL: [
    { code: 'ALINHAMENTO_INTERNO', label: 'Alinhamento interno pendente' },
    { code: 'AUSENCIA_PARTICIPANTES', label: 'Ausência de participantes-chave' },
    { code: 'BLOQUEIO_TECNICO', label: 'Bloqueio técnico/operacional' },
    { code: 'MUDANCA_PRIORIDADE', label: 'Mudança de prioridade' },
    { code: 'OUTRO', label: 'Outro motivo' },
  ],
  RESCHEDULE: [
    { code: 'CONFLITO_AGENDA', label: 'Conflito de agenda' },
    { code: 'AUSENCIA_PARTICIPANTES', label: 'Ausência de participantes-chave' },
    { code: 'DEPENDENCIA_NAO_CONCLUIDA', label: 'Dependência não concluída' },
    { code: 'MUDANCA_ESCOPO', label: 'Mudança de escopo/objetivo' },
    { code: 'OUTRO', label: 'Outro motivo' },
  ],
};

export function normalizeReunifyReasonType(value: unknown): ReunifyReasonType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'CANCEL' || normalized === 'RESCHEDULE') {
    return normalized;
  }
  return null;
}
