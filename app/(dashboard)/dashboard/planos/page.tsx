'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleHeader } from '@/components/ui/module-header';
import { DataFilters, type FilterField } from '@/components/ui/data-filters';
import { Button } from '@/components/ui/button';
import { hasPermission, type Role } from '@/lib/auth/permissions';

type Plan = {
  id: number;
  name: string;
  description?: string | null;
  priceCents: number;
  maxUsers: number;
  catalogSuspended?: boolean;
  modules: { moduleKey: string; enabled: boolean }[];
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100,
  );

const MODULE_LABELS: Record<string, string> = {
  chronos: 'Chronos',
  reunify: 'Reunify',
  taskflow: 'Taskflow',
  projectus: 'Projectus',
  resourcehub: 'ResourceHub',
  billtrak: 'BillTrak',
  bibliotheca: 'Bibliotheca',
  notepad: 'Notepad',
  scriptum: 'Scriptum',
};

const filterFields: FilterField[] = [
  { key: 'q', label: 'Nome', type: 'text', placeholder: 'Buscar plano' },
  {
    key: 'module',
    label: 'Módulo',
    type: 'select',
    placeholder: 'Todos',
    options: [
      { value: '', label: 'Todos' },
      ...Object.entries(MODULE_LABELS).map(([k, v]) => ({ value: k, label: v })),
    ],
  },
];

export default function PlanosPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);
  const role = (user?.role || 'member') as Role;
  const canManage = hasPermission(role, 'control.view');

  const [filterQ, setFilterQ] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const params = new URLSearchParams();
  if (filterQ) params.set('q', filterQ);
  if (filterModule) params.set('module', filterModule);
  const apiUrl = canManage
    ? `/api/control/plans${params.toString() ? `?${params}` : ''}`
    : null;
  const { data: plans = [] } = useSWR<Plan[]>(apiUrl, fetcher);

  const handleFilter = (values: Record<string, string>) => {
    setFilterQ(values.q ?? '');
    setFilterModule(values.module ?? '');
  };

  const handleClearFilter = () => {
    setFilterQ('');
    setFilterModule('');
  };

  if (user && !canManage) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Apenas o operador da plataforma pode visualizar e editar planos comerciais aqui.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <ModuleHeader
          title="Planos"
          description="Planos disponíveis e seus módulos atrelados. Um plano pode ter um ou vários módulos."
        />
        {canManage && (
          <Button asChild variant="outline">
            <Link href="/dashboard/control-center">Ir ao Controle</Link>
          </Button>
        )}
      </div>

      {canManage && (
        <div className="mt-6">
          <DataFilters
            fields={filterFields}
            onFilter={handleFilter}
            onClear={handleClearFilter}
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="atlas-surface atlas-hover">
            <CardHeader className="gap-1 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.catalogSuspended ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                    Suspenso (catálogo)
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {formatCurrency(plan.priceCents)}/mês · {plan.maxUsers} usuários
              </p>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                {plan.description ?? 'Sem descrição'}
              </p>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">
                  Módulos ({plan.modules.filter((m) => m.enabled).length}):
                </p>
                <ul className="flex flex-wrap gap-1">
                  {plan.modules
                    .filter((m) => m.enabled)
                    .map((m) => (
                      <li
                        key={m.moduleKey}
                        className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-600 dark:text-indigo-300"
                      >
                        {MODULE_LABELS[m.moduleKey] ?? m.moduleKey}
                      </li>
                    ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <Card className="atlas-surface atlas-hover">
          <CardContent className="py-8 text-center text-slate-500">
            Nenhum plano encontrado.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
