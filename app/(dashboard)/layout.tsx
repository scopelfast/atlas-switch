'use client';

import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Home, LogOut, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut } from '@/app/(login)/actions';
import { usePathname, useRouter } from 'next/navigation';
import { User } from '@/lib/db/schema';
import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  if (!isMounted) {
    return null;
  }

  if (!user) {
    return (
      <>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/pricing">Planos</Link>
        </Button>
        <Button asChild>
          <Link href="/sign-up">Criar conta</Link>
        </Button>
      </>
    );
  }

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger>
        <Avatar className="cursor-pointer size-9">
          {user.avatarUrl?.startsWith('/') ? (
            <AvatarImage alt={user.name || user.email || ''} src={user.avatarUrl} />
          ) : null}
          <AvatarFallback>
            {(user.name || user.email || '?')
              .split(/\s+/)
              .filter(Boolean)
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex flex-col gap-1">
        <DropdownMenuItem className="cursor-pointer">
          <Link href="/dashboard" className="flex w-full items-center">
            <Home className="mr-2 h-4 w-4" />
            <span>Painel</span>
          </Link>
        </DropdownMenuItem>
        <form action={handleSignOut} className="w-full">
          <button type="submit" className="flex w-full">
            <DropdownMenuItem className="w-full flex-1 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('atlas-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', shouldBeDark);
    setIsDark(shouldBeDark);
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    document.documentElement.classList.toggle('dark', nextIsDark);
    window.localStorage.setItem('atlas-theme', nextIsDark ? 'dark' : 'light');
    setIsDark(nextIsDark);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-violet-200/30 bg-white/75 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-violet-900/30 dark:bg-slate-950/75">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent dark:via-violet-500/35" />
      <div className="relative mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          {/* `<img>` evita `<link rel=preload>` sem `as` válido com `next/image`+priority em dev (Turbopack/Chrome). */}
          <img
            src="/logoSYS.png"
            alt="AtlasSwitch"
            width={280}
            height={70}
            className="h-11 w-auto shrink-0 transition-opacity group-hover:opacity-90 sm:h-12"
            decoding="async"
          />
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              AtlasSwitch
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-600/90 dark:text-violet-300/90">
              Console operacional
            </span>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full border border-violet-200/80 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-800 dark:border-violet-500/30 dark:bg-violet-950/60 dark:text-violet-200 md:inline-flex">
            Sistema
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-full border-slate-200/90 bg-white/80 dark:border-slate-700 dark:bg-slate-900/60"
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">{isDark ? 'Claro' : 'Escuro'}</span>
          </Button>
          <Suspense fallback={<div className="h-9 w-9 rounded-full bg-slate-200/80 dark:bg-slate-800" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  /** Rotas da app autenticada: altura fixa para só o `<main>` rolar; menu lateral fica estável em desktop. */
  const dashboardShell = pathname?.startsWith('/dashboard') ?? false;

  return (
    <section
      className={
        dashboardShell
          ? 'flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-gradient-to-b from-slate-100/90 via-white to-violet-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/25'
          : 'flex min-h-screen flex-col bg-gradient-to-b from-slate-100/90 via-white to-violet-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/25'
      }
    >
      <Header />
      <div className={dashboardShell ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'contents'}>{children}</div>
    </section>
  );
}
