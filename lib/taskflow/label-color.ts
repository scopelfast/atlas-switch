const TOKEN_STYLES: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

export const LABEL_COLOR_TOKENS = Object.keys(TOKEN_STYLES);

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '').toLowerCase();
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function srgbLuminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Aceita `#RGB` ou `#RRGGBB`; devolve `#rrggbb` minúsculo ou null. */
export function parseCanonicalHex(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return `#${h}`;
}

/**
 * M3.4 — cor persistida: token Tailwind (`indigo`, …) ou `#RRGGBB` (hex normalizado).
 */
export function normalizeLabelColorForApi(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) {
    return { ok: true, value: 'indigo' };
  }
  const hex = parseCanonicalHex(s);
  if (hex) {
    return { ok: true, value: hex };
  }
  const token = s.toLowerCase();
  if (TOKEN_STYLES[token]) {
    return { ok: true, value: token };
  }
  return {
    ok: false,
    error: `Cor inválida. Use um token (${LABEL_COLOR_TOKENS.join(', ')}) ou hex #RGB / #RRGGBB.`,
  };
}

export type LabelChipAppearance = {
  className: string;
  style?: Record<string, string>;
};

/** Classes + estilos inline para chips de tag (token ou hex). */
export function labelChipAppearance(color: string | null | undefined): LabelChipAppearance {
  const c = typeof color === 'string' ? color.trim() : '';
  const hex = parseCanonicalHex(c);
  if (hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      return { className: TOKEN_STYLES.slate };
    }
    const L = srgbLuminance(rgb.r, rgb.g, rgb.b);
    const text = L > 0.55 ? '#0f172a' : '#f8fafc';
    return {
      className:
        'border font-semibold border-black/10 dark:border-white/15 dark:ring-1 dark:ring-white/10',
      style: {
        backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.16)`,
        color: text,
        borderColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.38)`,
      },
    };
  }
  const token = c.toLowerCase();
  return { className: TOKEN_STYLES[token] ?? TOKEN_STYLES.slate };
}

const STATUS_LIST_LEFT_BORDER: Record<string, string> = {
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  rose: 'border-l-rose-500',
  cyan: 'border-l-cyan-500',
  violet: 'border-l-violet-500',
  indigo: 'border-l-indigo-500',
  slate: 'border-l-slate-500',
};

/** M5.3 — faixa à esquerda na lista de tarefas (token ou hex). */
export function statusListRowLeftAccent(
  color: string | null | undefined,
): { className: string; style?: Record<string, string> } {
  const c = typeof color === 'string' ? color.trim() : '';
  const hex = parseCanonicalHex(c);
  if (hex) {
    return { className: 'border-l-4', style: { borderLeftColor: hex } };
  }
  const token = c.toLowerCase();
  const border = STATUS_LIST_LEFT_BORDER[token] ?? STATUS_LIST_LEFT_BORDER.slate;
  return { className: `border-l-4 ${border}` };
}
