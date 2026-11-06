'use client';

import Link from 'next/link';
import { Activity, Boxes, Layers2, Percent } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { ResourceHubStatCard } from '@/components/resourcehub/resource-hub-stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleDashboardPageShell } from '@/components/ui/module-dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { hasPermission, isOwnerLike, type Role } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { EntityEditDeleteActions } from '@/components/ui/entity-edit-delete-actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import { cn } from '@/lib/utils';

type Resource = {
  id: number;
  name: string;
  type: string;
  status: string;
  capacityHoursPerWeek: number;
  costRateCents: number;
  notes?: string | null;
};

type Allocation = {
  id: number;
  resourceId: number;
  projectId?: number | null;
  taskId?: number | null;
  startDate: string;
  endDate: string;
  hoursPerWeek: number;
  status: string;
};

type CapacityRow = {
  resourceId: number;
  name: string;
  type: string;
  capacityHoursPerWeek: number;
  allocatedHoursPerWeek: number;
  utilizationPercent: number;
};

type ProjectusProject = {
  id: number;
  nome: string;
  status: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(
      typeof data?.error === 'string' ? data.error : `Falha ao carregar dados (${res.status}).`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
};
const swrNoRetryOn403 = {
  revalidateOnFocus: false,
  shouldRetryOnError: (error: unknown) => (error as { status?: number } | undefined)?.status !== 403,
};
const formatCurrency = (cents?: number) =>
  typeof cents === 'number'
    ? (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

export default function ResourceHubPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher, swrNoRetryOn403);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'resourcehub.view');

  const { data: resources, error: resourcesError } = useSWR<Resource[]>(
    '/api/resourcehub/resources',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: allocations, error: allocationsError } = useSWR<Allocation[]>(
    '/api/resourcehub/allocations',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: capacity, error: capacityError } = useSWR<CapacityRow[]>(
    '/api/resourcehub/capacity',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: projects, error: projectsError } = useSWR<ProjectusProject[]>(
    '/api/projectus/projects',
    fetcher,
    swrNoRetryOn403,
  );
  const resourcesList = Array.isArray(resources) ? resources : [];
  const allocationsList = Array.isArray(allocations) ? allocations : [];
  const capacityList = Array.isArray(capacity) ? capacity : [];
  const projectsList = Array.isArray(projects) ? projects : [];
  const loadError =
    resourcesError || allocationsError || capacityError || projectsError || null;
  const moduleBlocked = [resourcesError, allocationsError, capacityError]
    .filter(Boolean)
    .some((err) => err?.message?.toLowerCase().includes('não está habilitado no plano ativo'));

  const helpTips =
    isOwnerLike(role)
      ? [
          'Utilização acima de 90% no heatmap: redistribua horas ou aloque outro recurso.',
          'Alocações «Ativas» somam horas na capacidade; use «Pausado» ou «Encerrado» para tirar carga.',
        ]
      : [
          'Se o seu nome for um recurso, peça ao gestor para ajustar capacidade ou alocações.',
          'Projetos vêm do Projectus; ligue a alocação ao projeto certo para leitura executiva.',
        ];

  const [resourceName, setResourceName] = useState('');
  const [resourceType, setResourceType] = useState('PESSOA');
  const [resourceStatus, setResourceStatus] = useState('DISPONIVEL');
  const [resourceCapacity, setResourceCapacity] = useState(40);
  const [resourceCostRate, setResourceCostRate] = useState('');
  const [resourceNotes, setResourceNotes] = useState('');
  const [resourceEditingId, setResourceEditingId] = useState<number | null>(null);
  const [resourceFeedback, setResourceFeedback] = useState('');
  const [resourcePendenteExclusao, setResourcePendenteExclusao] = useState<Resource | null>(null);

  const [allocationResourceId, setAllocationResourceId] = useState<number | null>(null);
  const [allocationProjectId, setAllocationProjectId] = useState<number | null>(null);
  const [allocationStartDate, setAllocationStartDate] = useState('');
  const [allocationEndDate, setAllocationEndDate] = useState('');
  const [allocationHours, setAllocationHours] = useState(8);
  const [allocationStatus, setAllocationStatus] = useState('ATIVO');
  const [allocationTaskId, setAllocationTaskId] = useState('');
  const [allocationFormError, setAllocationFormError] = useState('');
  const [allocationEditingId, setAllocationEditingId] = useState<number | null>(null);
  const [allocationFeedback, setAllocationFeedback] = useState('');
  const [allocationPendenteExclusao, setAllocationPendenteExclusao] = useState<Allocation | null>(null);

  const resetResourceForm = () => {
    setResourceEditingId(null);
    setResourceName('');
    setResourceType('PESSOA');
    setResourceStatus('DISPONIVEL');
    setResourceCapacity(40);
    setResourceCostRate('');
    setResourceNotes('');
  };

  const handleCreateResource = async () => {
    if (!resourceName.trim()) return;
    setResourceFeedback('');
    const costRateCents = resourceCostRate ? Math.round(Number(resourceCostRate) * 100) : 0;
    const res = await fetch('/api/resourcehub/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: resourceName.trim(),
        type: resourceType,
        status: resourceStatus,
        capacityHoursPerWeek: resourceCapacity,
        costRateCents,
        notes: resourceNotes.trim() || null,
      }),
    });
    if (!res.ok) {
      setResourceFeedback('Falha ao criar recurso.');
      return;
    }
    setResourceFeedback('Recurso criado com sucesso.');
    resetResourceForm();
    await mutate('/api/resourcehub/resources');
    await mutate('/api/resourcehub/capacity');
  };

  const handleStartEditResource = (resource: Resource) => {
    setResourceEditingId(resource.id);
    setResourceName(resource.name);
    setResourceType(resource.type);
    setResourceStatus(resource.status);
    setResourceCapacity(resource.capacityHoursPerWeek);
    setResourceCostRate(String((resource.costRateCents || 0) / 100));
    setResourceNotes(resource.notes || '');
    setResourceFeedback('');
  };

  const handleSaveResource = async () => {
    if (!resourceEditingId || !resourceName.trim()) return;
    setResourceFeedback('');
    const costRateCents = resourceCostRate ? Math.round(Number(resourceCostRate) * 100) : 0;
    const res = await fetch('/api/resourcehub/resources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: resourceEditingId,
        name: resourceName.trim(),
        type: resourceType,
        status: resourceStatus,
        capacityHoursPerWeek: resourceCapacity,
        costRateCents,
        notes: resourceNotes.trim() || null,
      }),
    });
    if (!res.ok) {
      setResourceFeedback('Falha ao atualizar recurso.');
      return;
    }
    setResourceFeedback('Recurso atualizado com sucesso.');
    resetResourceForm();
    await mutate('/api/resourcehub/resources');
    await mutate('/api/resourcehub/capacity');
  };

  const handleDeleteResource = (resource: Resource) => {
    setResourceFeedback('');
    setResourcePendenteExclusao(resource);
  };

  const handleConfirmDeleteResource = async () => {
    if (!resourcePendenteExclusao) return;
    const res = await fetch(`/api/resourcehub/resources?id=${resourcePendenteExclusao.id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      setResourceFeedback('Falha ao excluir recurso. Remova alocações vinculadas primeiro.');
      return;
    }
    if (resourceEditingId === resourcePendenteExclusao.id) {
      resetResourceForm();
    }
    setResourcePendenteExclusao(null);
    setResourceFeedback('Recurso excluído com sucesso.');
    await mutate('/api/resourcehub/resources');
    await mutate('/api/resourcehub/capacity');
    await mutate('/api/resourcehub/allocations');
  };

  const allocationSummary = useMemo(() => {
    const total = allocationsList.length;
    const active = allocationsList.filter((alloc) => alloc.status === 'ATIVO').length;
    return { total, active };
  }, [allocationsList]);

  const resetAllocationForm = () => {
    setAllocationEditingId(null);
    setAllocationResourceId(null);
    setAllocationProjectId(null);
    setAllocationStartDate('');
    setAllocationEndDate('');
    setAllocationHours(8);
    setAllocationStatus('ATIVO');
    setAllocationTaskId('');
  };

  const handleStartEditAllocation = (allocation: Allocation) => {
    setAllocationEditingId(allocation.id);
    setAllocationResourceId(allocation.resourceId);
    setAllocationProjectId(allocation.projectId ?? null);
    setAllocationStartDate(allocation.startDate);
    setAllocationEndDate(allocation.endDate);
    setAllocationHours(allocation.hoursPerWeek);
    setAllocationStatus(allocation.status);
    setAllocationTaskId(allocation.taskId ? String(allocation.taskId) : '');
    setAllocationFeedback('');
    setAllocationFormError('');
  };

  const handleSaveAllocation = async () => {
    if (!allocationEditingId || !allocationStartDate || !allocationEndDate) return;
    setAllocationFeedback('');
    setAllocationFormError('');
    const res = await fetch('/api/resourcehub/allocations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: allocationEditingId,
        startDate: allocationStartDate,
        endDate: allocationEndDate,
        hoursPerWeek: allocationHours,
        status: allocationStatus,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setAllocationFormError(
        typeof err?.error === 'string' ? err.error : 'Não foi possível atualizar a alocação.',
      );
      return;
    }
    setAllocationFeedback('Alocação atualizada com sucesso.');
    resetAllocationForm();
    await mutate('/api/resourcehub/allocations');
    await mutate('/api/resourcehub/capacity');
  };

  if (user && !canView) {
    return (
      <ModuleDashboardPageShell>
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você não tem permissão para acessar o ResourceHub.
            </p>
          </CardContent>
        </Card>
        <div className="mt-6">
          <HelpPanel
            title="Ajuda rápida"
            description="Se precisar deste acesso, fale com o gestor."
            tips={helpTips}
          />
        </div>
      </ModuleDashboardPageShell>
    );
  }

  if (moduleBlocked) {
    return (
      <ModuleDashboardPageShell>
        <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0">
            <ModuleHeader
              title="ResourceHub"
              description="O módulo está contratado por plano. Quando habilitado, esta área mostra recursos, alocações e capacidade."
              className="w-full"
            />
          </div>
          <div className="flex items-start justify-end">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/manual/resourcehub">Manual</Link>
            </Button>
          </div>
        </div>
        <Card className="mt-6 border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/10">
          <CardHeader>
            <CardTitle>Módulo indisponível para este plano</CardTitle>
            <CardDescription>{loadError?.message}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-900 dark:text-amber-100">
            Solicite ao administrador do time a ativação do módulo no plano ativo para liberar cadastros e alocações.
          </CardContent>
        </Card>
        <div className="mt-6">
          <HelpPanel
            title="Ajuda rápida"
            description="Sem o módulo no plano, o backend bloqueia leitura e escrita."
            tips={helpTips}
          />
        </div>
      </ModuleDashboardPageShell>
    );
  }

  return (
    <ModuleDashboardPageShell>
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="ResourceHub"
            description="Cadastre recursos (pessoas, equipamentos, espaços), registre quantas horas por semana cada um pode trabalhar e distribua essas horas por projetos (Projectus) e, opcionalmente, por tarefa (Taskflow). O painel mostra se a equipe está sobrecarregada."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/resourcehub">Manual</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResourceHubStatCard
          variant="cyan"
          icon={Boxes}
          title="Recursos cadastrados"
          description="Linhas no inventário do time"
          value={resourcesList.length}
          footnote="Pessoa / equip. / espaço"
        />
        <ResourceHubStatCard
          variant="indigo"
          icon={Layers2}
          title="Alocações"
          description="Registos de uso ao longo do tempo"
          value={allocationSummary.total}
          footnote="Todos os estados"
        />
        <ResourceHubStatCard
          variant="emerald"
          icon={Activity}
          title="Alocações ativas"
          description="Entram no cálculo de utilização"
          value={allocationSummary.active}
          footnote="Somatório no heatmap"
        />
        <ResourceHubStatCard
          variant="neutral"
          icon={Percent}
          title="Utilização média"
          description="Média entre recursos (horas alocadas ÷ capacidade)"
          value={
            capacityList.length > 0
              ? `${Math.round(capacityList.reduce((sum, row) => sum + row.utilizationPercent, 0) / capacityList.length)}%`
              : '0%'
          }
          footnote="Só alocações «Ativo»"
        />
      </div>

      {loadError ? (
        <Card className="mt-4 border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/10">
          <CardContent className="pt-4 text-sm text-amber-900 dark:text-amber-100">
            {loadError.message}
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Recursos monitorados</CardTitle>
            <CardDescription>Lista viva do inventário do time</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {resourcesList.length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhum recurso cadastrado.
              </div>
            ) : (
              resourcesList.map((resource) => (
                <div
                  key={resource.id}
                  className={cn(
                    'atlas-item flex items-center justify-between gap-3',
                    resourceEditingId === resource.id
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                      : '',
                  )}
                >
                  <div>
                    <p className="atlas-item-meta">{resource.type}</p>
                    <p className="atlas-item-title">{resource.name}</p>
                    <p className="text-xs text-slate-400">
                      {resource.capacityHoursPerWeek}h/sem • {formatCurrency(resource.costRateCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="atlas-badge bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
                      {resource.status}
                    </span>
                    {resourceEditingId === resource.id ? (
                      <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                        Em edição
                      </span>
                    ) : null}
                    <EntityEditDeleteActions
                      onEdit={() => handleStartEditResource(resource)}
                      onDelete={() => handleDeleteResource(resource)}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(
            'atlas-surface atlas-hover',
            resourceEditingId ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
          )}
        >
          <CardHeader className="gap-1">
            <CardTitle>{resourceEditingId ? 'Editar recurso' : 'Novo recurso'}</CardTitle>
            <CardDescription>Um recurso = uma linha com capacidade semanal e custo/hora de referência</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            <ConfirmActionBanner
              open={Boolean(resourcePendenteExclusao)}
              title="Confirmar exclusão de recurso"
              message={
                resourcePendenteExclusao
                  ? `Excluir o recurso "${resourcePendenteExclusao.name}"? Esta ação não pode ser desfeita.`
                  : ''
              }
              confirmLabel="Excluir recurso"
              cancelLabel="Cancelar"
              onCancel={() => setResourcePendenteExclusao(null)}
              onConfirm={handleConfirmDeleteResource}
            />
            {resourceFeedback ? (
              <p
                className={`rounded-xl border px-3 py-2 text-xs ${
                  resourceFeedback.startsWith('Falha')
                    ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                }`}
              >
                {resourceFeedback}
              </p>
            ) : null}
            {resourceEditingId ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Modo de edição ativo. Revise os campos e salve as alterações.
              </p>
            ) : null}
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/60"
              placeholder="Nome do recurso"
              value={resourceName}
              onChange={(event) => setResourceName(event.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PESSOA">Pessoa</SelectItem>
                  <SelectItem value="EQUIPAMENTO">Equipamento</SelectItem>
                  <SelectItem value="ESPACO">Espaço</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resourceStatus} onValueChange={setResourceStatus}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISPONIVEL">Disponível</SelectItem>
                  <SelectItem value="RESERVADO">Reservado</SelectItem>
                  <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="number"
                min={0}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Capacidade (h/sem)"
                value={resourceCapacity}
                onChange={(event) => setResourceCapacity(Number(event.target.value))}
              />
              <input
                type="number"
                min={0}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Custo hora (R$)"
                value={resourceCostRate}
                onChange={(event) => setResourceCostRate(event.target.value)}
              />
            </div>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/60"
              placeholder="Observações"
              value={resourceNotes}
              onChange={(event) => setResourceNotes(event.target.value)}
            />
            <div className="flex gap-2">
              <Button
                className="rounded-full"
                disabled={!resourceName.trim()}
                onClick={resourceEditingId ? handleSaveResource : handleCreateResource}
              >
                {resourceEditingId ? 'Salvar recurso' : 'Criar recurso'}
              </Button>
              {resourceEditingId ? (
                <Button type="button" variant="outline" onClick={resetResourceForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Alocações</CardTitle>
            <CardDescription>Quem está reservado para que, em que período</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {allocationsList.length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma alocação cadastrada.
              </div>
            ) : (
              allocationsList.map((allocation) => {
                const resource = resourcesList.find((item) => item.id === allocation.resourceId);
                const project = projectsList.find((item) => item.id === allocation.projectId);
                return (
                  <div
                    key={allocation.id}
                    className={cn(
                      'atlas-item',
                      allocationEditingId === allocation.id
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                        : '',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="atlas-item-title">
                        {resource?.name || 'Recurso'} → {project?.nome || 'Sem projeto'}
                        {allocation.taskId != null ? (
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}
                            · Taskflow #{allocation.taskId}
                          </span>
                        ) : null}
                      </p>
                      <span className="atlas-badge bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                        {allocation.status}
                      </span>
                      {allocationEditingId === allocation.id ? (
                        <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                          Em edição
                        </span>
                      ) : null}
                    </div>
                    <p className="atlas-item-meta">
                      {allocation.startDate} → {allocation.endDate} · {allocation.hoursPerWeek}h/sem
                    </p>
                    <EntityEditDeleteActions
                      className="mt-2"
                      onEdit={() => handleStartEditAllocation(allocation)}
                      onDelete={() => setAllocationPendenteExclusao(allocation)}
                    />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(
            'atlas-surface atlas-hover',
            allocationEditingId
              ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10'
              : '',
          )}
        >
          <CardHeader className="gap-1">
            <CardTitle>{allocationEditingId ? 'Editar alocação' : 'Nova alocação'}</CardTitle>
            <CardDescription>Distribui horas por semana entre duas datas</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            <ConfirmActionBanner
              open={Boolean(allocationPendenteExclusao)}
              title="Confirmar exclusão de alocação"
              message="Excluir esta alocação?"
              confirmLabel="Excluir alocação"
              cancelLabel="Cancelar"
              onCancel={() => setAllocationPendenteExclusao(null)}
              onConfirm={async () => {
                if (!allocationPendenteExclusao) return;
                const res = await fetch(
                  `/api/resourcehub/allocations?id=${allocationPendenteExclusao.id}`,
                  { method: 'DELETE' },
                );
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  setAllocationFormError(
                    typeof err?.error === 'string'
                      ? err.error
                      : 'Não foi possível excluir a alocação.',
                  );
                  return;
                }
                if (allocationEditingId === allocationPendenteExclusao.id) {
                  resetAllocationForm();
                }
                setAllocationPendenteExclusao(null);
                setAllocationFeedback('Alocação excluída com sucesso.');
                await mutate('/api/resourcehub/allocations');
                await mutate('/api/resourcehub/capacity');
              }}
            />
            {allocationFeedback ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                {allocationFeedback}
              </p>
            ) : null}
            {allocationFormError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                {allocationFormError}
              </p>
            ) : null}
            {allocationEditingId ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Modo de edição ativo. Revise os campos e salve as alterações.
              </p>
            ) : null}
            <Select
              value={allocationResourceId ? String(allocationResourceId) : '_none'}
              onOpenChange={() => setAllocationFormError('')}
              onValueChange={(v) =>
                setAllocationResourceId(v === '_none' ? null : Number(v))
              }
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="Recurso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Recurso</SelectItem>
                {resourcesList.map((resource) => (
                  <SelectItem key={resource.id} value={String(resource.id)}>
                    {resource.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={allocationProjectId ? String(allocationProjectId) : '_none'}
              onValueChange={(v) =>
                setAllocationProjectId(v === '_none' ? null : Number(v))
              }
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Projeto</SelectItem>
                {projectsList.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="date"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={allocationStartDate}
                onChange={(event) => setAllocationStartDate(event.target.value)}
              />
              <input
                type="date"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={allocationEndDate}
                onChange={(event) => setAllocationEndDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="number"
                min={1}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Horas/sem"
                value={allocationHours}
                onChange={(event) => setAllocationHours(Number(event.target.value))}
              />
              <Select value={allocationStatus} onValueChange={setAllocationStatus}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="PAUSADO">Pausado</SelectItem>
                  <SelectItem value="ENCERRADO">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <input
                type="number"
                min={1}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="ID da tarefa no Taskflow (opcional)"
                value={allocationTaskId}
                onChange={(event) => setAllocationTaskId(event.target.value)}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Se preencher, o número tem de ser uma tarefa que exista no Taskflow e que o seu utilizador possa ver.
                Deixe vazio para alocar só ao projeto.
              </p>
            </div>
            <button
              className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-70"
              disabled={!allocationResourceId || !allocationStartDate || !allocationEndDate}
              onClick={async () => {
                if (allocationEditingId) {
                  await handleSaveAllocation();
                  return;
                }
                if (!allocationResourceId) return;
                setAllocationFormError('');
                const taskIdParsed = allocationTaskId.trim()
                  ? Number.parseInt(allocationTaskId.trim(), 10)
                  : NaN;
                const taskId =
                  Number.isFinite(taskIdParsed) && taskIdParsed > 0 ? taskIdParsed : undefined;
                const res = await fetch('/api/resourcehub/allocations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    resourceId: allocationResourceId,
                    projectId: allocationProjectId,
                    taskId,
                    startDate: allocationStartDate,
                    endDate: allocationEndDate,
                    hoursPerWeek: allocationHours,
                    status: allocationStatus,
                  }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  setAllocationFormError(
                    typeof err?.error === 'string' ? err.error : 'Não foi possível criar a alocação.',
                  );
                  return;
                }
                resetAllocationForm();
                setAllocationFeedback('Alocação criada com sucesso.');
                await mutate('/api/resourcehub/allocations');
                await mutate('/api/resourcehub/capacity');
              }}
            >
              {allocationEditingId ? 'Salvar alocação' : 'Criar alocação'}
            </button>
            {allocationEditingId ? (
              <Button type="button" variant="outline" onClick={resetAllocationForm}>
                Cancelar
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Heatmap de capacidade</CardTitle>
            <CardDescription>Soma das horas/semana em alocações «Ativo» face à capacidade do recurso</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            {capacityList.length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhum dado de capacidade disponível.
              </div>
            ) : (
              capacityList.map((row) => (
                <div key={row.resourceId} className="atlas-item">
                  <div className="flex items-center justify-between">
                    <span>{row.name}</span>
                    <span className="font-semibold">{row.utilizationPercent}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-2 rounded-full ${
                        row.utilizationPercent >= 90
                          ? 'bg-rose-500'
                          : row.utilizationPercent >= 70
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(row.utilizationPercent, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Ligações a outros módulos</CardTitle>
            <CardDescription>O que o sistema faz hoje (sem confundir com roadmap)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/25">
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">Integrado na aplicação</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Projectus</strong> — ao criar uma alocação pode escolher um projeto da lista (mesmo time).
                  Esse vínculo fica gravado para relatórios e leitura cruzada.
                </li>
                <li>
                  <strong>Taskflow</strong> — opcionalmente pode indicar o <em>ID numérico</em> de uma tarefa; o
                  servidor valida se a tarefa existe e se tem permissão para a ver. Isto não move o cartão no Kanban
                  por si só: apenas documenta a ligação na alocação.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="font-semibold text-amber-950 dark:text-amber-200">Ainda não automático</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Chronos</strong> — não há sincronização com a agenda; a percentagem de utilização vem só das
                  alocações que criar aqui. Use o Chronos em paralelo para bloquear tempo real na vida do recurso.
                </li>
                <li>
                  <strong>BillTrak</strong> — o custo/hora do recurso serve para planeamento; não existe escrita
                  automática de despesas no BillTrak a partir desta página.
                </li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/projectus">Projectus</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/taskflow">Taskflow</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/chronos">Chronos</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/billtrak">BillTrak</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/manual/resourcehub">Manual completo</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Use o ResourceHub para planejar capacidade e reduzir conflitos."
          tips={helpTips}
        />
      </div>
    </ModuleDashboardPageShell>
  );
}
