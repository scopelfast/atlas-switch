'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type HelpPanelProps = {
  title: string;
  description?: string;
  tips?: string[];
  defaultCollapsed?: boolean;
  onToggle?: (isOpen: boolean) => void;
};

/**
 * Painel de ajuda rápido para orientar operadores dentro das telas.
 */
export function HelpPanel({
  title,
  description,
  tips = [],
  defaultCollapsed = false,
  onToggle,
}: HelpPanelProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

  function handleToggle() {
    setIsOpen((prev) => {
      const next = !prev;
      onToggle?.(next);
      return next;
    });
  }

  return (
    <Card className="atlas-surface border-indigo-100/60">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-orange-400" />
            <CardTitle className="mt-2 text-base text-slate-900 dark:text-slate-50">
              {title}
            </CardTitle>
          </div>
          <button
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Ocultar ajuda' : 'Mostrar ajuda'}
          >
            {isOpen ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </CardHeader>
      {isOpen ? (
        <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
          {description ? <p>{description}</p> : null}
          {tips.length > 0 ? (
            <ul className="grid gap-2">
              {tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
