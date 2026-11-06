'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleHeader } from '@/components/ui/module-header';
import useSWR from 'swr';
import { canInviteToTeam, hasPermission, type Role } from '@/lib/auth/permissions';
import { getMenuGroups } from '@/lib/menu-config';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MenuConfigPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);
  const role = (user?.role || 'member') as Role;
  const canView = hasPermission(role, 'control.view');

  const groups = getMenuGroups((p) => hasPermission(role, p), {
    showUsuariosNav: canInviteToTeam(role) || hasPermission(role, 'users.manage'),
  });

  if (user && !canView) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              A configuração do menu lateral é apenas para o operador da plataforma.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <ModuleHeader
        title="Configuração do menu"
        description="Estrutura do menu lateral, organizado por módulo. A visibilidade segue as permissões do seu perfil."
      />

      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <Card key={group.key} className="atlas-surface atlas-hover">
            <CardHeader className="gap-1 pb-2">
              <CardTitle className="text-base">{group.label}</CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {group.items.length} item(ns)
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.href}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/30"
                  >
                    <item.icon className="h-5 w-5 text-indigo-500" />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.href}</p>
                    </div>
                    <span className="ml-auto rounded bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">
                      {item.permission}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
