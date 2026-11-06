'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleHeader } from '@/components/ui/module-header';
import { DataFilters, type FilterField } from '@/components/ui/data-filters';
import useSWR from 'swr';
import {
  hasPermission,
  getRolePermissions,
  getPermissionLabel,
  ROLE_DISPLAY_LABELS,
  type Role,
  type Permission,
} from '@/lib/auth/permissions';

const filterFields: FilterField[] = [
  { key: 'q', label: 'Perfil / Função', type: 'text', placeholder: 'Buscar' },
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PerfisPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);
  const role = (user?.role || 'member') as Role;
  const canView = hasPermission(role, 'control.view');

  const [filterQ, setFilterQ] = useState('');

  const rolePerms = getRolePermissions();

  const byFunction = useMemo(() => {
    const map = new Map<Permission, Role[]>();
    for (const r of Object.keys(rolePerms) as Role[]) {
      for (const p of rolePerms[r]) {
        if (!map.has(p)) map.set(p, []);
        map.get(p)!.push(r);
      }
    }
    return map;
  }, []);

  const filteredProfiles = useMemo(() => {
    const roles = Object.keys(rolePerms) as Role[];
    if (!filterQ.trim()) return roles;
    const q = filterQ.toLowerCase();
    return roles.filter((r) => {
      if (ROLE_DISPLAY_LABELS[r].toLowerCase().includes(q)) return true;
      return rolePerms[r].some(
        (p) =>
          getPermissionLabel(p).toLowerCase().includes(q) ||
          p.toLowerCase().includes(q),
      );
    });
  }, [filterQ, rolePerms]);

  const filteredFunctions = useMemo(() => {
    const perms = Array.from(byFunction.keys());
    if (!filterQ.trim()) return perms;
    const q = filterQ.toLowerCase();
    return perms.filter((p) => {
      if (getPermissionLabel(p).toLowerCase().includes(q)) return true;
      if (p.toLowerCase().includes(q)) return true;
      return byFunction.get(p)!.some((r) =>
        ROLE_DISPLAY_LABELS[r].toLowerCase().includes(q),
      );
    });
  }, [filterQ, byFunction]);

  const handleFilter = (values: Record<string, string>) => {
    setFilterQ(values.q ?? '');
  };

  if (user && !canView) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              A matriz de perfis globais é apenas para o operador da plataforma.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <ModuleHeader
        title="Perfis"
        description="Perfis (funções) e suas permissões. Uma função pode estar em um ou vários perfis."
      />

      {canView && (
        <div className="mt-6">
          <DataFilters
            fields={filterFields}
            onFilter={handleFilter}
            onClear={() => setFilterQ('')}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Por perfil
          </h3>
          <div className="space-y-4">
            {filteredProfiles.map((r) => (
              <Card key={r} className="atlas-surface atlas-hover">
                <CardHeader className="gap-1 pb-2">
                  <CardTitle className="text-base">{ROLE_DISPLAY_LABELS[r]}</CardTitle>
                  <p className="text-sm text-slate-500">
                    {rolePerms[r].length} permissões
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-wrap gap-1">
                    {rolePerms[r].map((p) => (
                      <li
                        key={p}
                        className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-600 dark:text-indigo-300"
                      >
                        {getPermissionLabel(p)}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Por função (em quais perfis está)
          </h3>
          <div className="space-y-2">
            {filteredFunctions.map((p) => (
              <div
                key={p}
                className="atlas-item flex items-center justify-between rounded-xl p-3"
              >
                <span className="font-medium">{getPermissionLabel(p)}</span>
                <div className="flex gap-1">
                  {(byFunction.get(p) ?? []).map((r) => (
                    <span
                      key={r}
                      className="rounded-md bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700"
                    >
                      {ROLE_DISPLAY_LABELS[r]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
