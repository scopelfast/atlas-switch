export const PHASE_TYPES = ['INITIAL', 'PRODUCTION', 'FINAL'] as const;

export type PhaseType = (typeof PHASE_TYPES)[number];

const SET = new Set<string>(PHASE_TYPES);

export function normalizePhaseType(raw: unknown): PhaseType | null {
  if (typeof raw !== 'string') return null;
  const u = raw.trim().toUpperCase();
  if (SET.has(u)) return u as PhaseType;
  return null;
}

export function phaseTypeLabel(pt: PhaseType): string {
  switch (pt) {
    case 'INITIAL':
      return 'Inicial';
    case 'PRODUCTION':
      return 'Produção';
    case 'FINAL':
      return 'Final';
    default:
      return pt;
  }
}

export function phaseTypeLabelLoose(raw: string | null | undefined): string {
  const p = normalizePhaseType(raw ?? '');
  if (!p) return phaseTypeLabel('PRODUCTION');
  return phaseTypeLabel(p);
}
