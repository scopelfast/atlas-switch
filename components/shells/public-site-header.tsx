'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggleButton } from '@/components/shells/theme-toggle-button';

export function PublicSiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-violet-200/30 bg-white/80 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-violet-900/30 dark:bg-slate-950/80">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent dark:via-violet-500/35" />
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <img
            src="/logoSYS.png"
            alt="AtlasSwitch"
            width={280}
            height={70}
            className="h-10 w-auto shrink-0 transition-opacity group-hover:opacity-90 sm:h-11"
            decoding="async"
          />
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              AtlasSwitch
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-600/90 dark:text-violet-300/90">
              Ajuda e entrada
            </span>
          </div>
        </Link>
        <nav className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden text-slate-700 sm:inline-flex dark:text-slate-200">
            <Link href="/pricing">Preços</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden text-slate-700 md:inline-flex dark:text-slate-200">
            <Link href="/help">Ajuda</Link>
          </Button>
          <ThemeToggleButton />
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/sign-in">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/sign-up">Criar conta</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
