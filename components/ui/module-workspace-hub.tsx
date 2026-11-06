'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ModuleWorkspaceHubProps = {
  /** Mesmo rótulo usado no Taskflow («Área de trabalho») para alinhar módulos. */
  title?: string;
  /** Texto ou fragmento por baixo do título (contexto da aba activa). */
  description?: ReactNode;
  /** Ligações discretas (ex.: manual, relatórios), estilo alinhado ao Taskflow. */
  links?: ReactNode;
  /** Conteúdo extra por baixo das ligações (ex.: aviso de permissões). */
  afterLinks?: ReactNode;
  /** Primeira fila à direita: normalmente `ModuleSegmentedTabs` com `tone="accent"`. */
  tabs: ReactNode;
  className?: string;
};

const cardClass =
  'rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50/90 via-white to-white p-4 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900';

const linkClass =
  'font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100';

export { linkClass as moduleWorkspaceHubLinkClassName };

/**
 * Cartão de navegação principal do módulo (modelo Taskflow «Área de trabalho»):
 * título à esquerda, separadores à direita, descrição e ligações por baixo.
 */
export function ModuleWorkspaceHub({
  title = 'Área de trabalho',
  description,
  links,
  afterLinks,
  tabs,
  className,
}: ModuleWorkspaceHubProps) {
  return (
    <div className={cn(cardClass, className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {tabs}
      </div>
      {description ? (
        <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">{description}</div>
      ) : null}
      {links ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">{links}</div>
      ) : null}
      {afterLinks ? <div className="mt-3">{afterLinks}</div> : null}
    </div>
  );
}
