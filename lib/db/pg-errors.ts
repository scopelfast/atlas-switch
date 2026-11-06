/**
 * Postgres `42703` — coluna inexistente (ex.: migração ainda não aplicada).
 * Aceita cadeia `cause` (drivers / adaptadores).
 */
export function isPostgresUndefinedColumnError(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 12 && cur; i += 1) {
    if (typeof cur === 'object' && cur !== null) {
      const o = cur as { code?: unknown; message?: unknown; cause?: unknown };
      if (o.code === '42703') {
        return true;
      }
      const msg = typeof o.message === 'string' ? o.message : '';
      if (/\b42703\b/.test(msg) || /column .* does not exist/i.test(msg)) {
        return true;
      }
      cur = o.cause;
    } else {
      break;
    }
  }
  return false;
}

/** Postgres `23505` — violação de unicidade (ex.: `reunify_meeting_id` duplicado em corrida). */
export function isPostgresUniqueViolationError(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 12 && cur; i += 1) {
    if (typeof cur === 'object' && cur !== null) {
      const o = cur as { code?: unknown; message?: unknown; cause?: unknown };
      if (o.code === '23505') {
        return true;
      }
      const msg = typeof o.message === 'string' ? o.message : '';
      if (/\b23505\b/.test(msg) || /duplicate key/i.test(msg)) {
        return true;
      }
      cur = o.cause;
    } else {
      break;
    }
  }
  return false;
}

/** Postgres `42P01` — tabela inexistente (ex.: migração ainda não aplicada). */
export function isPostgresUndefinedTableError(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 12 && cur; i += 1) {
    if (typeof cur === 'object' && cur !== null) {
      const o = cur as { code?: unknown; message?: unknown; cause?: unknown };
      if (o.code === '42P01') {
        return true;
      }
      const msg = typeof o.message === 'string' ? o.message : '';
      if (/\b42P01\b/.test(msg) || /relation .* does not exist/i.test(msg)) {
        return true;
      }
      cur = o.cause;
    } else {
      break;
    }
  }
  return false;
}
