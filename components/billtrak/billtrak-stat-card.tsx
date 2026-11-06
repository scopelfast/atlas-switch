import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  emerald: {
    bar: 'from-emerald-400 via-green-500 to-teal-600',
    iconWrap:
      'border-emerald-200/60 bg-emerald-500/[0.12] text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-400/10 dark:text-emerald-200',
    value: 'text-emerald-600 dark:text-emerald-200',
  },
  rose: {
    bar: 'from-rose-400 via-rose-500 to-orange-600',
    iconWrap:
      'border-rose-200/60 bg-rose-500/[0.12] text-rose-800 dark:border-rose-500/25 dark:bg-rose-400/10 dark:text-rose-200',
    value: 'text-rose-600 dark:text-rose-200',
  },
  amber: {
    bar: 'from-amber-400 via-amber-500 to-orange-500',
    iconWrap:
      'border-amber-200/70 bg-amber-500/[0.14] text-amber-900 dark:border-amber-500/30 dark:bg-amber-400/10 dark:text-amber-200',
    value: 'text-amber-700 dark:text-amber-200',
  },
  indigo: {
    bar: 'from-indigo-400 via-violet-500 to-purple-600',
    iconWrap:
      'border-indigo-200/60 bg-indigo-500/[0.12] text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-400/10 dark:text-indigo-200',
    value: 'text-indigo-600 dark:text-indigo-200',
  },
} as const;

export type BilltrakStatVariant = keyof typeof variants;

export function BilltrakStatCard({
  title,
  description,
  value,
  footnote,
  icon: Icon,
  variant,
}: {
  title: string;
  description: string;
  value: ReactNode;
  footnote: string;
  icon: LucideIcon;
  variant: BilltrakStatVariant;
}) {
  const v = variants[variant];

  return (
    <article
      className={cn(
        'relative flex min-h-[152px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/95 p-4 shadow-sm ring-1 ring-slate-950/[0.03] sm:p-5',
        'dark:border-slate-700/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:ring-white/[0.04]',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:hover:border-slate-600',
      )}
    >
      <div
        className={cn('pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-95', v.bar)}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5 pr-2">
          <h3 className="text-[0.9375rem] font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50">
            {title}
          </h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm backdrop-blur-[2px]',
            v.iconWrap,
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.65} aria-hidden />
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800/90 sm:pt-4">
        <div
          className={cn(
            'w-full min-w-0 text-xl font-semibold tabular-nums tracking-tight text-balance sm:text-2xl lg:text-3xl',
            v.value,
          )}
        >
          {value}
        </div>
        <p className="text-[11px] font-medium leading-snug text-slate-500 dark:text-slate-400">{footnote}</p>
      </div>
    </article>
  );
}
