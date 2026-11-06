import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  violet: {
    bar: 'from-violet-400 via-purple-500 to-fuchsia-600',
    iconWrap:
      'border-violet-200/60 bg-violet-500/[0.12] text-violet-800 dark:border-violet-500/25 dark:bg-violet-400/10 dark:text-violet-200',
    value: 'text-violet-700 dark:text-violet-200',
  },
  indigo: {
    bar: 'from-indigo-400 via-violet-500 to-purple-600',
    iconWrap:
      'border-indigo-200/60 bg-indigo-500/[0.12] text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-400/10 dark:text-indigo-200',
    value: 'text-indigo-600 dark:text-indigo-200',
  },
  sky: {
    bar: 'from-sky-400 via-cyan-500 to-teal-500',
    iconWrap:
      'border-sky-200/60 bg-sky-500/[0.12] text-sky-800 dark:border-sky-500/25 dark:bg-sky-400/10 dark:text-sky-200',
    value: 'text-sky-700 dark:text-sky-200',
  },
  emerald: {
    bar: 'from-emerald-400 via-green-500 to-teal-600',
    iconWrap:
      'border-emerald-200/60 bg-emerald-500/[0.12] text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-400/10 dark:text-emerald-200',
    value: 'text-emerald-600 dark:text-emerald-200',
  },
} as const;

export type ScriptumStatVariant = keyof typeof variants;

export function ScriptumStatCard({
  title,
  description,
  value,
  footnote,
  icon: Icon,
  variant,
  compact = false,
}: {
  title: string;
  description: string;
  value: ReactNode;
  footnote: string;
  icon: LucideIcon;
  variant: ScriptumStatVariant;
  compact?: boolean;
}) {
  const v = variants[variant];

  return (
    <article
      className={cn(
        compact ? 'min-h-[128px] p-3 sm:p-4' : 'min-h-[152px] p-4 sm:p-5',
        'relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/95 shadow-sm ring-1 ring-slate-950/[0.03]',
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
            compact
              ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm backdrop-blur-[2px]'
              : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm backdrop-blur-[2px]',
            v.iconWrap,
          )}
        >
          <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={1.65} aria-hidden />
        </div>
      </div>
      <div className={cn('mt-auto flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-800/90', compact ? 'pt-2.5' : 'pt-3 sm:pt-4')}>
        <div
          className={cn(
            compact
              ? 'w-full min-w-0 text-lg font-semibold tabular-nums tracking-tight text-balance sm:text-xl lg:text-2xl'
              : 'w-full min-w-0 text-xl font-semibold tabular-nums tracking-tight text-balance sm:text-2xl lg:text-3xl',
            v.value,
          )}
        >
          {value}
        </div>
        <p className={cn('font-medium leading-snug text-slate-500 dark:text-slate-400', compact ? 'text-[10px]' : 'text-[11px]')}>
          {footnote}
        </p>
      </div>
    </article>
  );
}
