/**
 * M6.1 — tipos nativos (códigos estáveis em minúsculas; rótulos em PT na UI).
 * Tipos extensíveis: `taskflow_task_type_definitions` por time (código único por time).
 */

export const NATIVE_TASK_TYPES = [
  { code: 'generic', label: 'Geral' },
  { code: 'feature', label: 'Funcionalidade / melhoria' },
  { code: 'bug', label: 'Correcção / incidente' },
  { code: 'support', label: 'Suporte a cliente ou interno' },
  { code: 'research', label: 'Pesquisa ou análise' },
  { code: 'meeting_action', label: 'Seguimento de reunião' },
  { code: 'chore', label: 'Manutenção ou tarefa operacional' },
] as const;

export type NativeTaskTypeCode = (typeof NATIVE_TASK_TYPES)[number]['code'];

export const NATIVE_TASK_TYPE_CODES = new Set<string>(
  NATIVE_TASK_TYPES.map((t) => t.code),
);

export function nativeTaskTypeLabel(code: string): string | null {
  const row = NATIVE_TASK_TYPES.find((t) => t.code === code);
  return row ? row.label : null;
}

const CODE_RE = /^[a-z][a-z0-9_]{0,38}$/;

export function normalizeCustomTaskTypeCode(
  raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!CODE_RE.test(s)) {
    return {
      ok: false,
      error: 'Código inválido: use minúsculas, comece com letra, até 39 caracteres (a-z, 0-9, _).',
    };
  }
  if (NATIVE_TASK_TYPE_CODES.has(s)) {
    return {
      ok: false,
      error: 'Este código está reservado para um tipo nativo; escolha outro.',
    };
  }
  return { ok: true, value: s };
}

export function taskTypeDisplayLabel(
  code: string,
  customDefinitions: { code: string; name: string }[],
): string {
  const native = nativeTaskTypeLabel(code);
  if (native) {
    return native;
  }
  const custom = customDefinitions.find((d) => d.code === code);
  return custom?.name ?? code;
}
