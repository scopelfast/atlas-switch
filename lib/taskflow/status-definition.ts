export const TASKFLOW_FIXED_SITUATIONS = [
  'OPEN',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
  'CANCELLED',
] as const;

export type TaskflowFixedSituation = (typeof TASKFLOW_FIXED_SITUATIONS)[number];

export function normalizeFixedSituation(raw: unknown): TaskflowFixedSituation | null {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return (TASKFLOW_FIXED_SITUATIONS as readonly string[]).includes(s)
    ? (s as TaskflowFixedSituation)
    : null;
}

const CODE_RE = /^[a-z][a-z0-9_]{0,38}$/;

export function normalizeStatusDefinitionCode(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!CODE_RE.test(s)) {
    return {
      ok: false,
      error: 'Código inválido: use minúsculas, comece com letra, até 39 caracteres (a-z, 0-9, _).',
    };
  }
  return { ok: true, value: s };
}
