'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EntityEditDeleteActions } from '@/components/ui/entity-edit-delete-actions';
import { Input } from '@/components/ui/input';
import { interventionPanelErrorFeedbackFromApiJson } from '@/lib/taskflow/intervention-errors';
import {
  datetimeLocalFromIso,
  formatDateTimePtShort,
  isoFromDateTimeLocal,
} from '@/lib/taskflow/task-schedule';
import { useFloatingFeedback } from '@/components/ui/floating-feedback';
import { ACTION_COPY } from '@/lib/ui/action-copy';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type HistoryRow = {
  id: number;
  taskId: number;
  taskTitle: string;
  startedAt: string;
  endedAt: string | null;
  source: string;
  reportedStatus: string | null;
  details: string | null;
  userId: number;
  userName: string | null;
};

async function fetchHistoryJson(url: string): Promise<{ items: HistoryRow[] }> {
  const res = await fetch(url);
  const j = (await res.json()) as { items?: HistoryRow[]; error?: string };
  if (!res.ok) {
    throw new Error(typeof j.error === 'string' ? j.error : 'Erro ao carregar histórico');
  }
  return { items: Array.isArray(j.items) ? j.items : [] };
}

type ActivePayload = {
  active: {
    id: number;
    taskId: number;
    startedAt: string;
    taskTitle: string;
    /** M7.3 */
    idlePromptOpen?: boolean;
    idleResponseDeadlineAt?: string | null;
  } | null;
};

type Props = {
  taskOptions: { id: number; title: string }[];
  /** M7.4 — estados do quadro não terminais; opcional ao encerrar timer ou registo manual. */
  statusSyncOptions?: { id: number; name: string }[];
  viewerUserId: number;
  /** Quando definido, mostra no histórico só apontamentos desse utilizador. */
  historyUserIdFilter?: number | null;
  /** Permite ver todo o time no histórico e editar/apagar linhas de outros (alinhado a `canConfigureTaskflowBoard`). */
  canManageTeamInterventions: boolean;
};

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function TaskflowInterventionPanel({
  taskOptions,
  statusSyncOptions = [],
  viewerUserId,
  historyUserIdFilter = null,
  canManageTeamInterventions,
}: Props) {
  const flash = useFloatingFeedback();
  const historyKey = '/api/taskflow/interventions/history?limit=40';
  const { data, error, isLoading, mutate } = useSWR<ActivePayload>(
    '/api/taskflow/interventions/active',
    fetcher,
    {
      /** M7.3 — revalidar para abrir janela de 15 min e aplicar pausa automática no servidor. */
      refreshInterval: (latest) => (latest?.active ? 20000 : 0),
    },
  );
  const {
    data: historyData,
    error: historyError,
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useSWR(historyKey, fetchHistoryJson, { revalidateOnFocus: true });
  const active = data?.active ?? null;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const elapsedLabel = useMemo(() => {
    if (!active) return '';
    const start = new Date(active.startedAt).getTime();
    return formatElapsed(Date.now() - start);
  }, [active, tick]);

  const idleCountdownLabel = useMemo(() => {
    if (!active?.idlePromptOpen || !active.idleResponseDeadlineAt) return '';
    const end = new Date(active.idleResponseDeadlineAt).getTime();
    const sec = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [active, tick]);

  const [taskPick, setTaskPick] = useState<string>('_none');
  const [reportedStatus, setReportedStatus] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const [manualStartLocal, setManualStartLocal] = useState('');
  const [manualEndLocal, setManualEndLocal] = useState('');
  const [manualStatus, setManualStatus] = useState('');
  const [manualDetails, setManualDetails] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [timerSyncStatus, setTimerSyncStatus] = useState('_none');
  const [manualSyncStatus, setManualSyncStatus] = useState('_none');
  const [manualModalOpen, setManualModalOpen] = useState(false);
  /** Erros do registo manual mostrados no próprio modal (o toast global pode ficar atrás do overlay). */
  const [manualModalError, setManualModalError] = useState<string | null>(null);

  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [rowBusy, setRowBusy] = useState<number | null>(null);

  const statusById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of statusSyncOptions) {
      m.set(s.id, s.name);
    }
    return m;
  }, [statusSyncOptions]);

  const pickedTaskMeta = useMemo(() => {
    if (taskPick === '_none') return null;
    const id = Number(taskPick);
    if (!Number.isFinite(id) || id < 1) return null;
    const row = taskOptions.find((t) => t.id === id);
    const title = row?.title ?? `Tarefa #${id}`;
    return { id, title: title.length > 90 ? `${title.slice(0, 90)}…` : title };
  }, [taskPick, taskOptions]);

  const start = useCallback(async () => {
    const taskId = Number(taskPick);
    if (!taskId) {
      flash.showError('Escolha uma tarefa.');
      return;
    }
    setBusy(true);
    flash.dismiss();
    try {
      const res = await fetch('/api/taskflow/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fb = interventionPanelErrorFeedbackFromApiJson(j);
        flash.showError(fb.message, fb.title);
        return;
      }
      setTaskPick('_none');
      await mutate();
    } finally {
      setBusy(false);
    }
  }, [taskPick, mutate, flash]);

  const stop = useCallback(async () => {
    if (!active) return;
    if (!reportedStatus.trim()) {
      flash.showError('Preencha o status ao encerrar.');
      return;
    }
    setBusy(true);
    flash.dismiss();
    try {
      const syncId = timerSyncStatus !== '_none' ? Number(timerSyncStatus) : undefined;
      const res = await fetch(`/api/taskflow/interventions/${active.id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedStatus: reportedStatus.trim(),
          details: details.trim() || null,
          ...(syncId && Number.isFinite(syncId) ? { syncTaskStatusId: syncId } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fb = interventionPanelErrorFeedbackFromApiJson(j);
        flash.showError(fb.message, fb.title);
        return;
      }
      setReportedStatus('');
      setDetails('');
      setTimerSyncStatus('_none');
      await mutate();
      await mutateHistory();
    } finally {
      setBusy(false);
    }
  }, [active, reportedStatus, details, timerSyncStatus, mutate, mutateHistory, flash]);

  const ackIdle = useCallback(
    async (response: 'yes' | 'no') => {
      if (!active) return;
      setBusy(true);
      flash.dismiss();
      try {
        const res = await fetch(`/api/taskflow/interventions/${active.id}/idle-ack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          const fb = interventionPanelErrorFeedbackFromApiJson(j);
          flash.showError(fb.message, fb.title);
          return;
        }
        if (response === 'no') {
          setReportedStatus('');
          setDetails('');
          setTimerSyncStatus('_none');
          flash.showSuccess('Intervenção encerrada (respondeu «Não» ao ping de inatividade).');
        } else {
          flash.showSuccess('Presença confirmada. Próximo ping daqui a 2 horas de trabalho no timer.');
        }
        await mutate();
        await mutateHistory();
      } finally {
        setBusy(false);
      }
    },
    [active, mutate, mutateHistory, flash],
  );

  const submitManual = useCallback(async () => {
    setManualModalError(null);
    const taskId = Number(taskPick);
    if (!taskId) {
      setManualModalError('Escolha uma tarefa (no painel ou no primeiro campo do modal).');
      return;
    }
    const startedAt = isoFromDateTimeLocal(manualStartLocal);
    const endedAt = isoFromDateTimeLocal(manualEndLocal);
    if (!startedAt || !endedAt) {
      setManualModalError('Preencha início e fim com data e hora.');
      return;
    }
    if (!manualStatus.trim()) {
      setManualModalError('Indique o que fez neste período (campo obrigatório).');
      return;
    }
    setManualBusy(true);
    flash.dismiss();
    try {
      const syncId = manualSyncStatus !== '_none' ? Number(manualSyncStatus) : undefined;
      const res = await fetch('/api/taskflow/interventions/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          startedAt,
          endedAt,
          reportedStatus: manualStatus.trim(),
          details: manualDetails.trim() || null,
          ...(syncId && Number.isFinite(syncId) ? { syncTaskStatusId: syncId } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fb = interventionPanelErrorFeedbackFromApiJson(j);
        setManualModalError(fb.message);
        return;
      }
      setManualStartLocal('');
      setManualEndLocal('');
      setManualStatus('');
      setManualDetails('');
      setManualSyncStatus('_none');
      setManualModalError(null);
      flash.showSuccess('Intervenção manual registada.');
      await mutateHistory();
      setManualModalOpen(false);
    } finally {
      setManualBusy(false);
    }
  }, [
    taskPick,
    manualStartLocal,
    manualEndLocal,
    manualStatus,
    manualDetails,
    manualSyncStatus,
    mutateHistory,
    flash,
  ]);

  const resetManualDraft = useCallback(() => {
    setManualStartLocal('');
    setManualEndLocal('');
    setManualStatus('');
    setManualDetails('');
    setManualSyncStatus('_none');
    setManualModalError(null);
  }, []);

  const openManualModal = useCallback(() => {
    resetManualDraft();
    setManualModalOpen(true);
  }, [resetManualDraft]);

  const closeManualModal = useCallback(() => {
    setManualModalOpen(false);
    resetManualDraft();
  }, [resetManualDraft]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!manualModalOpen && editRowId == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [manualModalOpen, editRowId]);

  useEffect(() => {
    if (!manualModalOpen) return;
    setManualModalError(null);
  }, [manualModalOpen, manualStartLocal, manualEndLocal, manualStatus, manualDetails, manualSyncStatus, taskPick]);

  const canActOnRow = useCallback(
    (row: HistoryRow) =>
      Boolean(row.endedAt) &&
      (row.userId === viewerUserId || canManageTeamInterventions),
    [viewerUserId, canManageTeamInterventions],
  );

  const openEdit = useCallback((row: HistoryRow) => {
    if (!row.endedAt) return;
    setEditRowId(row.id);
    setEditStart(datetimeLocalFromIso(row.startedAt));
    setEditEnd(datetimeLocalFromIso(row.endedAt));
    setEditStatus(String(row.reportedStatus ?? '').trim());
    setEditDetails(row.details ?? '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditRowId(null);
    setEditStart('');
    setEditEnd('');
    setEditStatus('');
    setEditDetails('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editRowId) return;
    const startedAt = isoFromDateTimeLocal(editStart);
    const endedAt = isoFromDateTimeLocal(editEnd);
    if (!startedAt || !endedAt) {
      flash.showError('Correção: preencha início e fim (data e hora).');
      return;
    }
    if (!editStatus.trim()) {
      flash.showError('Correção: o texto de status não pode ficar vazio.');
      return;
    }
    setRowBusy(editRowId);
    flash.dismiss();
    try {
      const res = await fetch(`/api/taskflow/interventions/${editRowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startedAt,
          endedAt,
          reportedStatus: editStatus.trim(),
          details: editDetails.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fb = interventionPanelErrorFeedbackFromApiJson(j);
        flash.showError(fb.message, fb.title);
        return;
      }
      cancelEdit();
      flash.showSuccess('Intervenção actualizada.');
      await mutateHistory();
    } finally {
      setRowBusy(null);
    }
  }, [editRowId, editStart, editEnd, editStatus, editDetails, cancelEdit, mutateHistory, flash]);

  const removeRow = useCallback(
    async (id: number) => {
      if (
        !window.confirm(
          'Excluir este registo de intervenção? As horas deixam de contar para relatórios; a acção fica registada em atividades.',
        )
      ) {
        return;
      }
      setRowBusy(id);
      flash.dismiss();
      try {
        const res = await fetch(`/api/taskflow/interventions/${id}`, { method: 'DELETE' });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          const fb = interventionPanelErrorFeedbackFromApiJson(j);
          flash.showError(fb.message, fb.title);
          return;
        }
        if (editRowId === id) cancelEdit();
        flash.showSuccess('Intervenção excluída.');
        await mutateHistory();
      } finally {
        setRowBusy(null);
      }
    },
    [editRowId, cancelEdit, mutateHistory, flash],
  );

  const historyItems = historyData?.items ?? [];
  const editingRow = useMemo(
    () => historyItems.find((row) => row.id === editRowId) ?? null,
    [historyItems, editRowId],
  );
  const visibleHistoryItems = useMemo(
    () =>
      historyUserIdFilter != null
        ? historyItems.filter((row) => row.userId === historyUserIdFilter)
        : historyItems,
    [historyItems, historyUserIdFilter],
  );

  return (
    <>
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">Não foi possível carregar o estado do timer.</p>
      ) : null}

    <Card className="atlas-surface border-violet-200/60 dark:border-violet-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Timer e registo manual</CardTitle>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Escolha a tarefa uma vez. <span className="font-medium text-slate-700 dark:text-slate-200">Iniciar timer</span>{' '}
          marca trabalho <span className="italic">agora</span>;{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">Registo manual</span> abre um modal para
          intervalos já decorridos. Só uma sessão de timer ativa por utilizador; ao fim de 2 h há um ping de presença
          (15 min para responder).
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && !data ? (
          <p className="text-xs text-slate-500">A carregar…</p>
        ) : active ? (
          <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3 dark:border-violet-900/30 dark:bg-violet-950/20">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{active.taskTitle}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Em curso · tempo decorrido: <span className="font-mono">{elapsedLabel}</span>
              </p>
            </div>
            {active.idlePromptOpen ? (
              <div className="rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-3 dark:border-amber-600/40 dark:bg-amber-950/30">
                <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                  Ainda está a trabalhar nesta intervenção?
                </p>
                <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                  Tempo restante para responder:{' '}
                  <span className="font-mono font-semibold">{idleCountdownLabel || '—'}</span>
                  . «Sim» confirma presença e agenda o próximo ping daqui a 2 horas. «Não» encerra o timer.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={busy}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => void ackIdle('yes')}
                  >
                    Sim, continuo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="border-amber-400 text-amber-950 dark:text-amber-100"
                    onClick={() => void ackIdle('no')}
                  >
                    Não
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Status ao encerrar <span className="text-rose-500">*</span>
              </label>
              <Input
                value={reportedStatus}
                onChange={(e) => setReportedStatus(e.target.value)}
                placeholder="Ex.: Em progresso, Aguardando cliente, Bloqueado…"
                className="h-9 rounded-lg text-sm"
              />
            </div>
            {statusSyncOptions.length > 0 ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Estado no quadro (opcional)
                </label>
                <Select
                  value={timerSyncStatus}
                  onValueChange={(v) => {
                    setTimerSyncStatus(v);
                    if (v !== '_none') {
                      const name = statusById.get(Number(v));
                      if (name) {
                        setReportedStatus(name);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="h-9 rounded-lg">
                    <SelectValue placeholder="Não alterar o quadro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Não sincronizar</SelectItem>
                    {statusSyncOptions.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Concluído e cancelado só no Kanban — não disponíveis aqui.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Detalhes</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Notas sobre o que foi feito neste período…"
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
              />
            </div>
            <Button type="button" size="sm" disabled={busy} onClick={() => void stop()}>
              Encerrar intervenção
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <label htmlFor="tf-intervention-task-pick" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Tarefa
                </label>
                <Select value={taskPick} onValueChange={setTaskPick}>
                  <SelectTrigger id="tf-intervention-task-pick" className="h-9 rounded-lg">
                    <SelectValue placeholder="Escolher tarefa…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {taskOptions.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.title.length > 80 ? `${t.title.slice(0, 80)}…` : t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-slate-300/90 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  disabled={busy || taskPick === '_none'}
                  onClick={() => void start()}
                >
                  Iniciar timer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-slate-300/90 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  onClick={openManualModal}
                >
                  Registo manual…
                </Button>
              </div>
            </div>
            <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Se escolher a tarefa aqui, o modal de registo manual não volta a pedir a tarefa. Sem escolha, o modal pede
              a tarefa no primeiro passo.
            </p>
          </div>
        )}
      </CardContent>
    </Card>

    <Card className="atlas-surface border-emerald-200/50 dark:border-emerald-900/35">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Histórico recente</CardTitle>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {canManageTeamInterventions
            ? 'Lista as últimas intervenções do time. Pode corrigir ou excluir qualquer linha já fechada.'
            : 'Lista as suas últimas intervenções. Pode corrigir ou excluir as suas linhas já fechadas.'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          O servidor impede intervalos sobrepostos para o mesmo utilizador (e cruze com um timer em curso). Sessões de
          timer ainda abertas só se encerram pelo painel do timer.
        </p>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Nota:</span> cada linha é um{' '}
          <span className="font-medium">apontamento de tempo</span> (quem registrou a intervenção), não a lista de
          tarefas por responsável no quadro. Criar ou atribuir uma tarefa a outra pessoa não gera entrada aqui até alguém
          registar timer ou intervenção manual nessa tarefa.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {historyError ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {historyError instanceof Error ? historyError.message : 'Não foi possível carregar o histórico.'}
          </p>
        ) : null}
        {historyLoading && !historyData ? (
          <p className="text-xs text-slate-500">A carregar histórico…</p>
        ) : visibleHistoryItems.length === 0 ? (
          <p className="text-xs text-slate-500">
            {historyUserIdFilter != null
              ? 'Sem intervenções para o responsável selecionado.'
              : 'Ainda não há intervenções para mostrar.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleHistoryItems.map((row) => {
              const sourceLabel =
                row.source === 'TIMER' ? 'Timer' : row.source === 'MANUAL' ? 'Manual' : row.source;
              const acting = canActOnRow(row);
              const isEditing = editRowId === row.id;
              return (
                <li
                  key={row.id}
                  className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-3 dark:border-slate-700/80 dark:bg-slate-950/25"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{row.taskTitle}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {formatDateTimePtShort(row.startedAt)} →{' '}
                        {row.endedAt ? formatDateTimePtShort(row.endedAt) : 'em curso'} · {sourceLabel}
                        {canManageTeamInterventions ? (
                          <>
                            {' '}
                            ·{' '}
                            <span className="text-slate-500">{row.userName || `Utilizador #${row.userId}`}</span>
                          </>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">Status:</span> {row.reportedStatus || '—'}
                      </p>
                      {row.details ? (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold">Detalhes:</span> {row.details}
                        </p>
                      ) : null}
                    </div>
                    {acting ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <EntityEditDeleteActions
                          disabled={rowBusy != null}
                          onEdit={() => openEdit(row)}
                          onDelete={() => void removeRow(row.id)}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>

    {editRowId != null && editingRow && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[380] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="taskflow-intervention-edit-modal-title"
            onClick={cancelEdit}
          >
            <div
              className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-violet-200/80 bg-white p-5 shadow-xl dark:border-violet-900/50 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3
                    id="taskflow-intervention-edit-modal-title"
                    className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Corrigir intervenção
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{editingRow.taskTitle}</p>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-200/80 pt-3 dark:border-slate-700/60">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Início</span>
                    <Input
                      type="datetime-local"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      className="h-10 rounded-2xl border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Fim</span>
                    <Input
                      type="datetime-local"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      className="h-10 rounded-2xl border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Status / trabalho realizado <span className="text-rose-500">*</span>
                  </span>
                  <Input
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="h-10 rounded-2xl border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Detalhes</span>
                  <textarea
                    value={editDetails}
                    onChange={(e) => setEditDetails(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  />
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={rowBusy != null}
                    onClick={cancelEdit}
                  >
                    {ACTION_COPY.cancel}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={rowBusy != null}
                    onClick={() => void saveEdit()}
                  >
                    {rowBusy === editRowId ? ACTION_COPY.saving : ACTION_COPY.save}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null}

    {manualModalOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[380] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="taskflow-intervention-manual-modal-title"
            onClick={() => {
              if (manualBusy) return;
              closeManualModal();
            }}
          >
            <div
              className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-violet-200/80 bg-white p-5 shadow-xl dark:border-violet-900/50 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    id="taskflow-intervention-manual-modal-title"
                    className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Intervenção manual
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Preencha o intervalo e descreva o trabalho realizado; pode opcionalmente alinhar o estado no quadro.
                  </p>
                  {pickedTaskMeta ? (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Tarefa</span>
                      <span className="mx-1 text-slate-400">·</span>
                      <span className="text-slate-800 dark:text-slate-100">{pickedTaskMeta.title}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Escolha a tarefa no campo abaixo (não estava selecionada no painel).
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-200/80 pt-3 text-sm dark:border-slate-700/60">
                {manualModalError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200/90 bg-rose-50/95 px-3 py-2 text-sm text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-50"
                  >
                    {manualModalError}
                  </div>
                ) : null}
                {pickedTaskMeta ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-300" htmlFor="tf-manual-status">
                      O que fez neste período <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="tf-manual-status"
                      value={manualStatus}
                      onChange={(e) => setManualStatus(e.target.value)}
                      placeholder="Texto livre, ex.: Reunião com cliente, revisão de PR, análise de requisitos…"
                      className="h-10 rounded-2xl border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    />
                    <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      Não é o mesmo que «Estado no quadro»: aqui descreve o{' '}
                      <span className="font-medium">trabalho realizado</span> naquele intervalo; o dropdown abaixo (se
                      existir) altera opcionalmente o estado oficial da tarefa no Kanban.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300" htmlFor="tf-manual-task">
                        Tarefa
                      </label>
                      <Select value={taskPick} onValueChange={setTaskPick}>
                        <SelectTrigger
                          id="tf-manual-task"
                          className="h-10 w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60"
                        >
                          <SelectValue placeholder="Escolher…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">—</SelectItem>
                          {taskOptions.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.title.length > 80 ? `${t.title.slice(0, 80)}…` : t.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300" htmlFor="tf-manual-status">
                        O que fez neste período <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        id="tf-manual-status"
                        value={manualStatus}
                        onChange={(e) => setManualStatus(e.target.value)}
                        placeholder="Texto livre, ex.: Reunião com cliente, revisão de PR, análise de requisitos…"
                        className="h-10 rounded-2xl border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/60"
                      />
                      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        Não é o mesmo que «Estado no quadro»: aqui descreve o{' '}
                        <span className="font-medium">trabalho realizado</span> naquele intervalo; o dropdown abaixo (se
                        existir) altera opcionalmente o estado oficial da tarefa no Kanban.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {statusSyncOptions.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                        Estado no quadro (opcional)
                      </span>
                      <Select
                        value={manualSyncStatus}
                        onValueChange={(v) => {
                          setManualSyncStatus(v);
                          if (v !== '_none') {
                            const name = statusById.get(Number(v));
                            if (name) {
                              setManualStatus(name);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                          <SelectValue placeholder="Não alterar o quadro" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Não sincronizar</SelectItem>
                          {statusSyncOptions.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-300" htmlFor="tf-manual-start">
                      Início
                    </label>
                    <Input
                      id="tf-manual-start"
                      type="datetime-local"
                      value={manualStartLocal}
                      onChange={(e) => setManualStartLocal(e.target.value)}
                      className="h-10 rounded-2xl border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-300" htmlFor="tf-manual-end">
                      Fim
                    </label>
                    <Input
                      id="tf-manual-end"
                      type="datetime-local"
                      value={manualEndLocal}
                      onChange={(e) => setManualEndLocal(e.target.value)}
                      className="h-10 rounded-2xl border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-300" htmlFor="tf-manual-details">
                    Detalhes
                  </label>
                  <textarea
                    id="tf-manual-details"
                    value={manualDetails}
                    onChange={(e) => setManualDetails(e.target.value)}
                    rows={2}
                    placeholder="Opcional"
                    className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  />
                </div>

                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={manualBusy}
                    onClick={closeManualModal}
                  >
                    {ACTION_COPY.cancel}
                  </Button>
                  <Button type="button" className="rounded-full" disabled={manualBusy} onClick={() => void submitManual()}>
                    {manualBusy ? ACTION_COPY.saving : ACTION_COPY.save}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null}
    </div>
    </>
  );
}
