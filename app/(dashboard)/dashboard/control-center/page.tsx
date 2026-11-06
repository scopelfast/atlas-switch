'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, HeartPulse, Wallet } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { ScriptumStatCard } from '@/components/scriptum/scriptum-stat-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ModuleDashboardPageShell } from '@/components/ui/module-dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { HelpPanel } from '@/components/ui/help-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { hasPermission, type Role } from '@/lib/auth/permissions';
import { ACTION_COPY } from '@/lib/ui/action-copy';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import {
  ModuleSegmentedTabs,
  type ModuleSegmentedTabsItem,
} from '@/components/ui/module-segmented-tabs';
import {
  ModuleWorkspaceHub,
  moduleWorkspaceHubLinkClassName,
} from '@/components/ui/module-workspace-hub';

type Plan = {
  id: number;
  name: string;
  description?: string | null;
  priceCents: number;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  billingInterval: string;
  maxUsers: number;
  maxStorageGb: number;
  aiEnabled: boolean;
  maxTeamAdminSlots?: number;
  catalogSuspended?: boolean;
  modules: { moduleKey: string; enabled: boolean }[];
};

type TeamPlan = {
  teamId: number;
  teamName: string;
  planId?: number | null;
  planName?: string | null;
  planStatus?: string | null;
  negotiatedPriceCents?: number | null;
  billingCycleDay?: number | null;
  nextInvoiceDate?: string | null;
  planPriceCents?: number | null;
};

type Metrics = {
  totalTeams: number;
  activeTeams: number;
  projectedMrr: number;
};

type AuditEvent = {
  id: number;
  module: string;
  action: string;
  detail?: string | null;
  createdAt: string;
};

type HealthRow = {
  teamId: number;
  teamName: string;
  planName?: string | null;
  planStatus?: string | null;
  revenueCents: number;
  lastActivity?: string | null;
  usageScore: number;
  planFitScore: number;
  supportScore: number;
  healthScore: number;
  churnRisk: string;
  recommendation?: string | null;
};

type ControlMainTab = 'novo-plano' | 'planos-cadastrados' | 'visao-gerencial';

const CONTROL_MAIN_TAB_ITEMS: readonly ModuleSegmentedTabsItem<ControlMainTab>[] = [
  { value: 'novo-plano', label: 'Novo plano' },
  { value: 'planos-cadastrados', label: 'Planos cadastrados' },
  { value: 'visao-gerencial', label: 'Visão gerencial' },
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const arrayFetcher = async <T,>(url: string): Promise<T[]> => {
  const res = await fetch(url);
  const data: unknown = await res.json();
  if (!res.ok) {
    const msg =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Erro ${res.status}`;
    throw new Error(msg);
  }
  if (!Array.isArray(data)) return [];
  return data as T[];
};
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value / 100,
  );

const moduleOptions = [
  'chronos',
  'reunify',
  'taskflow',
  'projectus',
  'resourcehub',
  'billtrak',
  'bibliotheca',
  'notepad',
  'scriptum',
];

type PlanFormState = {
  name: string;
  description: string;
  priceCents: number;
  stripeProductId: string;
  stripePriceId: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  maxUsers: number;
  maxStorageGb: number;
  maxTeamAdminSlots: number;
  aiEnabled: boolean;
  modules: Set<string>;
};

const createDefaultPlanForm = (): PlanFormState => ({
  name: '',
  description: '',
  priceCents: 4990,
  stripeProductId: '',
  stripePriceId: '',
  billingInterval: 'MONTHLY',
  maxUsers: 10,
  maxStorageGb: 100,
  maxTeamAdminSlots: 1,
  aiEnabled: true,
  modules: new Set(['chronos', 'reunify', 'taskflow', 'notepad']),
});

export default function ControlCenterPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'control.view');

  const { data: metrics } = useSWR<Metrics>(canView ? '/api/control/metrics' : null, fetcher);
  const {
    data: plans,
    isLoading: plansLoading,
    error: plansSwrError,
  } = useSWR<Plan[]>(canView ? '/api/control/plans' : null, arrayFetcher);
  const { data: teams } = useSWR<TeamPlan[]>(canView ? '/api/control/teams' : null, arrayFetcher);
  const { data: events } = useSWR<AuditEvent[]>(canView ? '/api/control/events' : null, arrayFetcher);
  const { data: health } = useSWR<HealthRow[]>(canView ? '/api/control/health' : null, arrayFetcher);
  const teamsList = Array.isArray(teams) ? teams : [];
  const healthList = Array.isArray(health) ? health : [];
  const eventsList = Array.isArray(events) ? events : [];
  const plansList = Array.isArray(plans) ? plans : [];

  const uniqueTeams = useMemo(() => {
    const byTeamId = new Map<number, TeamPlan>();
    for (const row of teamsList) {
      const existing = byTeamId.get(row.teamId);
      if (!existing) {
        byTeamId.set(row.teamId, row);
        continue;
      }
      const existingIsActive = existing.planStatus === 'ATIVO';
      const nextIsActive = row.planStatus === 'ATIVO';
      if (!existingIsActive && nextIsActive) {
        byTeamId.set(row.teamId, row);
      }
    }
    return Array.from(byTeamId.values());
  }, [teamsList]);

  const [planForm, setPlanForm] = useState<PlanFormState>(createDefaultPlanForm());
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<PlanFormState | null>(null);

  const [teamForm, setTeamForm] = useState({
    teamId: '',
    planId: '',
    status: 'ATIVO',
    negotiatedPriceCents: '',
    billingCycleDay: 5,
    nextInvoiceDate: '',
  });

  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<ControlMainTab>('visao-gerencial');

  const projectedMrr = metrics?.projectedMrr ?? 0;
  const planInputClass =
    'rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100';
  const selectClass =
    'h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100';

  const planModules = useMemo(() => {
    return plansList.reduce<Record<number, string[]>>((acc, plan) => {
      acc[plan.id] = plan.modules.filter((m) => m.enabled).map((m) => m.moduleKey);
      return acc;
    }, {});
  }, [plansList]);

  const assignablePlans = useMemo(
    () => plansList.filter((p) => !p.catalogSuspended),
    [plansList],
  );

  const planAdoptionByName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of uniqueTeams) {
      const key = t.planName?.trim() ? t.planName : 'Sem plano atribuído';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [uniqueTeams]);

  const avgHealthScore = useMemo(() => {
    if (!healthList.length) return null;
    const sum = healthList.reduce((s, r) => s + (r.healthScore ?? 0), 0);
    return Math.round(sum / healthList.length);
  }, [healthList]);

  const churnAltoCount = useMemo(
    () => healthList.filter((r) => r.churnRisk === 'ALTO').length,
    [healthList],
  );

  const activeCatalogPlans = useMemo(
    () => plansList.filter((p) => !p.catalogSuspended).length,
    [plansList],
  );

  const handleEditPlan = (plan: Plan) => {
    setEditError(null);
    setEditingPlanId(plan.id);
    setEditingForm({
      name: plan.name,
      description: plan.description || '',
      priceCents: plan.priceCents,
      stripeProductId: plan.stripeProductId || '',
      stripePriceId: plan.stripePriceId || '',
      billingInterval: (plan.billingInterval as 'MONTHLY' | 'YEARLY') ?? 'MONTHLY',
      maxUsers: plan.maxUsers,
      maxStorageGb: plan.maxStorageGb,
      maxTeamAdminSlots: plan.maxTeamAdminSlots ?? 1,
      aiEnabled: plan.aiEnabled,
      modules: new Set(
        plan.modules.filter((module) => module.enabled).map((module) => module.moduleKey),
      ),
    });
  };

  const handleCancelEdit = () => {
    setEditingPlanId(null);
    setEditingForm(null);
    setEditError(null);
  };

  useEffect(() => {
    if (editingPlanId == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingPlanId(null);
        setEditingForm(null);
        setEditError(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingPlanId]);

  const handleToggleCatalogSuspended = async (plan: Plan) => {
    const next = plan.catalogSuspended !== true;
    setPlanError(null);
    setEditError(null);
    setIsSavingPlan(true);
    try {
      const response = await fetch('/api/control/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: plan.id,
          catalogSuspended: next,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || 'Erro ao atualizar plano');
      }
      await mutate('/api/control/plans');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar plano';
      setPlanError(msg);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleDeletePlan = async (plan: Plan) => {
    if (
      !window.confirm(
        `Excluir o plano «${plan.name}»? Esta ação não pode ser desfeita. Se houver contratos ligados, a operação pode falhar.`,
      )
    ) {
      return;
    }
    setPlanError(null);
    setEditError(null);
    setIsSavingPlan(true);
    try {
      const response = await fetch(`/api/control/plans?id=${plan.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || 'Erro ao excluir plano');
      }
      if (editingPlanId === plan.id) handleCancelEdit();
      await mutate('/api/control/plans');
      await mutate('/api/control/teams');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir plano';
      setPlanError(msg);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleSaveEditPlan = async () => {
    if (!editingPlanId || !editingForm) return;
    if (!editingForm.name.trim()) {
      setEditError('Informe o nome do plano.');
      return;
    }

    setEditError(null);
    setIsSavingPlan(true);
    try {
      const response = await fetch('/api/control/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPlanId,
          name: editingForm.name.trim(),
          description: editingForm.description.trim() || null,
          priceCents: Number(editingForm.priceCents),
          stripeProductId: editingForm.stripeProductId.trim() || null,
          stripePriceId: editingForm.stripePriceId.trim() || null,
          billingInterval: editingForm.billingInterval,
          maxUsers: Number(editingForm.maxUsers),
          maxStorageGb: Number(editingForm.maxStorageGb),
          maxTeamAdminSlots: Number(editingForm.maxTeamAdminSlots),
          aiEnabled: editingForm.aiEnabled,
          modules: Array.from(editingForm.modules).map((moduleKey) => ({
            moduleKey,
            enabled: true,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || 'Erro ao salvar plano');
      }

      await mutate('/api/control/plans');
      await mutate('/api/control/teams');
      await mutate('/api/control/metrics');
      handleCancelEdit();
    } catch (err: any) {
      setEditError(err?.message || 'Erro ao salvar plano');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!planForm.name.trim()) {
      setPlanError('Informe o nome do plano.');
      return;
    }

    setPlanError(null);
    setIsSavingPlan(true);
    try {
      const response = await fetch('/api/control/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planForm.name.trim(),
          description: planForm.description.trim() || null,
          priceCents: Number(planForm.priceCents),
          stripeProductId: planForm.stripeProductId.trim() || null,
          stripePriceId: planForm.stripePriceId.trim() || null,
          billingInterval: planForm.billingInterval,
          maxUsers: Number(planForm.maxUsers),
          maxStorageGb: Number(planForm.maxStorageGb),
          maxTeamAdminSlots: Number(planForm.maxTeamAdminSlots),
          aiEnabled: planForm.aiEnabled,
          modules: Array.from(planForm.modules).map((moduleKey) => ({
            moduleKey,
            enabled: true,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || 'Erro ao criar plano');
      }

      setPlanForm(createDefaultPlanForm());
      await mutate('/api/control/plans');
    } catch (err: any) {
      setPlanError(err?.message || 'Erro ao criar plano');
    } finally {
      setIsSavingPlan(false);
    }
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
              Você não tem permissão para acessar o Control Center.
            </p>
          </CardContent>
        </Card>
        <div className="mt-6">
          <HelpPanel
            title="Ajuda rápida"
            description="Este painel é só para quem opera a instância Atlas (operador da plataforma), não para donos de time cliente."
            tips={[
              'Peça à equipa Atlas ou ao parceiro que gere a sua instância para lhe conceder o papel adequado.',
              'Donos de time continuam a gerir convites e definições no contexto do próprio time.',
            ]}
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
            title="Atlas Control Center"
            description="Controle total de clientes, planos, faturamento e auditoria."
            className="w-full"
          />
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Button
            asChild
            variant="outline"
            className="w-full border-violet-200/80 bg-white/90 text-violet-800 shadow-sm backdrop-blur-sm hover:bg-violet-50 dark:border-violet-500/25 dark:bg-slate-900/70 dark:text-violet-200 dark:hover:bg-violet-950/40 sm:w-auto"
          >
            <Link href="/manual/control-center">Manual</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <ModuleWorkspaceHub
          description={
            mainTab === 'visao-gerencial' ? (
              <>
                Visão gerencial: adesão por plano, ligação cliente–contrato, saúde e auditoria recente.
              </>
            ) : mainTab === 'novo-plano' ? (
              <>Novo plano: cadastro no catálogo comerciais (Stripe opcional) e módulos.</>
            ) : (
              <>
                Planos cadastrados: edição em modal, suspensão no catálogo e exclusão com confirmação.
              </>
            )
          }
          links={
            <Link href="/manual/control-center" className={moduleWorkspaceHubLinkClassName}>
              Manual do Control Center
            </Link>
          }
          tabs={
            <ModuleSegmentedTabs<ControlMainTab>
              aria-label="Área de trabalho do Control Center"
              tone="accent"
              tabListClassName="max-w-full"
              items={CONTROL_MAIN_TAB_ITEMS}
              value={mainTab}
              onValueChange={setMainTab}
            />
          }
        />
      </div>

      {mainTab === 'visao-gerencial' && (
      <div className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ScriptumStatCard
            variant="violet"
            icon={Building2}
            title="Empresas (times)"
            description="Total de clientes na instância e activação agregada"
            value={metrics?.totalTeams ?? 0}
            footnote={`${metrics?.activeTeams ?? 0} com plano ATIVO na visão agregada`}
          />
          <ScriptumStatCard
            variant="emerald"
            icon={Wallet}
            title="MRR projetado"
            description="Receita mensal recorrente estimada pelos contratos activos"
            value={formatCurrency(projectedMrr)}
            footnote="Soma dos contratos com estado ATIVO"
          />
          <ScriptumStatCard
            variant="indigo"
            icon={HeartPulse}
            title="Saúde média"
            description="Média do score de saúde dos clientes com métrica calculada"
            value={avgHealthScore != null ? avgHealthScore : '—'}
            footnote={
              healthList.length
                ? `Base: ${healthList.length} cliente(s) com registo de saúde`
                : 'Sem dados de saúde — verifique integrações ou aguarde cálculo'
            }
          />
          <ScriptumStatCard
            variant="sky"
            icon={AlertTriangle}
            title="Risco de churn (alto)"
            description="Clientes classificados com risco ALTO na última avaliação"
            value={churnAltoCount}
            footnote="Priorize contacto comercial ou sucesso do cliente"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="atlas-surface atlas-hover">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <CardTitle>Adesão por plano</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Distribuição de empresas pelo nome do plano contratado (visão agregada).
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-full shrink-0">
                <Link href="/dashboard/empresas">Gerir empresas</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {planAdoptionByName.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados de clientes.</p>
              ) : (
                planAdoptionByName.slice(0, 8).map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">{name}</span>
                    <span className="text-xs text-slate-500">{count} empresa(s)</span>
                  </div>
                ))
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Planos no catálogo ativo: {activeCatalogPlans} de {plansList.length}
                {plansList.some((p) => p.catalogSuspended) ? ' (há planos suspensos de novas vendas)' : ''}
              </p>
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Configurar cliente</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Associe plano e valores ao time seleccionado (contrato comercial).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Cliente (time)
                </Label>
                <Select
                  value={teamForm.teamId || '_none'}
                  onValueChange={(v) =>
                    setTeamForm((prev) => ({
                      ...prev,
                      teamId: v === '_none' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue placeholder="Escolher empresa / time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Escolher empresa / time</SelectItem>
                    {uniqueTeams.map((team) => (
                      <SelectItem key={team.teamId} value={String(team.teamId)}>
                        {team.teamName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Plano do catálogo
                </Label>
                <Select
                  value={teamForm.planId || '_none'}
                  onValueChange={(v) =>
                    setTeamForm((prev) => ({
                      ...prev,
                      planId: v === '_none' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue placeholder="Escolher plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Escolher plano</SelectItem>
                    {assignablePlans.map((plan) => (
                      <SelectItem key={plan.id} value={String(plan.id)}>
                        {plan.name} • {formatCurrency(plan.priceCents)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Preço negociado (centavos)
                  </Label>
                  <Input
                    type="number"
                    placeholder="Opcional — ex.: 9900"
                    className={planInputClass}
                    value={teamForm.negotiatedPriceCents}
                    onChange={(event) =>
                      setTeamForm((prev) => ({ ...prev, negotiatedPriceCents: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Próxima data de fatura
                  </Label>
                  <Input
                    type="date"
                    className={planInputClass}
                    value={teamForm.nextInvoiceDate}
                    onChange={(event) =>
                      setTeamForm((prev) => ({ ...prev, nextInvoiceDate: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Estado do contrato
                </Label>
                <Select
                  value={teamForm.status}
                  onValueChange={(v) =>
                    setTeamForm((prev) => ({ ...prev, status: v }))
                  }
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="TRIAL">Trial</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                    <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={async () => {
                  if (!teamForm.teamId || !teamForm.planId) {
                    setTeamError('Selecione cliente e plano.');
                    return;
                  }
                  setTeamError(null);
                  setIsSavingTeam(true);
                  try {
                    const response = await fetch('/api/control/teams', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        teamId: Number(teamForm.teamId),
                        planId: Number(teamForm.planId),
                        status: teamForm.status,
                        negotiatedPriceCents: teamForm.negotiatedPriceCents
                          ? Number(teamForm.negotiatedPriceCents)
                          : null,
                        billingCycleDay: 5,
                        nextInvoiceDate: teamForm.nextInvoiceDate || null,
                      }),
                    });
                    if (!response.ok) {
                      const payload = await response.json();
                      throw new Error(payload?.error || 'Erro ao salvar cliente');
                    }
                    setTeamForm({
                      teamId: '',
                      planId: '',
                      status: 'ATIVO',
                      negotiatedPriceCents: '',
                      billingCycleDay: 5,
                      nextInvoiceDate: '',
                    });
                    await mutate('/api/control/teams');
                    await mutate('/api/control/metrics');
                  } catch (err: unknown) {
                    setTeamError(err instanceof Error ? err.message : 'Erro ao salvar cliente');
                  } finally {
                    setIsSavingTeam(false);
                  }
                }}
                disabled={isSavingTeam || !teamForm.teamId || !teamForm.planId}
              >
                {isSavingTeam ? 'Salvando...' : 'Aplicar configuração'}
              </Button>
              {teamError && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {teamError}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Saúde dos clientes</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Scores e risco de churn por cliente (última avaliação disponível).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {healthList.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhum score calculado
                </div>
              ) : (
                healthList.map((row, index) => (
                  <div
                    key={`${row.teamId}-${row.planStatus || 'na'}-${index}`}
                    className="atlas-item flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="atlas-item-title">{row.teamName}</p>
                      <p className="atlas-item-meta">
                        {row.planName || 'Sem plano'} • {row.churnRisk}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {row.recommendation || 'Sem recomendação.'}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 text-xs text-slate-500 dark:text-slate-400 sm:items-end">
                      <span className="atlas-badge bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                        Score {row.healthScore}
                      </span>
                      <span>MRR: {formatCurrency(row.revenueCents)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Clientes e planos</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Visão agregada de contratos e valores negociados.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {uniqueTeams.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhum cliente encontrado
                </div>
              ) : (
                uniqueTeams.map((team) => (
                  <div
                    key={team.teamId}
                    className="atlas-item flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="atlas-item-title">{team.teamName}</p>
                      <p className="atlas-item-meta">
                        Plano: {team.planName || 'Não definido'} • Status:{' '}
                        {team.planStatus || 'N/A'}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatCurrency(
                        team.negotiatedPriceCents ?? team.planPriceCents ?? 0,
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Auditoria recente</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Últimas acções registadas no plano de controlo (máx. 8).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {eventsList.length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300 sm:col-span-2 xl:col-span-4">
                Nenhuma auditoria registrada
              </div>
            ) : (
              eventsList.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="atlas-item flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <p className="atlas-item-title text-sm leading-snug">{event.action}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {event.module} • {new Date(event.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {mainTab === 'novo-plano' && (
        <div className="mt-6 w-full space-y-4">
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Planos suspensos deixam de aparecer ao associar novos contratos em{' '}
            <Link href="/dashboard/empresas" className="font-medium text-indigo-600 underline dark:text-indigo-400">
              Empresas
            </Link>
            ; contratos já existentes mantêm-se.
          </p>
          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Criar plano no catálogo</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Preço, limites, Stripe opcional e módulos. Após guardar, o plano aparece em «Planos cadastrados» e nas
                associações em Empresas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-sm text-slate-600 dark:text-slate-300">
              <div className="grid gap-6 xl:grid-cols-12 xl:items-start">
                <div className="space-y-4 xl:col-span-7">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="min-w-0 lg:col-span-2">
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Nome do plano
                      </Label>
                      <Input
                        className={planInputClass}
                        placeholder="Ex.: Profissional"
                        value={planForm.name}
                        onChange={(event) =>
                          setPlanForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="min-w-0 lg:col-span-2">
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Descrição
                      </Label>
                      <textarea
                        className={`${planInputClass} min-h-[88px] w-full resize-y py-2.5`}
                        placeholder="Resumo do que esse plano entrega"
                        rows={3}
                        value={planForm.description}
                        onChange={(event) =>
                          setPlanForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Preço (centavos)
                      </Label>
                      <Input
                        type="number"
                        className={planInputClass}
                        placeholder="4990 = R$ 49,90"
                        value={planForm.priceCents}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            priceCents: Number(event.target.value),
                          }))
                        }
                      />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        ≈ {formatCurrency(Number(planForm.priceCents) || 0)}
                      </p>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Ciclo de cobrança
                      </Label>
                      <Select
                        value={planForm.billingInterval}
                        onValueChange={(v) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            billingInterval: v as 'MONTHLY' | 'YEARLY',
                          }))
                        }
                      >
                        <SelectTrigger className={selectClass}>
                          <SelectValue placeholder="Ciclo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Mensal</SelectItem>
                          <SelectItem value="YEARLY">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Limite de usuários
                      </Label>
                      <Input
                        type="number"
                        className={planInputClass}
                        value={planForm.maxUsers}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            maxUsers: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Armazenamento (GB)
                      </Label>
                      <Input
                        type="number"
                        className={planInputClass}
                        value={planForm.maxStorageGb}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            maxStorageGb: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Vagas admin no time (1–99)
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        className={planInputClass}
                        value={planForm.maxTeamAdminSlots}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            maxTeamAdminSlots: Math.min(
                              99,
                              Math.max(1, Number(event.target.value) || 1),
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/60 lg:col-span-3">
                      <Label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        IA na oferta comercial
                      </Label>
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 rounded border-slate-300"
                          checked={planForm.aiEnabled}
                          onChange={(event) =>
                            setPlanForm((prev) => ({ ...prev, aiEnabled: event.target.checked }))
                          }
                        />
                        <span>
                          Mostrar «IA liberada no plano» na página pública de preços (em vez de «IA sob demanda»).
                        </span>
                      </label>
                      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        É uma etiqueta de catálogo: não liga nem desliga sozinha as APIs de modelo de linguagem no
                        produto. O Taskflow em nuvem, por exemplo, usa opt-in e quotas ao nível do time e da instância.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Stripe Product ID
                      </Label>
                      <Input
                        className={planInputClass}
                        placeholder="Opcional"
                        value={planForm.stripeProductId}
                        onChange={(event) =>
                          setPlanForm((prev) => ({ ...prev, stripeProductId: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Stripe Price ID
                      </Label>
                      <Input
                        className={planInputClass}
                        placeholder="Opcional"
                        value={planForm.stripePriceId}
                        onChange={(event) =>
                          setPlanForm((prev) => ({ ...prev, stripePriceId: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50 xl:col-span-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Módulos liberados
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Marque os produtos incluídos nesta oferta.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {moduleOptions.map((moduleKey) => (
                      <label
                        key={moduleKey}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs capitalize text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 rounded border-slate-300"
                          checked={planForm.modules.has(moduleKey)}
                          onChange={(event) => {
                            setPlanForm((prev) => {
                              const next = new Set(prev.modules);
                              if (event.target.checked) {
                                next.add(moduleKey);
                              } else {
                                next.delete(moduleKey);
                              }
                              return { ...prev, modules: next };
                            });
                          }}
                        />
                        {moduleKey}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {planError && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {planError}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <Button
                  onClick={() => void handleCreatePlan()}
                  disabled={isSavingPlan || editingPlanId !== null}
                  className="rounded-full"
                >
                  {isSavingPlan ? 'Salvando...' : 'Adicionar plano'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {mainTab === 'planos-cadastrados' && (
        <div className="mt-6 w-full space-y-4">
          {plansSwrError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {plansSwrError instanceof Error
                ? plansSwrError.message
                : 'Não foi possível carregar os planos.'}
            </p>
          ) : null}
          {planError && !plansSwrError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {planError}
            </p>
          ) : null}
          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Planos cadastrados</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Edição em janela modal. Suspender remove o plano de novas associações; excluir pode falhar se existirem
                contratos ligados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">A carregar planos…</p>
              ) : plansList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/30">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Ainda não há planos no catálogo
                  </p>
                  <p className="mt-2 max-w-md text-xs text-slate-500 dark:text-slate-400">
                    Se acabou de criar a base de dados, execute o seed (`pnpm db:seed`) ou crie o primeiro plano na aba
                    «Novo plano».
                  </p>
                  <Button
                    type="button"
                    className="mt-5 rounded-full"
                    onClick={() => setMainTab('novo-plano')}
                  >
                    Ir para Novo plano
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="mb-2 hidden gap-4 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto]">
                    <span>Plano</span>
                    <span>Preço</span>
                    <span>Catálogo</span>
                    <span>Módulos</span>
                    <span className="text-right">Acções</span>
                  </div>
                  {plansList.map((plan) => {
                    const modulesEnabled = planModules[plan.id] || [];
                    const intervalLabel =
                      plan.billingInterval === 'MONTHLY'
                        ? 'mês'
                        : plan.billingInterval === 'YEARLY'
                          ? 'ano'
                          : plan.billingInterval.toLowerCase();
                    return (
                      <div
                        key={plan.id}
                        className="flex flex-col gap-4 py-4 first:pt-0 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-4"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{plan.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 lg:hidden">
                            {formatCurrency(plan.priceCents)} / {intervalLabel} · {plan.maxUsers} utilizadores
                          </p>
                        </div>
                        <div className="hidden text-sm text-slate-700 dark:text-slate-200 lg:block">
                          <span className="font-medium">{formatCurrency(plan.priceCents)}</span>
                          <span className="text-slate-400"> / {intervalLabel}</span>
                          <p className="mt-0.5 text-xs text-slate-500">
                            até {plan.maxUsers} utilizadores · {plan.maxTeamAdminSlots ?? 1} admin(s)
                          </p>
                        </div>
                        <div>
                          {plan.catalogSuspended ? (
                            <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                              Suspenso
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                              Catálogo ativo
                            </span>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {modulesEnabled.length ? (
                            modulesEnabled.map((m) => (
                              <span
                                key={m}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] capitalize text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">Sem módulos</span>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => handleEditPlan(plan)}
                            disabled={isSavingPlan}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => void handleToggleCatalogSuspended(plan)}
                            disabled={isSavingPlan}
                          >
                            {plan.catalogSuspended ? 'Reativar' : 'Suspender'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="rounded-full"
                            onClick={() => void handleDeletePlan(plan)}
                            disabled={isSavingPlan}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {editingPlanId != null &&
        editingForm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[380] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="control-plan-edit-title"
            onClick={handleCancelEdit}
          >
            <div
              className="max-h-[calc(100vh-3rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-violet-200/80 bg-white p-4 shadow-xl dark:border-violet-900/50 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                id="control-plan-edit-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                Editar plano
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Mesmo padrão do cadastro: ajuste oferta comercial, Stripe e módulos.
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:items-start">
                <div className="space-y-4 lg:col-span-8">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="min-w-0 lg:col-span-2">
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Nome do plano
                      </Label>
                      <Input
                        className={planInputClass}
                        value={editingForm.name}
                        onChange={(event) =>
                          setEditingForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                        }
                      />
                    </div>
                    <div className="min-w-0 lg:col-span-2">
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Descrição
                      </Label>
                      <textarea
                        className={`${planInputClass} min-h-[88px] w-full resize-y py-2.5`}
                        rows={3}
                        value={editingForm.description}
                        onChange={(event) =>
                          setEditingForm((prev) =>
                            prev ? { ...prev, description: event.target.value } : prev,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Preço (centavos)
                      </Label>
                      <Input
                        type="number"
                        className={planInputClass}
                        value={editingForm.priceCents}
                        onChange={(event) =>
                          setEditingForm((prev) =>
                            prev ? { ...prev, priceCents: Number(event.target.value) } : prev,
                          )
                        }
                      />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        ≈ {formatCurrency(Number(editingForm.priceCents) || 0)}
                      </p>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Ciclo de cobrança
                      </Label>
                      <Select
                        value={editingForm.billingInterval}
                        onValueChange={(v) =>
                          setEditingForm((prev) =>
                            prev ? { ...prev, billingInterval: v as 'MONTHLY' | 'YEARLY' } : prev,
                          )
                        }
                      >
                        <SelectTrigger className={selectClass}>
                          <SelectValue placeholder="Cobrança" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Mensal</SelectItem>
                          <SelectItem value="YEARLY">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Limite de usuários
                      </Label>
                      <Input
                        type="number"
                        className={planInputClass}
                        value={editingForm.maxUsers}
                        onChange={(event) =>
                          setEditingForm((prev) =>
                            prev ? { ...prev, maxUsers: Number(event.target.value) } : prev,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Armazenamento (GB)
                      </Label>
                      <Input
                        type="number"
                        className={planInputClass}
                        value={editingForm.maxStorageGb}
                        onChange={(event) =>
                          setEditingForm((prev) =>
                            prev ? { ...prev, maxStorageGb: Number(event.target.value) } : prev,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Vagas admin no time (1-99)
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        className={planInputClass}
                        value={editingForm.maxTeamAdminSlots}
                        onChange={(event) =>
                          setEditingForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  maxTeamAdminSlots: Math.min(
                                    99,
                                    Math.max(1, Number(event.target.value) || 1),
                                  ),
                                }
                              : prev,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/60 lg:col-span-3">
                      <Label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        IA na oferta comercial
                      </Label>
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 rounded border-slate-300"
                          checked={editingForm.aiEnabled}
                          onChange={(event) =>
                            setEditingForm((prev) =>
                              prev ? { ...prev, aiEnabled: event.target.checked } : prev,
                            )
                          }
                        />
                        <span>
                          Mostrar "IA liberada no plano" na página pública de preços (em vez de "IA sob demanda").
                        </span>
                      </label>
                      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        Bandeira de catálogo apenas; não substitui o opt-in de IA do time (ex.: Taskflow em nuvem).
                      </p>
                    </div>
                  </div>

                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50 lg:col-span-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Módulos liberados
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Defina os produtos incluídos neste plano.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {moduleOptions.map((moduleKey) => (
                      <label
                        key={moduleKey}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs capitalize text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 rounded border-slate-300"
                          checked={editingForm.modules.has(moduleKey)}
                          onChange={(event) =>
                            setEditingForm((prev) => {
                              if (!prev) return prev;
                              const next = new Set(prev.modules);
                              if (event.target.checked) next.add(moduleKey);
                              else next.delete(moduleKey);
                              return { ...prev, modules: next };
                            })
                          }
                        />
                        {moduleKey}
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-3 pt-1">
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Stripe Product ID
                      </Label>
                      <Input
                        className={planInputClass}
                        value={editingForm.stripeProductId}
                        onChange={(event) =>
                          setEditingForm((prev) =>
                            prev ? { ...prev, stripeProductId: event.target.value } : prev,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Stripe Price ID
                      </Label>
                      <Input
                        className={planInputClass}
                        value={editingForm.stripePriceId}
                        onChange={(event) =>
                          setEditingForm((prev) =>
                            prev ? { ...prev, stripePriceId: event.target.value } : prev,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
              {editError && (
                <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {editError}
                </p>
              )}
              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={handleCancelEdit}
                  disabled={isSavingPlan}
                >
                  {ACTION_COPY.cancel}
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => void handleSaveEditPlan()}
                  disabled={isSavingPlan}
                >
                  {isSavingPlan ? ACTION_COPY.saving : ACTION_COPY.save}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}


      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Gerencie clientes, planos e auditoria do SaaS."
          tips={[
            'Atualize planos para refletir novas ofertas.',
            'Revise métricas de MRR semanalmente.',
            'Registre exceções e negociações no detalhe do cliente.',
          ]}
        />
      </div>
    </ModuleDashboardPageShell>
  );
}
