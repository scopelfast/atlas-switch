'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FloatingFeedbackProvider } from '@/components/ui/floating-feedback';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import useSWR from 'swr';
import {
  canInviteToTeam,
  getRoleDisplayLabel,
  hasPermission,
  type Role,
} from '@/lib/auth/permissions';
import { getMenuGroups } from '@/lib/menu-config';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);

  const role = (user?.role || 'member') as Role;
  const menuGroups = getMenuGroups((p) => hasPermission(role, p), {
    showUsuariosNav: canInviteToTeam(role) || hasPermission(role, 'users.manage'),
  });

  const roleLabel = user?.role ? getRoleDisplayLabel(user.role) : '…';

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col">
      {/* Mobile header */}
      <div className="flex items-center justify-between border-b border-violet-200/40 bg-white/90 p-4 backdrop-blur-md dark:border-violet-900/30 dark:bg-slate-950/90 lg:hidden">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Menu</span>
          <span className="text-[10px] uppercase tracking-wider text-violet-600 dark:text-violet-300">
            {roleLabel}
          </span>
        </div>
        <Button
          className="-mr-3 rounded-full"
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Alternar menu</span>
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-slate-100/80 via-transparent to-violet-100/30 dark:from-slate-950 dark:via-transparent dark:to-violet-950/20">
        {isSidebarOpen ? (
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}
        {/* Sidebar - agrupado por módulo */}
        <aside
          className={`absolute inset-y-0 left-0 z-40 flex max-h-[100dvh] w-[17rem] shrink-0 flex-col transform border-r border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-violet-950 text-white shadow-[12px_0_40px_-20px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-in-out lg:relative lg:max-h-none lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } ${isSidebarOpen ? 'flex' : 'hidden'} lg:flex`}
        >
          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-6 rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-inner backdrop-blur-sm">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.32em] text-violet-200/95">
                AtlasSwitch
              </p>
              <p className="mt-2 text-center text-sm font-medium text-white/90">
                Plataforma unificada
              </p>
              <p className="mt-3 text-center text-[10px] uppercase tracking-wider text-violet-300/90">
                {roleLabel}
              </p>
            </div>

            {menuGroups.map((group) => (
              <div key={group.key} className="mb-4">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/75">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} passHref>
                      <Button
                        variant={pathname === item.href ? 'secondary' : 'ghost'}
                        className={`w-full justify-start rounded-xl border border-transparent shadow-none text-white/85 transition-colors hover:border-white/10 hover:bg-white/10 hover:text-white ${pathname === item.href ? 'border-white/15 bg-white/15 text-white shadow-sm' : ''
                          }`}
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0 opacity-90" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-8 pt-4 sm:px-6 lg:p-8">
          <FloatingFeedbackProvider>{children}</FloatingFeedbackProvider>
        </main>
      </div>
    </div>
  );
}
