'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModuleDashboardPageShell } from '@/components/ui/module-dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { HelpPanel } from '@/components/ui/help-panel';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import { hasPermission, type Role } from '@/lib/auth/permissions';
import {
  PLATFORM_BOOLEAN_KEYS,
  PLATFORM_SETTING_LABELS,
  type PlatformBooleanKey,
} from '@/lib/platform/platform-settings-constants';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type SettingRow = { key: string; value: string; updatedAt: string };

type Payload = {
  settings: SettingRow[];
  envVarHints: Record<string, string[]>;
};

type AssemblyAiSecretPayload = {
  storedInDatabase: boolean;
  hasEnvFallback: boolean;
  transcriptionReady: boolean;
};

type ReunifyReasonRow = {
  id: number;
  reasonType: 'CANCEL' | 'RESCHEDULE';
  code: string;
  label: string;
  active: boolean;
};

export default function ControlIntegrationsPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'control.view');

  const { data, error, isLoading } = useSWR<Payload>(
    canView ? '/api/control/platform-settings' : null,
    fetcher,
  );

  const { data: assemblyAiStatus, mutate: mutateAssemblySecret } = useSWR<AssemblyAiSecretPayload>(
    canView ? '/api/control/assemblyai-secret' : null,
    fetcher,
  );

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [assemblyKeyInput, setAssemblyKeyInput] = useState('');
  const [assemblyBusy, setAssemblyBusy] = useState(false);
  const [assemblyMsg, setAssemblyMsg] = useState<string | null>(null);
  const [confirmAssemblyRemoval, setConfirmAssemblyRemoval] = useState(false);
  const { data: reasonsPayload, mutate: mutateReasons } = useSWR<{ reasons: ReunifyReasonRow[] }>(
    canView ? '/api/control/reunify-reasons' : null,
    fetcher,
  );
  const [reasonTypeDraft, setReasonTypeDraft] = useState<'CANCEL' | 'RESCHEDULE'>('CANCEL');
  const [reasonCodeDraft, setReasonCodeDraft] = useState('');
  const [reasonLabelDraft, setReasonLabelDraft] = useState('');
  const [reasonsBusy, setReasonsBusy] = useState(false);
  const [reasonsMsg, setReasonsMsg] = useState<string | null>(null);
  const [editingReasonId, setEditingReasonId] = useState<number | null>(null);
  const [editReasonCode, setEditReasonCode] = useState('');
  const [editReasonLabel, setEditReasonLabel] = useState('');

  const valueByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.settings ?? []) {
      m.set(r.key, r.value);
    }
    return m;
  }, [data?.settings]);

  const toggle = useCallback(
    async (key: PlatformBooleanKey, next: boolean) => {
      setPendingKey(key);
      try {
        const res = await fetch('/api/control/platform-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: next ? 'true' : 'false' }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((j as { error?: string }).error || 'Não foi possível gravar.');
        }
        await mutate('/api/control/platform-settings');
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : 'Erro ao gravar.');
      } finally {
        setPendingKey(null);
      }
    },
    [],
  );

  if (user && !canView) {
    return (
      <ModuleDashboardPageShell>
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Integrações globais são geridas apenas pelo operador da plataforma (acesso ao Control Center).
            </p>
          </CardContent>
        </Card>
      </ModuleDashboardPageShell>
    );
  }

  return (
    <ModuleDashboardPageShell innerClassName="space-y-6">
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="Integrações globais"
            description="Toggles de canais e e-mail; segredos em `.env` ou — para AssemblyAI (Reunify) — cadastro na base no cartão abaixo."
            className="w-full"
          />
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Button asChild variant="outline" className="w-full shrink-0 rounded-xl sm:w-auto">
            <Link href="/manual/control-integrations">Manual</Link>
          </Button>
          <Button asChild variant="outline" className="w-full shrink-0 rounded-xl sm:w-auto">
            <Link href="/dashboard/control-center">Voltar ao Controle</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Não foi possível carregar as configurações. Confirme que a migração `0042_platform_settings` foi aplicada.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {PLATFORM_BOOLEAN_KEYS.map((key) => {
          const meta = PLATFORM_SETTING_LABELS[key];
          const checked = valueByKey.get(key) === 'true';
          return (
            <Card key={key} className="atlas-surface atlas-hover border-slate-200/80 dark:border-slate-700/60">
              <CardHeader className="gap-1 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plug className="h-4 w-4 text-indigo-500" aria-hidden />
                  {meta.title}
                </CardTitle>
                <CardDescription>{meta.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={checked}
                    disabled={isLoading || pendingKey === key}
                    onChange={(ev) => toggle(key, ev.target.checked)}
                  />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {checked ? 'Ativado' : 'Desativado'}
                  </span>
                </label>
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Variáveis `.env` (referência)</p>
                  <ul className="mt-1 list-inside list-disc">
                    {meta.envVars.map((v) => (
                      <li key={v}>
                        <code className="text-[11px]">{v}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="atlas-surface atlas-hover border-violet-200/70 dark:border-violet-900/40">
        <CardHeader>
          <CardTitle>AssemblyAI (transcrição no Reunify)</CardTitle>
          <CardDescription>
            Chave da API usada quando uma equipa escolhe AssemblyAI como ASR. Fica na base de dados (tabela{' '}
            <code className="text-xs">platform_settings</code>, chave reservada{' '}
            <code className="text-xs">secrets.*</code>) — não aparece no JSON das outras configurações. Proteja backups
            e acesso ao Controle. Se também existir <code className="text-xs">ASSEMBLYAI_API_KEY</code> no ambiente,
            a da base tem prioridade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <ConfirmActionBanner
            open={confirmAssemblyRemoval}
            title="Confirmar remoção da chave"
            message="Remover a chave AssemblyAI da base? (continua a valer .env se existir.)"
            confirmLabel="Remover chave"
            cancelLabel="Cancelar"
            onCancel={() => setConfirmAssemblyRemoval(false)}
            onConfirm={async () => {
              setAssemblyBusy(true);
              setAssemblyMsg(null);
              try {
                const res = await fetch('/api/control/assemblyai-secret', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clear: true }),
                });
                const j = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                  throw new Error(j.error || 'Não foi possível remover.');
                }
                setAssemblyMsg('Chave removida da base.');
                setConfirmAssemblyRemoval(false);
                await mutateAssemblySecret();
              } catch (e) {
                setAssemblyMsg(e instanceof Error ? e.message : 'Erro ao remover.');
              } finally {
                setAssemblyBusy(false);
              }
            }}
          />
          <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span>
              Na base:{' '}
              <strong className="text-slate-800 dark:text-slate-100">
                {assemblyAiStatus?.storedInDatabase ? 'sim' : 'não'}
              </strong>
            </span>
            <span>
              Fallback <code className="text-[11px]">.env</code>:{' '}
              <strong className="text-slate-800 dark:text-slate-100">
                {assemblyAiStatus?.hasEnvFallback ? 'sim' : 'não'}
              </strong>
            </span>
            <span>
              Transcrição utilizável:{' '}
              <strong className="text-slate-800 dark:text-slate-100">
                {assemblyAiStatus?.transcriptionReady ? 'sim' : 'não'}
              </strong>
            </span>
          </div>
          {assemblyMsg ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              {assemblyMsg}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="assemblyai-key">Nova chave (substitui a anterior na base)</Label>
            <Input
              id="assemblyai-key"
              type="password"
              autoComplete="off"
              placeholder="Cole a chave da AssemblyAI…"
              value={assemblyKeyInput}
              onChange={(e) => setAssemblyKeyInput(e.target.value)}
              className="max-w-xl"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={assemblyBusy || !assemblyKeyInput.trim()}
              onClick={async () => {
                setAssemblyBusy(true);
                setAssemblyMsg(null);
                try {
                  const res = await fetch('/api/control/assemblyai-secret', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: assemblyKeyInput.trim() }),
                  });
                  const j = (await res.json().catch(() => ({}))) as { error?: string };
                  if (!res.ok) {
                    throw new Error(j.error || 'Não foi possível gravar.');
                  }
                  setAssemblyKeyInput('');
                  setAssemblyMsg('Chave guardada na base. Pode usar «Transcrever» no Reunify sem reiniciar o servidor.');
                  await mutateAssemblySecret();
                } catch (e) {
                  setAssemblyMsg(e instanceof Error ? e.message : 'Erro ao gravar.');
                } finally {
                  setAssemblyBusy(false);
                }
              }}
            >
              {assemblyBusy ? 'A gravar…' : 'Guardar na base'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={assemblyBusy || !assemblyAiStatus?.storedInDatabase}
              onClick={() => setConfirmAssemblyRemoval(true)}
            >
              Remover da base
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="atlas-surface atlas-hover border-sky-200/70 dark:border-sky-900/40">
        <CardHeader>
          <CardTitle>Motivos de cancelamento e reagenda (Reunify)</CardTitle>
          <CardDescription>
            Catálogo central para os modais de Cancelar/Reagendar. Mantém dados padronizados para dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          {reasonsMsg ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              {reasonsMsg}
            </p>
          ) : null}
          <div className="grid gap-2 md:grid-cols-4">
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
              value={reasonTypeDraft}
              onChange={(e) => setReasonTypeDraft(e.target.value as 'CANCEL' | 'RESCHEDULE')}
            >
              <option value="CANCEL">Cancelamento</option>
              <option value="RESCHEDULE">Reagendamento</option>
            </select>
            <Input
              placeholder="Código (ex: CONFLITO_AGENDA)"
              value={reasonCodeDraft}
              onChange={(e) => setReasonCodeDraft(e.target.value)}
            />
            <Input
              placeholder="Descrição do motivo"
              value={reasonLabelDraft}
              onChange={(e) => setReasonLabelDraft(e.target.value)}
            />
            <Button
              type="button"
              disabled={reasonsBusy || !reasonCodeDraft.trim() || !reasonLabelDraft.trim()}
              onClick={async () => {
                setReasonsBusy(true);
                setReasonsMsg(null);
                try {
                  const res = await fetch('/api/control/reunify-reasons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      reasonType: reasonTypeDraft,
                      code: reasonCodeDraft,
                      label: reasonLabelDraft,
                    }),
                  });
                  const j = (await res.json().catch(() => ({}))) as { error?: string };
                  if (!res.ok) {
                    throw new Error(j.error || 'Erro ao cadastrar motivo.');
                  }
                  setReasonCodeDraft('');
                  setReasonLabelDraft('');
                  setReasonsMsg('Motivo cadastrado.');
                  await mutateReasons();
                } catch (e) {
                  setReasonsMsg(e instanceof Error ? e.message : 'Erro ao cadastrar motivo.');
                } finally {
                  setReasonsBusy(false);
                }
              }}
            >
              Adicionar motivo
            </Button>
          </div>
          <div className="space-y-3">
            {!reasonsPayload ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Carregando lista de motivos…</p>
            ) : !Array.isArray(reasonsPayload.reasons) ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">Erro ao carregar lista de motivos.</p>
            ) : reasonsPayload.reasons.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhum motivo encontrado. Cadastre o primeiro motivo acima.
              </p>
            ) : (
              reasonsPayload.reasons.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40"
                >
                  <div className="min-w-[240px] flex-1">
                    {editingReasonId === row.id ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input value={editReasonCode} onChange={(e) => setEditReasonCode(e.target.value)} />
                        <Input value={editReasonLabel} onChange={(e) => setEditReasonLabel(e.target.value)} />
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {row.reasonType === 'CANCEL' ? 'Cancelamento' : 'Reagendamento'} · {row.code}
                          {!row.active ? ' · (inativo)' : ''}
                        </p>
                        <p className="text-sm">{row.label}</p>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editingReasonId === row.id ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={reasonsBusy || !editReasonCode.trim() || !editReasonLabel.trim()}
                          onClick={async () => {
                            setReasonsBusy(true);
                            setReasonsMsg(null);
                            try {
                              const res = await fetch('/api/control/reunify-reasons', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: row.id,
                                  code: editReasonCode,
                                  label: editReasonLabel,
                                }),
                              });
                              const j = (await res.json().catch(() => ({}))) as { error?: string };
                              if (!res.ok) throw new Error(j.error || 'Erro ao salvar edição.');
                              setEditingReasonId(null);
                              setReasonsMsg('Motivo atualizado.');
                              await mutateReasons();
                            } catch (e) {
                              setReasonsMsg(e instanceof Error ? e.message : 'Erro ao salvar edição.');
                            } finally {
                              setReasonsBusy(false);
                            }
                          }}
                        >
                          Salvar
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingReasonId(null)}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={reasonsBusy}
                          onClick={() => {
                            setEditingReasonId(row.id);
                            setEditReasonCode(row.code);
                            setEditReasonLabel(row.label);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={reasonsBusy}
                          onClick={async () => {
                            setReasonsBusy(true);
                            setReasonsMsg(null);
                            try {
                              const res = await fetch('/api/control/reunify-reasons', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: row.id }),
                              });
                              const j = (await res.json().catch(() => ({}))) as { error?: string };
                              if (!res.ok) throw new Error(j.error || 'Erro ao excluir motivo.');
                              setReasonsMsg('Motivo excluído.');
                              await mutateReasons();
                            } catch (e) {
                              setReasonsMsg(e instanceof Error ? e.message : 'Erro ao excluir motivo.');
                            } finally {
                              setReasonsBusy(false);
                            }
                          }}
                        >
                          Excluir
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={reasonsBusy}
                          onClick={async () => {
                            setReasonsBusy(true);
                            setReasonsMsg(null);
                            try {
                              const res = await fetch('/api/control/reunify-reasons', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: row.id, active: !row.active }),
                              });
                              const j = (await res.json().catch(() => ({}))) as { error?: string };
                              if (!res.ok) throw new Error(j.error || 'Erro ao atualizar motivo.');
                              setReasonsMsg('Catálogo atualizado.');
                              await mutateReasons();
                            } catch (e) {
                              setReasonsMsg(e instanceof Error ? e.message : 'Erro ao atualizar motivo.');
                            } finally {
                              setReasonsBusy(false);
                            }
                          }}
                        >
                          {row.active ? 'Desativar' : 'Ativar'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <HelpPanel
        title="Boas práticas"
        description="Segredos em `.env` não aparecem na UI. A chave AssemblyAI pode ficar só na base (cartão acima) ou duplicada no ambiente — avalie política de backups e LGPD."
        tips={[
          'Reinicie ou faça redeploy após alterar `.env` (outras integrações).',
          'Mantenha o Controle apenas para perfis owner/admin.',
        ]}
      />
    </ModuleDashboardPageShell>
  );
}
