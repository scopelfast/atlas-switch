'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Mesmo fundo que Taskflow / Projectus / Reunify — gradiente + halo violeta no topo. */
const sectionClassName =
  'relative flex-1 overflow-hidden bg-gradient-to-b from-violet-50/70 via-white to-cyan-50/40 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/25 lg:p-8';

const radialOverlayClassName =
  'pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(139,92,246,0.22),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,rgba(139,92,246,0.15),transparent)]';

export type ModuleDashboardPageShellProps = {
  children: ReactNode;
  className?: string;
  /** Classes extra no wrapper interno (ex.: `flex w-full flex-col gap-6`). */
  innerClassName?: string;
};

export function ModuleDashboardPageShell({
  children,
  className,
  innerClassName,
}: ModuleDashboardPageShellProps) {
  return (
    <section className={cn(sectionClassName, className)}>
      <div className={radialOverlayClassName} aria-hidden />
      <div className={cn('relative z-[1]', innerClassName)}>{children}</div>
    </section>
  );
}
