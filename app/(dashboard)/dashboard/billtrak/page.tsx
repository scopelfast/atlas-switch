'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { Clock, Percent, TrendingDown, TrendingUp } from 'lucide-react';
import { BilltrakStatCard } from '@/components/billtrak/billtrak-stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleDashboardPageShell } from '@/components/ui/module-dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { hasPermission, isOwnerLike, type Role } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import { EntityEditDeleteActions } from '@/components/ui/entity-edit-delete-actions';
import { cn } from '@/lib/utils';

type ContaFinanceira = {
  id: number;
  name: string;
  type: string;
  balanceCents: number;
};

type CategoriaFinanceira = {
  id: number;
  name: string;
  type: string;
};

type Lancamento = {
  id: number;
  title: string;
  categoryId: number | null;
  projectId: number | null;
  status: 'PENDENTE' | 'PAGO' | 'RECEBIDO' | 'ATRASADO';
  amountCents: number;
  dueDate: string;
  paidAt?: string | null;
  recurring: boolean;
  recurrenceRule?: string | null;
  notes?: string | null;
};

type Transacao = {
  id: number;
  accountId: number | null;
  billId: number | null;
  type: 'DEBITO' | 'CREDITO';
  description: string;
  amountCents: number;
  occurredAt: string;
};

type ProjectusProject = {
  id: number;
  nome: string;
};

type BilltrakMetrics = {
  receitas: number;
  despesas: number;
  pendentes: number;
  margem: number;
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
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const formatCurrency = (value: number) => currencyFormatter.format(value / 100);

export default function BillTrakPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher, swrNoRetryOn403);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'billtrak.view');

  const { data: contas, isLoading: loadingContas, error: contasError } = useSWR<ContaFinanceira[]>(
    '/api/billtrak/accounts',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: categorias, error: categoriasError } = useSWR<CategoriaFinanceira[]>(
    '/api/billtrak/categories',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: lancamentos, isLoading: loadingLancamentos, error: lancamentosError } = useSWR<Lancamento[]>(
    '/api/billtrak/bills',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: transacoes, isLoading: loadingTransacoes, error: transacoesError } = useSWR<Transacao[]>(
    '/api/billtrak/transactions',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: metrics, error: metricsError } = useSWR<BilltrakMetrics>(
    '/api/billtrak/metrics',
    fetcher,
    swrNoRetryOn403,
  );
  const { data: projetos, error: projetosError } = useSWR<ProjectusProject[]>(
    '/api/projectus/projects',
    fetcher,
    swrNoRetryOn403,
  );
  const contasList = Array.isArray(contas) ? contas : [];
  const categoriasList = Array.isArray(categorias) ? categorias : [];
  const lancamentosList = Array.isArray(lancamentos) ? lancamentos : [];
  const transacoesList = Array.isArray(transacoes) ? transacoes : [];
  const projetosList = Array.isArray(projetos) ? projetos : [];
  const loadError =
    contasError || categoriasError || lancamentosError || transacoesError || metricsError || projetosError || null;
  const moduleBlocked = [contasError, lancamentosError, transacoesError, metricsError]
    .filter(Boolean)
    .some((err) => err?.message?.toLowerCase().includes('não está habilitado no plano ativo'));

  const [novaConta, setNovaConta] = useState({
    name: '',
    type: 'CORRENTE',
    balanceCents: 0,
  });
  const [contaEdicaoId, setContaEdicaoId] = useState<number | null>(null);
  const [contaFeedback, setContaFeedback] = useState<string>('');
  const [contaPendenteExclusao, setContaPendenteExclusao] = useState<ContaFinanceira | null>(null);
  const [lancamentoEdicaoId, setLancamentoEdicaoId] = useState<number | null>(null);
  const [lancamentoPendenteExclusao, setLancamentoPendenteExclusao] = useState<Lancamento | null>(null);
  const [transacaoEdicaoId, setTransacaoEdicaoId] = useState<number | null>(null);
  const [transacaoPendenteExclusao, setTransacaoPendenteExclusao] = useState<Transacao | null>(null);
  const [operacaoFeedback, setOperacaoFeedback] = useState('');
  const [novoLancamento, setNovoLancamento] = useState({
    title: '',
    categoryId: '',
    projectId: '',
    status: 'PENDENTE',
    amountCents: 0,
    dueDate: new Date().toISOString().slice(0, 10),
    paidAt: '',
    recurring: false,
    recurrenceRule: 'MONTHLY',
    notes: '',
  });
  const [novaTransacao, setNovaTransacao] = useState({
    accountId: '',
    billId: '',
    type: 'DEBITO',
    description: '',
    amountCents: 0,
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  const helpTips =
    isOwnerLike(role)
      ? [
          'Centralize custos por projeto para evitar desvios.',
          'Ative alertas de liquidez no fluxo de caixa.',
          'Registre receitas assim que forem confirmadas.',
        ]
      : [
          'Registre despesas assim que ocorrerem.',
          'Revise categorias para relatórios claros.',
          'Use lembretes de vencimento para evitar multas.',
        ];

  const statusLabel = (status: Lancamento['status']) => {
    switch (status) {
      case 'PAGO':
        return { label: 'Pago', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' };
      case 'RECEBIDO':
        return { label: 'Recebido', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-300' };
      case 'ATRASADO':
        return { label: 'Atrasado', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' };
      default:
        return { label: 'Pendente', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' };
    }
  };

  const accountTypeLabel = (type: string) => {
    switch (type) {
      case 'POUPANCA':
        return 'Poupança';
      case 'CAIXA':
        return 'Caixa';
      default:
        return 'Conta corrente';
    }
  };

  const categoriasMap = useMemo(() => {
    return new Map(categoriasList.map((categoria) => [categoria.id, categoria.name]));
  }, [categoriasList]);

  const projetosMap = useMemo(() => {
    return new Map(projetosList.map((projeto) => [projeto.id, projeto.nome]));
  }, [projetosList]);

  const handleCreateAccount = async () => {
    if (!novaConta.name.trim()) return;
    setContaFeedback('');
    const response = await fetch('/api/billtrak/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: novaConta.name,
        type: novaConta.type,
        balanceCents: Number(novaConta.balanceCents) || 0,
      }),
    });
    if (!response.ok) {
      setContaFeedback('Falha ao criar conta.');
      return;
    }
    setNovaConta({ name: '', type: 'CORRENTE', balanceCents: 0 });
    setContaFeedback('Conta criada com sucesso.');
    mutate('/api/billtrak/accounts');
  };

  const handleSaveAccount = async () => {
    if (!contaEdicaoId || !novaConta.name.trim()) return;
    setContaFeedback('');
    const response = await fetch('/api/billtrak/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: contaEdicaoId,
        name: novaConta.name,
        type: novaConta.type,
        balanceCents: Number(novaConta.balanceCents) || 0,
      }),
    });
    if (!response.ok) {
      setContaFeedback('Falha ao atualizar conta.');
      return;
    }
    setContaEdicaoId(null);
    setNovaConta({ name: '', type: 'CORRENTE', balanceCents: 0 });
    setContaFeedback('Conta atualizada com sucesso.');
    mutate('/api/billtrak/accounts');
  };

  const handleStartEditAccount = (conta: ContaFinanceira) => {
    setContaEdicaoId(conta.id);
    setNovaConta({
      name: conta.name,
      type: conta.type,
      balanceCents: conta.balanceCents,
    });
    setContaFeedback('');
  };

  const handleCancelEditAccount = () => {
    setContaEdicaoId(null);
    setNovaConta({ name: '', type: 'CORRENTE', balanceCents: 0 });
    setContaFeedback('');
  };

  const handleDeleteAccount = (conta: ContaFinanceira) => {
    setContaFeedback('');
    setContaPendenteExclusao(conta);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!contaPendenteExclusao) return;
    const response = await fetch(`/api/billtrak/accounts?id=${contaPendenteExclusao.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setContaFeedback(
        'Falha ao excluir conta. Verifique se existem transações vinculadas.',
      );
      return;
    }
    if (contaEdicaoId === contaPendenteExclusao.id) {
      handleCancelEditAccount();
    }
    setContaPendenteExclusao(null);
    setContaFeedback('Conta excluída com sucesso.');
    mutate('/api/billtrak/accounts');
  };

  const handleCreateBill = async () => {
    if (!novoLancamento.title.trim() || !novoLancamento.amountCents || !novoLancamento.dueDate) {
      return;
    }
    const response = await fetch('/api/billtrak/bills', {
      method: lancamentoEdicaoId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(lancamentoEdicaoId ? { id: lancamentoEdicaoId } : {}),
        title: novoLancamento.title,
        categoryId: novoLancamento.categoryId ? Number(novoLancamento.categoryId) : null,
        projectId: novoLancamento.projectId ? Number(novoLancamento.projectId) : null,
        status: novoLancamento.status,
        amountCents: Number(novoLancamento.amountCents),
        dueDate: novoLancamento.dueDate,
        paidAt: novoLancamento.paidAt || null,
        recurring: novoLancamento.recurring,
        recurrenceRule: novoLancamento.recurring ? novoLancamento.recurrenceRule : null,
        notes: novoLancamento.notes || null,
      }),
    });
    if (!response.ok) {
      setOperacaoFeedback('Falha ao salvar lançamento.');
      return;
    }
    setNovoLancamento({
      title: '',
      categoryId: '',
      projectId: '',
      status: 'PENDENTE',
      amountCents: 0,
      dueDate: new Date().toISOString().slice(0, 10),
      paidAt: '',
      recurring: false,
      recurrenceRule: 'MONTHLY',
      notes: '',
    });
    setLancamentoEdicaoId(null);
    setOperacaoFeedback(
      lancamentoEdicaoId ? 'Lançamento atualizado com sucesso.' : 'Lançamento criado com sucesso.',
    );
    mutate('/api/billtrak/bills');
    mutate('/api/billtrak/metrics');
  };

  const handleCreateTransaction = async () => {
    if (!novaTransacao.description.trim() || !novaTransacao.amountCents || !novaTransacao.occurredAt) {
      return;
    }
    const response = await fetch('/api/billtrak/transactions', {
      method: transacaoEdicaoId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(transacaoEdicaoId ? { id: transacaoEdicaoId } : {}),
        accountId: novaTransacao.accountId ? Number(novaTransacao.accountId) : null,
        billId: novaTransacao.billId ? Number(novaTransacao.billId) : null,
        type: novaTransacao.type,
        description: novaTransacao.description,
        amountCents: Number(novaTransacao.amountCents),
        occurredAt: novaTransacao.occurredAt,
      }),
    });
    if (!response.ok) {
      setOperacaoFeedback('Falha ao salvar transação.');
      return;
    }
    setNovaTransacao({
      accountId: '',
      billId: '',
      type: 'DEBITO',
      description: '',
      amountCents: 0,
      occurredAt: new Date().toISOString().slice(0, 10),
    });
    setTransacaoEdicaoId(null);
    setOperacaoFeedback(
      transacaoEdicaoId ? 'Transação atualizada com sucesso.' : 'Transação criada com sucesso.',
    );
    mutate('/api/billtrak/transactions');
  };

  const startEditBill = (item: Lancamento) => {
    setLancamentoEdicaoId(item.id);
    setNovoLancamento({
      title: item.title,
      categoryId: item.categoryId ? String(item.categoryId) : '',
      projectId: item.projectId ? String(item.projectId) : '',
      status: item.status,
      amountCents: item.amountCents,
      dueDate: item.dueDate,
      paidAt: item.paidAt || '',
      recurring: item.recurring,
      recurrenceRule: item.recurrenceRule || 'MONTHLY',
      notes: item.notes || '',
    });
    setOperacaoFeedback('');
  };

  const startEditTransaction = (item: Transacao) => {
    setTransacaoEdicaoId(item.id);
    setNovaTransacao({
      accountId: item.accountId ? String(item.accountId) : '',
      billId: item.billId ? String(item.billId) : '',
      type: item.type,
      description: item.description,
      amountCents: item.amountCents,
      occurredAt: item.occurredAt,
    });
    setOperacaoFeedback('');
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
              Você não tem permissão para acessar o BillTrak.
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
              title="BillTrak"
              description="O módulo está condicionado ao plano ativo do time. Quando habilitado, esta área libera lançamentos, transações e contas financeiras."
              className="w-full"
            />
          </div>
          <div className="flex items-start justify-end">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/manual/billtrak">Manual</Link>
            </Button>
          </div>
        </div>
        <Card className="mt-6 border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/10">
          <CardHeader>
            <CardTitle>Módulo indisponível para este plano</CardTitle>
            <CardDescription>{loadError?.message}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-900 dark:text-amber-100">
            O plano ativo do time não inclui BillTrak. Peça ao <strong>operador da instância</strong> (quem gere
            Empresas / Planos no Control Center) para associar um plano com este módulo — donos de time não alteram o
            catálogo de módulos do SaaS.
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
            title="BillTrak"
            description="Lançamentos (contas a pagar e receber), transações em contas e indicadores agregados por estado — alinhe ao Projectus quando associar custos a projetos."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/billtrak">Manual</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BilltrakStatCard
          variant="emerald"
          icon={TrendingUp}
          title="Receitas recebidas"
          description="Somatório de lançamentos com estado «Recebido»"
          value={formatCurrency(metrics?.receitas ?? 0)}
          footnote="Entradas confirmadas"
        />
        <BilltrakStatCard
          variant="rose"
          icon={TrendingDown}
          title="Despesas pagas"
          description="Somatório de lançamentos com estado «Pago»"
          value={formatCurrency(metrics?.despesas ?? 0)}
          footnote="Saídas já liquidadas"
        />
        <BilltrakStatCard
          variant="amber"
          icon={Clock}
          title="Pendências abertas"
          description="Somatório ainda em «Pendente»"
          value={formatCurrency(metrics?.pendentes ?? 0)}
          footnote="A reconciliar"
        />
        <BilltrakStatCard
          variant="indigo"
          icon={Percent}
          title="Margem indicativa"
          description="(Recebido − Pago) ÷ recebido, em %"
          value={
            (metrics?.receitas ?? 0) > 0 ? `${metrics?.margem ?? 0}%` : '—'
          }
          footnote={
            (metrics?.receitas ?? 0) > 0 ? 'Só com receitas na base' : 'Sem receitas para base'
          }
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
        <div className="flex flex-col gap-4">
          <ConfirmActionBanner
            open={Boolean(lancamentoPendenteExclusao)}
            title="Confirmar exclusão de lançamento"
            message={
              lancamentoPendenteExclusao
                ? `Excluir o lançamento "${lancamentoPendenteExclusao.title}"?`
                : ''
            }
            confirmLabel="Excluir lançamento"
            cancelLabel="Cancelar"
            onCancel={() => setLancamentoPendenteExclusao(null)}
            onConfirm={async () => {
              if (!lancamentoPendenteExclusao) return;
              const res = await fetch(`/api/billtrak/bills?id=${lancamentoPendenteExclusao.id}`, {
                method: 'DELETE',
              });
              if (!res.ok) {
                setOperacaoFeedback('Falha ao excluir lançamento.');
                return;
              }
              if (lancamentoEdicaoId === lancamentoPendenteExclusao.id) {
                setLancamentoEdicaoId(null);
              }
              setLancamentoPendenteExclusao(null);
              setOperacaoFeedback('Lançamento excluído com sucesso.');
              await mutate('/api/billtrak/bills');
              await mutate('/api/billtrak/metrics');
            }}
          />
          <ConfirmActionBanner
            open={Boolean(transacaoPendenteExclusao)}
            title="Confirmar exclusão de transação"
            message={
              transacaoPendenteExclusao
                ? `Excluir a transação "${transacaoPendenteExclusao.description}"?`
                : ''
            }
            confirmLabel="Excluir transação"
            cancelLabel="Cancelar"
            onCancel={() => setTransacaoPendenteExclusao(null)}
            onConfirm={async () => {
              if (!transacaoPendenteExclusao) return;
              const res = await fetch(
                `/api/billtrak/transactions?id=${transacaoPendenteExclusao.id}`,
                { method: 'DELETE' },
              );
              if (!res.ok) {
                setOperacaoFeedback('Falha ao excluir transação.');
                return;
              }
              if (transacaoEdicaoId === transacaoPendenteExclusao.id) {
                setTransacaoEdicaoId(null);
              }
              setTransacaoPendenteExclusao(null);
              setOperacaoFeedback('Transação excluída com sucesso.');
              await mutate('/api/billtrak/transactions');
            }}
          />
          {operacaoFeedback ? (
            <p className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
              {operacaoFeedback}
            </p>
          ) : null}
          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Contas a pagar e receber</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loadingLancamentos ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Carregando lançamentos...
                </div>
              ) : lancamentosList.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhum lançamento encontrado
                </div>
              ) : (
                lancamentosList.map((item) => {
                  const status = statusLabel(item.status);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'atlas-item flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
                        lancamentoEdicaoId === item.id
                          ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                          : '',
                      )}
                    >
                      <div>
                        <p className="atlas-item-meta">
                          {categoriasMap.get(item.categoryId || 0) || 'Sem categoria'}{' '}
                          {item.projectId ? `• ${projetosMap.get(item.projectId) || 'Projeto'}` : ''}
                        </p>
                        <p className="atlas-item-title">{item.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Vencimento: {item.dueDate}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className={`atlas-badge ${status.className}`}>{status.label}</span>
                        {lancamentoEdicaoId === item.id ? (
                          <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                            Em edição
                          </span>
                        ) : null}
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.amountCents)}
                        </span>
                        <EntityEditDeleteActions
                          onEdit={() => startEditBill(item)}
                          onDelete={() => setLancamentoPendenteExclusao(item)}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Transações recentes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loadingTransacoes ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Carregando transações...
                </div>
              ) : transacoesList.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhuma transação registrada
                </div>
              ) : (
                transacoesList.map((transacao) => (
                  <div
                    key={transacao.id}
                    className={cn(
                      'atlas-item flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
                      transacaoEdicaoId === transacao.id
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                        : '',
                    )}
                  >
                    <div>
                      <p className="atlas-item-title">{transacao.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {transacao.type === 'CREDITO' ? 'Crédito' : 'Débito'} • {transacao.occurredAt}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(transacao.amountCents)}
                    </span>
                    {transacaoEdicaoId === transacao.id ? (
                      <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                        Em edição
                      </span>
                    ) : null}
                    <EntityEditDeleteActions
                      onEdit={() => startEditTransaction(transacao)}
                      onDelete={() => setTransacaoPendenteExclusao(transacao)}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Contas financeiras</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loadingContas ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Carregando contas...
                </div>
              ) : contasList.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhuma conta registrada
                </div>
              ) : (
                contasList.map((conta) => (
                  <div
                    key={conta.id}
                    className={cn(
                      'atlas-item flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
                      contaEdicaoId === conta.id
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                        : '',
                    )}
                  >
                    <div>
                      <p className="atlas-item-title">{conta.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {accountTypeLabel(conta.type)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(conta.balanceCents)}
                    </span>
                    {contaEdicaoId === conta.id ? (
                      <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                        Em edição
                      </span>
                    ) : null}
                    <EntityEditDeleteActions
                      onEdit={() => handleStartEditAccount(conta)}
                      onDelete={() => handleDeleteAccount(conta)}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card
            className={cn(
              'atlas-surface atlas-hover',
              contaEdicaoId ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
            )}
          >
            <CardHeader className="gap-1">
              <CardTitle>Como ler os indicadores</CardTitle>
              <CardDescription>Os quatro cartões acima repetem estes critérios da API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <p>
                <strong>Receitas</strong> — soma dos valores em que o estado do lançamento é «Recebido».
              </p>
              <p>
                <strong>Despesas</strong> — soma com estado «Pago».
              </p>
              <p>
                <strong>Pendências</strong> — soma com estado «Pendente» (não inclui «Atrasado» neste agregado).
              </p>
              <p>
                <strong>Margem</strong> — percentagem calculada só quando há receitas recebidas; caso contrário
                mostra «—».
              </p>
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>
                {contaEdicaoId ? 'Editar conta financeira' : 'Nova conta financeira'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              <ConfirmActionBanner
                open={Boolean(contaPendenteExclusao)}
                title="Confirmar exclusão de conta"
                message={
                  contaPendenteExclusao
                    ? `Excluir a conta "${contaPendenteExclusao.name}"? Esta ação não pode ser desfeita.`
                    : ''
                }
                confirmLabel="Excluir conta"
                cancelLabel="Cancelar"
                onCancel={() => setContaPendenteExclusao(null)}
                onConfirm={handleConfirmDeleteAccount}
              />
              {contaFeedback ? (
                <p
                  className={`rounded-md border px-3 py-2 text-xs ${
                    contaFeedback.startsWith('Falha')
                      ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100'
                  }`}
                >
                  {contaFeedback}
                </p>
              ) : null}
              {contaEdicaoId ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Modo de edição ativo. Revise os campos e salve as alterações.
                </p>
              ) : null}
              <Input
                placeholder="Nome da conta"
                value={novaConta.name}
                onChange={(event) => setNovaConta((prev) => ({ ...prev, name: event.target.value }))}
              />
              <Select
                value={novaConta.type}
                onValueChange={(v) => setNovaConta((prev) => ({ ...prev, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CORRENTE">Conta corrente</SelectItem>
                  <SelectItem value="POUPANCA">Poupança</SelectItem>
                  <SelectItem value="CAIXA">Caixa</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Saldo em centavos"
                value={novaConta.balanceCents}
                onChange={(event) =>
                  setNovaConta((prev) => ({
                    ...prev,
                    balanceCents: Number(event.target.value),
                  }))
                }
              />
              <div className="flex gap-2">
                <Button
                  onClick={contaEdicaoId ? handleSaveAccount : handleCreateAccount}
                  disabled={!novaConta.name.trim()}
                >
                  {contaEdicaoId ? 'Salvar conta' : 'Criar conta'}
                </Button>
                {contaEdicaoId ? (
                  <Button type="button" variant="outline" onClick={handleCancelEditAccount}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'atlas-surface atlas-hover',
              lancamentoEdicaoId
                ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10'
                : '',
            )}
          >
            <CardHeader>
              <CardTitle>{lancamentoEdicaoId ? 'Editar lançamento' : 'Novo lançamento'}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              {lancamentoEdicaoId ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Modo de edição ativo. Revise os campos e salve as alterações.
                </p>
              ) : null}
              <Input
                placeholder="Título"
                value={novoLancamento.title}
                onChange={(event) =>
                  setNovoLancamento((prev) => ({ ...prev, title: event.target.value }))
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="number"
                  placeholder="Valor em centavos"
                  value={novoLancamento.amountCents}
                  onChange={(event) =>
                    setNovoLancamento((prev) => ({
                      ...prev,
                      amountCents: Number(event.target.value),
                    }))
                  }
                />
                <Input
                  type="date"
                  value={novoLancamento.dueDate}
                  onChange={(event) =>
                    setNovoLancamento((prev) => ({ ...prev, dueDate: event.target.value }))
                  }
                />
              </div>
              <Select
                value={novoLancamento.status}
                onValueChange={(v) =>
                  setNovoLancamento((prev) => ({ ...prev, status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="RECEBIDO">Recebido</SelectItem>
                  <SelectItem value="ATRASADO">Atrasado</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={novoLancamento.categoryId || '_none'}
                onValueChange={(v) =>
                  setNovoLancamento((prev) => ({
                    ...prev,
                    categoryId: v === '_none' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Categoria</SelectItem>
                  {categoriasList.map((categoria) => (
                    <SelectItem key={categoria.id} value={String(categoria.id)}>
                      {categoria.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={novoLancamento.projectId || '_none'}
                onValueChange={(v) =>
                  setNovoLancamento((prev) => ({
                    ...prev,
                    projectId: v === '_none' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Projeto (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Projeto (opcional)</SelectItem>
                  {projetosList.map((projeto) => (
                    <SelectItem key={projeto.id} value={String(projeto.id)}>
                      {projeto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={novoLancamento.recurring}
                  onChange={(event) =>
                    setNovoLancamento((prev) => ({ ...prev, recurring: event.target.checked }))
                  }
                />
                <span>Repetir automaticamente</span>
              </div>
              {novoLancamento.recurring ? (
                <Select
                  value={novoLancamento.recurrenceRule}
                  onValueChange={(v) =>
                    setNovoLancamento((prev) => ({
                      ...prev,
                      recurrenceRule: v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Recorrência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                    <SelectItem value="YEARLY">Anual</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              <Input
                placeholder="Observações"
                value={novoLancamento.notes}
                onChange={(event) =>
                  setNovoLancamento((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
              <Button
                onClick={handleCreateBill}
                disabled={!novoLancamento.title.trim() || !novoLancamento.amountCents}
              >
                {lancamentoEdicaoId ? 'Salvar alterações' : 'Salvar lançamento'}
              </Button>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'atlas-surface atlas-hover',
              transacaoEdicaoId
                ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10'
                : '',
            )}
          >
            <CardHeader>
              <CardTitle>{transacaoEdicaoId ? 'Editar transação' : 'Registrar transação'}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              {transacaoEdicaoId ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Modo de edição ativo. Revise os campos e salve as alterações.
                </p>
              ) : null}
              <Input
                placeholder="Descrição"
                value={novaTransacao.description}
                onChange={(event) =>
                  setNovaTransacao((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="number"
                  placeholder="Valor em centavos"
                  value={novaTransacao.amountCents}
                  onChange={(event) =>
                    setNovaTransacao((prev) => ({
                      ...prev,
                      amountCents: Number(event.target.value),
                    }))
                  }
                />
                <Input
                  type="date"
                  value={novaTransacao.occurredAt}
                  onChange={(event) =>
                    setNovaTransacao((prev) => ({ ...prev, occurredAt: event.target.value }))
                  }
                />
              </div>
              <Select
                value={novaTransacao.type}
                onValueChange={(v) =>
                  setNovaTransacao((prev) => ({ ...prev, type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBITO">Débito</SelectItem>
                  <SelectItem value="CREDITO">Crédito</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={novaTransacao.accountId || '_none'}
                onValueChange={(v) =>
                  setNovaTransacao((prev) => ({
                    ...prev,
                    accountId: v === '_none' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Conta (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Conta (opcional)</SelectItem>
                  {contasList.map((conta) => (
                    <SelectItem key={conta.id} value={String(conta.id)}>
                      {conta.name} • {formatCurrency(conta.balanceCents)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={novaTransacao.billId || '_none'}
                onValueChange={(v) =>
                  setNovaTransacao((prev) => ({
                    ...prev,
                    billId: v === '_none' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular lançamento (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Vincular lançamento (opcional)</SelectItem>
                  {lancamentosList.map((bill) => (
                    <SelectItem key={bill.id} value={String(bill.id)}>
                      {bill.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleCreateTransaction}
                disabled={!novaTransacao.description.trim() || !novaTransacao.amountCents}
              >
                {transacaoEdicaoId ? 'Salvar transação' : 'Registrar transação'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Use o BillTrak para manter o financeiro em dia."
          tips={helpTips}
        />
      </div>
    </ModuleDashboardPageShell>
  );
}
