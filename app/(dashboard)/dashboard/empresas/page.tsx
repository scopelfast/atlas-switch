'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR, { mutate } from 'swr';
import { Building2, CalendarDays, Link2, Package, Search, Wallet } from 'lucide-react';
import { BilltrakStatCard } from '@/components/billtrak/billtrak-stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleHeader } from '@/components/ui/module-header';
import { ModuleDashboardPageShell } from '@/components/ui/module-dashboard-page-shell';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { hasPermission, type Role } from '@/lib/auth/permissions';
import { ACTION_COPY } from '@/lib/ui/action-copy';

type EmpresaPlan = {
  id: number;
  planId: number;
  planName: string;
  status: string;
  negotiatedPriceCents?: number | null;
  billingCycleDay?: number | null;
  nextInvoiceDate?: string | null;
};

type Empresa = {
  id: number;
  name: string;
  subscriptionStatus?: string | null;
  plans: EmpresaPlan[];
};

type Plan = { id: number; name: string; catalogSuspended?: boolean };

type PendenteEmpresaAcao =
  | {
      kind: 'remove_plan';
      teamPlanId: number;
      planoNome: string;
      empresaNome: string;
    }
  | {
      kind: 'billing';
      teamId: number;
      empresaNome: string;
      action: 'suspend_all_active_plans' | 'resume_all_paused_plans';
    };

function pendenteConfirmTitle(p: PendenteEmpresaAcao): string {
  if (p.kind === 'remove_plan') return 'Remover plano da empresa';
  return p.action === 'suspend_all_active_plans' ? 'Suspender contratos' : 'Reativar contratos';
}

function pendenteConfirmMessage(p: PendenteEmpresaAcao): string {
  if (p.kind === 'remove_plan') {
    return `Remover «${p.planoNome}» da empresa «${p.empresaNome}»? O vínculo deixa de existir no painel.`;
  }
  if (p.action === 'suspend_all_active_plans') {
    return `Suspender todos os contratos ATIVO de «${p.empresaNome}»? Passam ao estado PAUSADO.`;
  }
  return `Reativar todos os contratos em PAUSADO de «${p.empresaNome}»? Voltam ao estado ATIVO (CANCELADO não muda).`;
}

function pendenteConfirmLabel(p: PendenteEmpresaAcao): string {
  if (p.kind === 'remove_plan') return 'Remover plano';
  return p.action === 'suspend_all_active_plans' ? 'Suspender' : 'Reativar';
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const formatCurrency = (cents?: number | null) =>
  cents != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
    : '—';

const formatDatePt = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const modalFieldClass =
  'rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60';

function empresaBillingRollup(emp: Empresa) {
  let mrr = 0;
  let next: string | null = null;
  for (const p of emp.plans) {
    if (p.status === 'ATIVO' && p.negotiatedPriceCents != null) {
      mrr += p.negotiatedPriceCents;
    }
    if (p.status === 'ATIVO' && p.nextInvoiceDate) {
      if (!next || p.nextInvoiceDate < next) next = p.nextInvoiceDate;
    }
  }
  return { mrr, nextInvoice: next };
}

export default function EmpresasPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);
  const role = (user?.role || 'member') as Role;
  const canManage = hasPermission(role, 'control.view');

  const [filterDraft, setFilterDraft] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const apiUrl = filterQ.trim()
    ? `/api/control/empresas?q=${encodeURIComponent(filterQ.trim())}`
    : '/api/control/empresas';
  const { data: empresas = [], isLoading: empresasLoading } = useSWR<Empresa[]>(
    canManage ? apiUrl : null,
    fetcher,
  );
  const { data: plans = [] } = useSWR<Plan[]>(canManage ? '/api/control/plans' : null, fetcher);

  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPlanId, setCreatePlanId] = useState('_none');
  const [createStatus, setCreateStatus] = useState('ATIVO');
  const [createBillingCycleDay, setCreateBillingCycleDay] = useState('5');
  const [createNegotiatedPrice, setCreateNegotiatedPrice] = useState('');
  const [createNextInvoiceDate, setCreateNextInvoiceDate] = useState('');
  const [createMasterName, setCreateMasterName] = useState('');
  const [createMasterEmail, setCreateMasterEmail] = useState('');
  const [createMasterRole, setCreateMasterRole] = useState('owner');
  const [createFeedback, setCreateFeedback] = useState('');
  const [createInviteUrl, setCreateInviteUrl] = useState('');
  const [listMessage, setListMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [editEmpresa, setEditEmpresa] = useState<{
    id: number;
    name: string;
    masterName: string;
    masterEmail: string;
    masterRole: string;
  } | null>(null);
  const [editEmpresaInviteUrl, setEditEmpresaInviteUrl] = useState('');
  const [editPlan, setEditPlan] = useState<{
    teamPlanId: number;
    empresaName: string;
    planName: string;
    status: string;
    negotiatedPrice: string;
    billingCycleDay: string;
    nextInvoiceDate: string;
  } | null>(null);
  const [pendente, setPendente] = useState<PendenteEmpresaAcao | null>(null);

  const handleFilter = () => setFilterQ(filterDraft);
  const handleClearFilter = () => {
    setFilterDraft('');
    setFilterQ('');
  };

  const handleAddPlan = async (teamId: number) => {
    const planId = Number(selectedPlanId);
    if (!planId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/control/team-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, planId }),
      });
      if (!res.ok) {
        const err = await res.json();
        setListMessage({ type: 'err', text: (err?.error as string) ?? 'Erro ao adicionar plano.' });
        return;
      }
      mutate(apiUrl);
      setAddingTo(null);
      setSelectedPlanId('');
    } finally {
      setSaving(false);
    }
  };

  const confirmarPendente = async () => {
    if (!pendente) return;
    setSaving(true);
    setListMessage(null);
    try {
      if (pendente.kind === 'remove_plan') {
        const res = await fetch(`/api/control/team-plans?id=${pendente.teamPlanId}`, {
          method: 'DELETE',
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(payload.error ?? 'Erro ao remover plano.');
        }
        setListMessage({ type: 'ok', text: 'Plano removido da empresa.' });
      } else {
        const res = await fetch('/api/control/empresas', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pendente.teamId, action: pendente.action }),
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(payload.error ?? 'Falha na operação.');
        setListMessage({
          type: 'ok',
          text:
            pendente.action === 'suspend_all_active_plans'
              ? 'Contratos suspensos (PAUSADO).'
              : 'Contratos reativados (ATIVO).',
        });
      }
      setPendente(null);
      await mutate(apiUrl);
    } catch (err) {
      setListMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Operação falhou.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEmpresa = async () => {
    if (!createName.trim()) {
      setCreateFeedback('Informe o nome da empresa.');
      return;
    }
    setSaving(true);
    setCreateFeedback('');
    setCreateInviteUrl('');
    try {
      const negotiatedFloat = createNegotiatedPrice.trim()
        ? Number(createNegotiatedPrice.replace(',', '.'))
        : null;
      const res = await fetch('/api/control/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          planId: createPlanId === '_none' ? null : Number(createPlanId),
          status: createStatus,
          billingCycleDay: Number(createBillingCycleDay),
          negotiatedPriceCents:
            negotiatedFloat != null && Number.isFinite(negotiatedFloat)
              ? Math.round(negotiatedFloat * 100)
              : null,
          nextInvoiceDate: createNextInvoiceDate || null,
          masterName: createMasterName.trim() || null,
          masterEmail: createMasterEmail.trim().toLowerCase() || null,
          masterRole: createMasterRole,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        masterInvite?: { inviteUrl?: string | null; emailSent?: boolean | null };
      };
      if (!res.ok) {
        setCreateFeedback(payload?.error ?? 'Falha ao cadastrar empresa.');
        return;
      }
      if (payload?.masterInvite?.inviteUrl) {
        setCreateInviteUrl(payload.masterInvite.inviteUrl);
      }
      if (payload?.masterInvite?.emailSent === false) {
        setCreateFeedback(
          'Empresa cadastrada e convite do master criado, mas o e-mail não foi enviado. Use o link abaixo.',
        );
      } else if (payload?.masterInvite?.inviteUrl) {
        setCreateFeedback('Empresa cadastrada e convite do master enviado/criado com sucesso.');
      } else {
        setCreateFeedback('Empresa cadastrada com sucesso.');
      }
      setCreateName('');
      setCreatePlanId('_none');
      setCreateStatus('ATIVO');
      setCreateBillingCycleDay('5');
      setCreateNegotiatedPrice('');
      setCreateNextInvoiceDate('');
      setCreateMasterName('');
      setCreateMasterEmail('');
      setCreateMasterRole('owner');
      await mutate(apiUrl);
    } finally {
      setSaving(false);
    }
  };

  const planOptions = useMemo(() => {
    return plans
      .filter((p: Plan) => !p.catalogSuspended)
      .map((p: Plan) => ({ value: String(p.id), label: p.name }));
  }, [plans]);
  const totalPlanLinks = useMemo(
    () => empresas.reduce((acc, emp) => acc + emp.plans.length, 0),
    [empresas],
  );

  const billingPortfolio = useMemo(() => {
    let mrr = 0;
    let upcoming7 = 0;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 7);
    const limitStr = limit.toISOString().slice(0, 10);
    for (const e of empresas) {
      for (const p of e.plans) {
        if (p.status === 'ATIVO' && p.negotiatedPriceCents != null) {
          mrr += p.negotiatedPriceCents;
        }
        if (
          p.status === 'ATIVO' &&
          p.nextInvoiceDate &&
          p.nextInvoiceDate >= todayStr &&
          p.nextInvoiceDate <= limitStr
        ) {
          upcoming7 += 1;
        }
      }
    }
    return { mrr, upcoming7 };
  }, [empresas]);

  const closeEditEmpresa = useCallback(() => {
    setEditEmpresa(null);
    setEditEmpresaInviteUrl('');
  }, []);
  const closeEditPlan = useCallback(() => setEditPlan(null), []);

  const empresaModalOpen = Boolean(editEmpresa || editPlan);
  useEffect(() => {
    if (!empresaModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeEditEmpresa();
        closeEditPlan();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [empresaModalOpen, closeEditEmpresa, closeEditPlan]);

  const saveEmpresaName = async () => {
    if (!editEmpresa?.name.trim()) return;
    setSaving(true);
    setListMessage(null);
    setEditEmpresaInviteUrl('');
    try {
      const res = await fetch('/api/control/empresas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editEmpresa.id,
          name: editEmpresa.name.trim(),
          masterName: editEmpresa.masterName.trim() || null,
          masterEmail: editEmpresa.masterEmail.trim().toLowerCase() || null,
          masterRole: editEmpresa.masterRole,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        masterInvite?: { inviteUrl?: string | null; emailSent?: boolean | null };
      };
      if (!res.ok) throw new Error(payload.error || 'Falha ao guardar.');
      if (payload.masterInvite?.inviteUrl) {
        setEditEmpresaInviteUrl(payload.masterInvite.inviteUrl);
        setListMessage({
          type: 'ok',
          text:
            payload.masterInvite.emailSent === false
              ? 'Empresa atualizada. Convite do master criado; o e-mail não foi enviado — use o link no modal.'
              : 'Empresa atualizada e convite do master enviado ou criado.',
        });
        setEditEmpresa((prev) =>
          prev ? { ...prev, masterName: '', masterEmail: '', masterRole: 'owner' } : null,
        );
      } else {
        setListMessage({ type: 'ok', text: 'Nome da empresa atualizado.' });
        closeEditEmpresa();
      }
      await mutate(apiUrl);
    } catch (err) {
      setListMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Falha ao guardar empresa.',
      });
    } finally {
      setSaving(false);
    }
  };

  const savePlanBilling = async () => {
    if (!editPlan) return;
    const priceRaw = editPlan.negotiatedPrice.trim().replace(/\./g, '').replace(',', '.');
    const priceFloat = editPlan.negotiatedPrice.trim() ? Number(priceRaw) : null;
    const negotiatedPriceCents =
      priceFloat != null && Number.isFinite(priceFloat) ? Math.round(priceFloat * 100) : null;
    const day = Number(editPlan.billingCycleDay);
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      setListMessage({ type: 'err', text: 'Dia de cobrança deve ser entre 1 e 31.' });
      return;
    }
    setSaving(true);
    setListMessage(null);
    try {
      const res = await fetch('/api/control/team-plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editPlan.teamPlanId,
          status: editPlan.status,
          negotiatedPriceCents,
          billingCycleDay: day,
          nextInvoiceDate: editPlan.nextInvoiceDate.trim() || null,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Falha ao guardar plano.');
      setListMessage({ type: 'ok', text: 'Faturamento do plano atualizado.' });
      closeEditPlan();
      await mutate(apiUrl);
    } catch (err) {
      setListMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Falha ao guardar plano.',
      });
    } finally {
      setSaving(false);
    }
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
              A carteira de empresas é apenas para o operador da plataforma.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <ModuleDashboardPageShell innerClassName="flex w-full flex-col gap-6">
      <ModuleHeader
        title="Empresas"
        description="Cadastre empresas, vincule planos e acompanhe contratos para controle de faturamento."
      />

      <ConfirmActionBanner
        open={pendente != null}
        title={pendente ? pendenteConfirmTitle(pendente) : 'Confirmar'}
        message={pendente ? pendenteConfirmMessage(pendente) : ''}
        confirmLabel={pendente ? pendenteConfirmLabel(pendente) : 'Confirmar'}
        cancelLabel="Cancelar"
        onCancel={() => setPendente(null)}
        onConfirm={() => void confirmarPendente()}
      />

      {listMessage ? (
        <p
          className={
            listMessage.type === 'ok'
              ? 'rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-100'
              : 'rounded-xl border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-100'
          }
        >
          {listMessage.text}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <BilltrakStatCard
              variant="emerald"
              icon={Building2}
              title="Empresas listadas"
              description="Carteira visível com o filtro atual (ou todas, sem filtro)"
              value={empresasLoading ? '…' : empresas.length}
              footnote="Times cadastrados no painel"
            />
            <BilltrakStatCard
              variant="indigo"
              icon={Link2}
              title="Planos vinculados"
              description="Somatório de vínculos empresa × plano na lista"
              value={empresasLoading ? '…' : totalPlanLinks}
              footnote="Contratos/planos por empresa"
            />
            <BilltrakStatCard
              variant="amber"
              icon={Package}
              title="Planos no catálogo"
              description="Planos disponíveis para novos vínculos"
              value={plans.length}
              footnote="Catálogo global de planos"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <BilltrakStatCard
              variant="rose"
              icon={Wallet}
              title="MRR estimado (contratos ATIVO)"
              description="Soma dos valores negociados dos vínculos em estado ATIVO"
              value={empresasLoading ? '…' : formatCurrency(billingPortfolio.mrr)}
              footnote="Valores registados no painel; não substitui contabilidade"
            />
            <BilltrakStatCard
              variant="indigo"
              icon={CalendarDays}
              title="Faturas nos próximos 7 dias"
              description="Vínculos ATIVO com data de próxima fatura dentro da janela"
              value={empresasLoading ? '…' : billingPortfolio.upcoming7}
              footnote="Contagem de planos com vencimento próximo"
            />
          </div>
        </div>
        <HelpPanel
          title="Operação comercial"
          description="Use o cadastro para abrir novas empresas com plano inicial e dados de cobrança. Depois, ajuste os vínculos de plano por empresa conforme renegociação contratual."
          tips={[
            '«Suspender contratos» coloca todos os planos ATIVO da empresa em PAUSADO; «Reativar» volta PAUSADO → ATIVO (não altera CANCELADO).',
            'Em cada plano, use «Editar faturamento» para valor, dia de cobrança, próxima fatura e estado do contrato.',
            '«Editar empresa» altera apenas o nome do time; bloqueio de utilizadores continua em Utilizadores.',
            'O convite do utilizador master fica no cartão «Cadastrar empresa», no bloco realçado «Utilizador master (opcional)» — ou convide mais tarde em /dashboard/usuarios.',
          ]}
        />
      </div>

      <Card className="atlas-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cadastrar empresa</CardTitle>
          <CardDescription>
            Dados da empresa e do primeiro contrato; mais abaixo, o bloco opcional para convidar o utilizador master
            (convite com papel <strong>owner</strong> ou <strong>admin</strong> no time da empresa).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Empresa e faturamento inicial
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Nome da empresa</label>
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ex.: Empresa Atlas Cliente"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Plano inicial</label>
                <Select value={createPlanId} onValueChange={setCreatePlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem plano inicial</SelectItem>
                    {planOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Status do contrato</label>
                <Select value={createStatus} onValueChange={setCreateStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="PAUSADO">Pausado</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Valor negociado (R$)
                </label>
                <Input
                  value={createNegotiatedPrice}
                  onChange={(e) => setCreateNegotiatedPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ex.: 299,90"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Dia de cobrança</label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={createBillingCycleDay}
                  onChange={(e) => setCreateBillingCycleDay(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Próxima fatura</label>
                <Input
                  type="date"
                  value={createNextInvoiceDate}
                  onChange={(e) => setCreateNextInvoiceDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div
            id="cadastro-utilizador-master"
            className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-4 dark:border-indigo-500/35 dark:bg-indigo-950/25"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Utilizador master (opcional)</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Se preencher <strong>nome e e-mail</strong>, o sistema cria o convite (e envia e-mail se estiver configurado).
              O master entra como primeiro contacto da empresa no Atlas. Pode deixar em branco e convidar depois em
              Utilizadores.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Nome do master</label>
                <Input
                  value={createMasterName}
                  onChange={(e) => setCreateMasterName(e.target.value)}
                  placeholder="Ex.: Maria Gestora"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">E-mail do master</label>
                <Input
                  type="email"
                  value={createMasterEmail}
                  onChange={(e) => setCreateMasterEmail(e.target.value)}
                  placeholder="master@empresa.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Função do master</label>
                <Select value={createMasterRole} onValueChange={setCreateMasterRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Proprietário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {createFeedback ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{createFeedback}</p>
          ) : null}
          {createInviteUrl ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-300">Link do convite master</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={createInviteUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={async () => {
                    await navigator.clipboard.writeText(createInviteUrl);
                  }}
                >
                  Copiar link
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-full"
              onClick={handleCreateEmpresa}
              disabled={saving || !createName.trim()}
            >
              {saving ? 'Salvando…' : 'Cadastrar empresa'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setCreateName('');
                setCreatePlanId('_none');
                setCreateStatus('ATIVO');
                setCreateBillingCycleDay('5');
                setCreateNegotiatedPrice('');
                setCreateNextInvoiceDate('');
                setCreateMasterName('');
                setCreateMasterEmail('');
                setCreateMasterRole('owner');
                setCreateFeedback('');
                setCreateInviteUrl('');
              }}
            >
              Limpar formulário
            </Button>
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <Card className="atlas-surface">
          <CardContent className="pt-6">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                handleFilter();
              }}
            >
              <div className="w-full sm:max-w-md">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Busca
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={filterDraft}
                    onChange={(e) => setFilterDraft(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-100"
                    placeholder="Buscar por empresa ou plano"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="rounded-full">
                  Filtrar
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={handleClearFilter}>
                  Limpar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {empresasLoading ? (
          <Card className="atlas-surface atlas-hover">
            <CardContent className="py-8 text-center text-slate-500">Carregando empresas…</CardContent>
          </Card>
        ) : null}

        {empresas.map((emp) => {
          const rollup = empresaBillingRollup(emp);
          const hasActive = emp.plans.some((p) => p.status === 'ATIVO');
          const hasPaused = emp.plans.some((p) => p.status === 'PAUSADO');
          return (
          <Card key={emp.id} className="atlas-surface atlas-hover">
            <CardHeader className="gap-2 pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    <Building2 className="h-4 w-4 text-indigo-500" aria-hidden />
                    {emp.name}
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {emp.plans.length} plano(s) contratado(s)
                    {emp.subscriptionStatus ? (
                      <span className="ml-2 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:text-slate-300">
                        Stripe: {emp.subscriptionStatus}
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">
                      MRR desta empresa: {formatCurrency(rollup.mrr)}
                    </span>
                    <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">
                      Próxima fatura (ATIVO): {formatDatePt(rollup.nextInvoice)}
                    </span>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={saving}
                      onClick={() => {
                        setEditPlan(null);
                        setEditEmpresaInviteUrl('');
                        setEditEmpresa({
                          id: emp.id,
                          name: emp.name,
                          masterName: '',
                          masterEmail: '',
                          masterRole: 'owner',
                        });
                      }}
                    >
                      Editar empresa
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full border-amber-300/80 text-amber-800 hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-100 dark:hover:bg-amber-950/40"
                      disabled={saving || !hasActive}
                      onClick={() =>
                        setPendente({
                          kind: 'billing',
                          teamId: emp.id,
                          empresaNome: emp.name,
                          action: 'suspend_all_active_plans',
                        })
                      }
                    >
                      Suspender contratos
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full border-emerald-300/80 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
                      disabled={saving || !hasPaused}
                      onClick={() =>
                        setPendente({
                          kind: 'billing',
                          teamId: emp.id,
                          empresaNome: emp.name,
                          action: 'resume_all_paused_plans',
                        })
                      }
                    >
                      Reativar contratos
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {emp.plans.length ? (
                <ul className="space-y-2">
                  {emp.plans.map((p) => (
                    <li
                      key={p.id}
                      className="atlas-item flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{p.planName}</span>
                          <span
                            className={
                              p.status === 'ATIVO'
                                ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200'
                                : p.status === 'PAUSADO'
                                  ? 'rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-200'
                                  : 'rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200'
                            }
                          >
                            {p.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Valor: {formatCurrency(p.negotiatedPriceCents)} · Dia cobrança:{' '}
                          {p.billingCycleDay ?? '—'} · Próxima fatura: {formatDatePt(p.nextInvoiceDate)}
                        </p>
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            disabled={saving}
                            onClick={() => {
                              setEditEmpresa(null);
                              setEditPlan({
                                teamPlanId: p.id,
                                empresaName: emp.name,
                                planName: p.planName,
                                status: p.status,
                                negotiatedPrice:
                                  p.negotiatedPriceCents != null
                                    ? (p.negotiatedPriceCents / 100).toLocaleString('pt-BR', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
                                    : '',
                                billingCycleDay: String(p.billingCycleDay ?? 5),
                                nextInvoiceDate: p.nextInvoiceDate?.slice(0, 10) ?? '',
                              });
                            }}
                          >
                            Editar faturamento
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:text-rose-700 dark:text-rose-300"
                            onClick={() =>
                              setPendente({
                                kind: 'remove_plan',
                                teamPlanId: p.id,
                                planoNome: p.planName,
                                empresaNome: emp.name,
                              })
                            }
                            disabled={saving}
                          >
                            Remover
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhum plano contratado.
                </p>
              )}

              {canManage && addingTo === emp.id ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecionar plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {planOptions
                        .filter((o) => !emp.plans.some((p) => p.planId === Number(o.value)))
                        .map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => handleAddPlan(emp.id)}
                    disabled={saving || !selectedPlanId}
                  >
                    {saving ? 'Salvando…' : 'Adicionar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddingTo(null);
                      setSelectedPlanId('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingTo(emp.id)}
                    disabled={saving}
                  >
                    + Adicionar plano
                  </Button>
                )
              )}
            </CardContent>
          </Card>
          );
        })}

        {!empresasLoading && empresas.length === 0 && (
          <Card className="atlas-surface atlas-hover">
            <CardContent className="py-8 text-center text-slate-500">
              Nenhuma empresa encontrada.
            </CardContent>
          </Card>
        )}
      </div>

      {editEmpresa && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[380] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="empresa-edit-modal-title"
              onClick={closeEditEmpresa}
            >
              <div
                className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-violet-200/80 bg-white p-5 shadow-xl dark:border-violet-900/50 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h3
                  id="empresa-edit-modal-title"
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                >
                  Editar empresa
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Nome do time e, no mesmo sítio do cadastro, convite opcional do utilizador master.
                </p>
                <div className="mt-4">
                  <Label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Nome da empresa
                  </Label>
                  <Input
                    value={editEmpresa.name}
                    onChange={(e) => setEditEmpresa({ ...editEmpresa, name: e.target.value })}
                    className={modalFieldClass}
                    disabled={saving}
                  />
                </div>

                <div className="mt-5 rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-4 dark:border-indigo-500/35 dark:bg-indigo-950/25">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    Utilizador master (opcional)
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Se preencher nome e e-mail, o sistema cria o convite (e envia e-mail se estiver configurado). O
                    master entra como contacto da empresa no Atlas. Pode deixar em branco e convidar depois em
                    Utilizadores.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Nome do master</Label>
                      <Input
                        value={editEmpresa.masterName}
                        onChange={(e) => setEditEmpresa({ ...editEmpresa, masterName: e.target.value })}
                        placeholder="Ex.: Maria Gestora"
                        className={modalFieldClass}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 dark:text-slate-300">E-mail do master</Label>
                      <Input
                        type="email"
                        value={editEmpresa.masterEmail}
                        onChange={(e) => setEditEmpresa({ ...editEmpresa, masterEmail: e.target.value })}
                        placeholder="master@empresa.com"
                        className={modalFieldClass}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Função do master</Label>
                      <Select
                        value={editEmpresa.masterRole}
                        onValueChange={(v) => setEditEmpresa({ ...editEmpresa, masterRole: v })}
                        disabled={saving}
                      >
                        <SelectTrigger className={modalFieldClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Proprietário</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {editEmpresaInviteUrl ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-300">Link do convite master</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input value={editEmpresaInviteUrl} readOnly className="font-mono text-xs" />
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={async () => {
                          await navigator.clipboard.writeText(editEmpresaInviteUrl);
                        }}
                      >
                        Copiar link
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" className="rounded-full" onClick={closeEditEmpresa}>
                    {ACTION_COPY.cancel}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={saving || !editEmpresa.name.trim()}
                    onClick={() => void saveEmpresaName()}
                  >
                    {saving ? ACTION_COPY.saving : ACTION_COPY.save}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {editPlan && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[380] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="empresa-plan-edit-modal-title"
              onClick={closeEditPlan}
            >
              <div
                className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-violet-200/80 bg-white p-5 shadow-xl dark:border-violet-900/50 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h3
                  id="empresa-plan-edit-modal-title"
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                >
                  Editar faturamento
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {editPlan.planName} · {editPlan.empresaName}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
                      Estado do contrato
                    </Label>
                    <Select
                      value={editPlan.status}
                      onValueChange={(v) => setEditPlan({ ...editPlan, status: v })}
                      disabled={saving}
                    >
                      <SelectTrigger className={`w-full ${modalFieldClass}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ATIVO">Ativo</SelectItem>
                        <SelectItem value="PAUSADO">Pausado</SelectItem>
                        <SelectItem value="CANCELADO">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
                      Valor negociado (R$)
                    </Label>
                    <Input
                      value={editPlan.negotiatedPrice}
                      onChange={(e) => setEditPlan({ ...editPlan, negotiatedPrice: e.target.value })}
                      inputMode="decimal"
                      placeholder="Ex.: 299,90"
                      className={modalFieldClass}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
                      Dia de cobrança
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={editPlan.billingCycleDay}
                      onChange={(e) => setEditPlan({ ...editPlan, billingCycleDay: e.target.value })}
                      className={modalFieldClass}
                      disabled={saving}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
                      Próxima fatura
                    </Label>
                    <Input
                      type="date"
                      value={editPlan.nextInvoiceDate}
                      onChange={(e) => setEditPlan({ ...editPlan, nextInvoiceDate: e.target.value })}
                      className={modalFieldClass}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" className="rounded-full" onClick={closeEditPlan}>
                    {ACTION_COPY.cancel}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={saving}
                    onClick={() => void savePlanBilling()}
                  >
                    {saving ? ACTION_COPY.saving : ACTION_COPY.save}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </ModuleDashboardPageShell>
  );
}
