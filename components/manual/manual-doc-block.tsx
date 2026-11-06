import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Bloco padronizado para manuais (modelo Fase D do memorial de UI). */
export function ManualDocBlock({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  /** Ocupa duas colunas em grelhas `lg:grid-cols-2`. */
  wide?: boolean;
}) {
  return (
    <Card className={`atlas-surface ${wide ? 'lg:col-span-2' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {children}
      </CardContent>
    </Card>
  );
}
