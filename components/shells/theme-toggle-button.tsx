'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggleButton({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = window.localStorage.getItem('atlas-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', shouldBeDark);
    setIsDark(shouldBeDark);
  }, []);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('atlas-theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  if (!mounted) {
    return (
      <span
        className={`inline-flex h-9 w-9 shrink-0 rounded-full border border-transparent ${className ?? ''}`}
        aria-hidden
      />
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`gap-2 rounded-full border-slate-200/90 bg-white/80 dark:border-slate-700 dark:bg-slate-900/60 ${className ?? ''}`}
      onClick={toggle}
      aria-label={isDark ? 'Activar tema claro' : 'Activar tema escuro'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? 'Claro' : 'Escuro'}</span>
    </Button>
  );
}
