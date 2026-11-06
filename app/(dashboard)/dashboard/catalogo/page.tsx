'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleHeader } from '@/components/ui/module-header';
import { DataFilters, type FilterField } from '@/components/ui/data-filters';
import useSWR from 'swr';
import { hasPermission, type Role } from '@/lib/auth/permissions';

type Permission =
  | 'dashboard.view'
  | 'control.view'
  | 'ai.manage'
  | 'taskflow.view'
  | 'chronos.view'
  | 'reunify.view'
  | 'projectus.view'
  | 'bibliotheca.view'
  | 'billtrak.view'
  | 'notepad.view'
  | 'scriptum.view'
  | 'resourcehub.view'
  | 'activity.view'
  | 'general.view'
  | 'security.view'
  | 'users.manage';

/** Módulos e suas funções (permissões) atreladas. */
const MODULE_FUNCTIONS: { moduleKey: string; label: string; functions: { key: Permission; label: string }[] }[] = [
  { moduleKey: 'taskflow', label: 'Taskflow', functions: [{ key: 'taskflow.view', label: 'Visualizar' }] },
  { moduleKey: 'chronos', label: 'Chronos', functions: [{ key: 'chronos.view', label: 'Visualizar' }] },
  { moduleKey: 'reunify', label: 'Reunify', functions: [{ key: 'reunify.view', label: 'Visualizar' }] },
  { moduleKey: 'projectus', label: 'Projectus', functions: [{ key: 'projectus.view', label: 'Visualizar' }] },
  { moduleKey: 'bibliotheca', label: 'Bibliotheca', functions: [{ key: 'bibliotheca.view', label: 'Visualizar' }] },
  { moduleKey: 'billtrak', label: 'BillTrak', functions: [{ key: 'billtrak.view', label: 'Visualizar' }] },
  { moduleKey: 'notepad', label: 'Notepad', functions: [{ key: 'notepad.view', label: 'Visualizar' }] },
  { moduleKey: 'scriptum', label: 'Scriptum', functions: [{ key: 'scriptum.view', label: 'Visualizar' }] },
  { moduleKey: 'resourcehub', label: 'ResourceHub', functions: [{ key: 'resourcehub.view', label: 'Visualizar' }] },
  {
    moduleKey: 'core',
    label: 'Núcleo',
    functions: [
      { key: 'dashboard.view', label: 'Painel' },
      { key: 'control.view', label: 'Controle' },
      { key: 'ai.manage', label: 'IA' },
      { key: 'activity.view', label: 'Atividade' },
      { key: 'general.view', label: 'Configurações' },
      { key: 'security.view', label: 'Segurança' },
      { key: 'users.manage', label: 'Usuários' },
    ],
  },
];

const filterFields: FilterField[] = [
  { key: 'q', label: 'Módulo / Função', type: 'text', placeholder: 'Buscar' },
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CatalogoPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);
  const role = (user?.role || 'member') as Role;
  const canView = hasPermission(role, 'control.view');

  const [filterQ, setFilterQ] = useState('');

  const filtered = useMemo(() => {
    if (!filterQ.trim()) return MODULE_FUNCTIONS;
    const q = filterQ.toLowerCase();
    return MODULE_FUNCTIONS.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.functions.some(
          (f) =>
            f.key.toLowerCase().includes(q) ||
            f.label.toLowerCase().includes(q),
        ),
    );
  }, [filterQ]);

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
              O catálogo de módulos e funções é apenas para o operador da plataforma.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <ModuleHeader
        title="Catálogo"
        description="Módulos e suas funções atreladas. Um módulo pode ter uma ou várias funções."
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((mod) => (
          <Card key={mod.moduleKey} className="atlas-surface atlas-hover">
            <CardHeader className="gap-1 pb-2">
              <CardTitle className="text-lg">{mod.label}</CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {mod.functions.length} função(ões)
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {mod.functions.map((f) => (
                  <li
                    key={f.key}
                    className="rounded-lg bg-slate-100 px-2 py-1.5 text-sm dark:bg-slate-800"
                  >
                    <span className="font-medium">{f.label}</span>
                    <span className="ml-2 text-xs text-slate-500">{f.key}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="atlas-surface atlas-hover">
          <CardContent className="py-8 text-center text-slate-500">
            Nenhum módulo encontrado.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
