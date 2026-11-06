'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Garante largura/altura > 0 para o Recharts `ResponsiveContainer` (evita aviso em flex/grid no primeiro paint).
 */
export function MeasuredChartBox({
  className,
  children,
}: {
  className?: string;
  children: (size: { width: number; height: number }) => React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setSize({ width: w, height: h });
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('w-full min-w-0', className)}>
      {size ? children(size) : null}
    </div>
  );
}
