import { parseCanonicalHex } from '@/lib/taskflow/label-color';

const TOKEN_BORDER: Record<string, string> = {
  indigo: 'border-t-indigo-500',
  emerald: 'border-t-emerald-500',
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
  cyan: 'border-t-cyan-500',
  violet: 'border-t-violet-500',
  slate: 'border-t-slate-500',
  fuchsia: 'border-t-fuchsia-500',
};

export type ColumnStripe = {
  className: string;
  style?: Record<string, string>;
};

/** Faixa superior do cartão Kanban: token, hex ou fallback Tailwind. */
export function columnKanbanStripe(
  stripeColor: string | null | undefined,
  fallbackTailwindBorderClass: string,
): ColumnStripe {
  const raw = typeof stripeColor === 'string' ? stripeColor.trim() : '';
  if (!raw) {
    return { className: fallbackTailwindBorderClass };
  }
  const hex = parseCanonicalHex(raw);
  if (hex) {
    return {
      className: 'border-t-[3px] border-solid',
      style: { borderTopColor: hex },
    };
  }
  const tw = TOKEN_BORDER[raw.toLowerCase()];
  if (tw) {
    return { className: `border-t-[3px] ${tw}` };
  }
  return { className: fallbackTailwindBorderClass };
}
