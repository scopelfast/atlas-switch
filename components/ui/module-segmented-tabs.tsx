'use client';

import { cn } from '@/lib/utils';

export type ModuleSegmentedTabsItem<T extends string = string> = {
  value: T;
  label: string;
  /** Só quando o `label` visível não basta para leitores de ecrã. */
  ariaLabel?: string;
};

export type ModuleSegmentedTabsProps<T extends string> = {
  items: readonly ModuleSegmentedTabsItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Rótulo acessível do grupo de separadores (`role="tablist"`). */
  'aria-label': string;
  /**
   * `neutral` — mesmo padrão visual que Reunify / Projectus.
   * `accent` — mesma geometria; separador activo com realce violeta (Taskflow).
   */
  tone?: 'neutral' | 'accent';
  className?: string;
  tabListClassName?: string;
};

/**
 * Separadores horizontais partilhados entre módulos do dashboard (Reunify, Projectus, Taskflow).
 * Usa `role="tab"` + `aria-selected` para alinhar acessibilidade e aparência.
 */
export function ModuleSegmentedTabs<T extends string>({
  items,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  tone = 'neutral',
  className,
  tabListClassName,
}: ModuleSegmentedTabsProps<T>) {
  return (
    <div className={cn(className)}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80',
          tabListClassName,
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const selected = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={item.ariaLabel}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tone === 'accent'
                  ? selected
                    ? 'bg-white text-violet-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-violet-200 dark:ring-white/10'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  : selected
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
              )}
              onClick={() => onValueChange(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
