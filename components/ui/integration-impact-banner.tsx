import type { ReactNode } from 'react';

type IntegrationImpactBannerProps = {
  message?: string;
  tone?: 'info' | 'success' | 'error';
  className?: string;
  children?: ReactNode;
};

const toneClassMap: Record<NonNullable<IntegrationImpactBannerProps['tone']>, string> = {
  info: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100',
  error:
    'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100',
};

export function IntegrationImpactBanner({
  message,
  tone = 'info',
  className = '',
  children,
}: IntegrationImpactBannerProps) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${toneClassMap[tone]} ${className}`.trim()}>
      {children ?? message}
    </div>
  );
}

