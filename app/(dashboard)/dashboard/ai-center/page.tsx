'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleDashboardPageShell } from '@/components/ui/module-dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { HelpPanel } from '@/components/ui/help-panel';
import { useFloatingFeedback } from '@/components/ui/floating-feedback';
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
import Link from 'next/link';

type AiModel = {
  id: number;
  name: string;
  provider: string;
  type: string;
  status: string;
  endpoint?: string | null;
  modelId?: string | null;
  isDefault: boolean;
  isOpenSource: boolean;
  notes?: string | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const statusBadge = (status: string) => {
  if (status === 'ATIVO') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
};

export default function AiCenterPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'ai.manage');

  const { data: models } = useSWR<AiModel[]>('/api/ai/models', fetcher);
  const [form, setForm] = useState({
    name: '',
    provider: '',
    type: 'LLM',
    status: 'PAUSADO',
    endpoint: '',
    modelId: '',
    isDefault: false,
    isOpenSource: true,
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const toast = useFloatingFeedback();

  if (user && !canView) {
    return (
      <ModuleDashboardPageShell>
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você não tem permissão para acessar a Central de IA.
            </p>
          </CardContent>
        </Card>
        <div className="mt-6">
          <HelpPanel
            title="Ajuda rápida"
            description="A Central de IA é configurada pelo operador da plataforma, não pelo administrador de um time cliente."
            tips={['Peça à equipa que gere a sua instância Atlas se precisar de alterações no catálogo de modelos.']}
          />
        </div>
      </ModuleDashboardPageShell>
    );
  }

  const updateModel = async (id: number, payload: Partial<AiModel>) => {
    await fetch('/api/ai/models', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    await mutate('/api/ai/models');
  };

  return (
    <ModuleDashboardPageShell>
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="Central de IA"
            description="Inventário e registo de modelos (tabela ai_models). A inferência na app usa outros caminhos — ver quadro abaixo."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/ai-center">Manual</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="atlas-surface border-indigo-200/70 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <CardHeader className="gap-1">
              <CardTitle className="text-base">O que já funciona na aplicação (não depende desta lista)</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-300">
                Botões <strong>Ativar</strong> abaixo só alteram o <strong>registo</strong> na base; nenhum módulo lê
                automaticamente estas linhas para chamar Llama, Mistral, Whisper ou BGE hoje.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed">
                <li>
                  <strong>LLM na nuvem (Taskflow)</strong>: opt-in da equipa + fornecedor OpenAI ou Gemini + chaves no
                  servidor — endpoint{' '}
                  <code className="rounded bg-white/80 px-1 text-[10px] dark:bg-slate-900/80">POST /api/taskflow/cloud-ai/chat</code>
                  . Não usa o catálogo <em>Llama / Mistral</em> daqui.
                </li>
                <li>
                  <strong>Embeddings (busca semântica no Taskflow)</strong>: API OpenAI{' '}
                  <code className="rounded bg-white/80 px-1 text-[10px] dark:bg-slate-900/80">text-embedding-3-small</code>{' '}
                  com <code className="rounded bg-white/80 px-1 text-[10px] dark:bg-slate-900/80">OPENAI_API_KEY</code> e
                  toggles da equipa — não usa a linha <em>BGE M3</em> desta página.
                </li>
                <li>
                  <strong>Transcrição de áudio (Reunify)</strong>: fornecedor <strong>AssemblyAI</strong> por equipa +
                  <code className="rounded bg-white/80 px-1 text-[10px] dark:bg-slate-900/80">ASSEMBLYAI_API_KEY</code>{' '}
                  no servidor — não usa a linha <em>Whisper Large v3</em> do catálogo.
                </li>
                <li>
                  <strong>Heurísticas locais</strong> (Reunify rascunhos de acções, sugestões do quadro Taskflow,
                  relatórios E7.3): sem LLM externo; ver{' '}
                  <code className="rounded bg-white/80 px-1 text-[10px] dark:bg-slate-900/80">GET /api/ai/pipeline/capabilities</code>.
                </li>
              </ul>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Para as entradas <strong>Llama / Mistral / Whisper / BGE</strong> passarem a ser usadas em código, seria
                preciso ligar workers (ex.: Ollama, vLLM, faster-whisper) ao <code className="text-[10px]">endpoint</code>{' '}
                registado e implementar o encaminhamento — roadmap em <code className="text-[10px]">Projeto/MEMORIAL_TASKFLOW_EXECUCAO.md</code> (Central de IA / Fase 8).
              </p>
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Modelos registrados</CardTitle>
              <CardDescription>
                Catálogo interno (seed + cadastro manual). Útil para documentação e evolução futura; <strong>ativar</strong>{' '}
                não inicia inferência por si só.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(models || []).length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhum modelo cadastrado
                </div>
              ) : (
                models?.map((model) => (
                  <div
                    key={model.id}
                    className="atlas-item flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="atlas-item-title">{model.name}</p>
                      <p className="atlas-item-meta">
                        {model.provider} • {model.type}
                      </p>
                      {model.notes ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {model.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <span className={`atlas-badge ${statusBadge(model.status)}`}>
                        {model.status}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {model.isDefault ? 'Padrão' : 'Secundário'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateModel(model.id, {
                              status: model.status === 'ATIVO' ? 'PAUSADO' : 'ATIVO',
                            })
                          }
                        >
                          {model.status === 'ATIVO' ? 'Pausar' : 'Ativar'}
                        </Button>
                        {!model.isDefault ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              updateModel(model.id, {
                                isDefault: true,
                                type: model.type,
                              })
                            }
                          >
                            Tornar padrão
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Boas práticas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              <p>Use modelos distintos para LLM, embeddings e transcrição.</p>
              <p>Ative apenas modelos necessários para reduzir custos.</p>
              <p>Mantenha um modelo padrão por tipo.</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Cadastrar modelo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              <Input
                placeholder="Nome do modelo"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Fornecedor"
                  value={form.provider}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, provider: event.target.value }))
                  }
                />
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LLM">LLM</SelectItem>
                    <SelectItem value="EMBEDDING">Embedding</SelectItem>
                    <SelectItem value="ASR">ASR (Áudio)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAUSADO">Pausado</SelectItem>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="ID do modelo"
                  value={form.modelId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, modelId: event.target.value }))
                  }
                />
              </div>
              <Input
                placeholder="Endpoint (opcional)"
                value={form.endpoint}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, endpoint: event.target.value }))
                }
              />
              <Input
                placeholder="Observações"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={form.isOpenSource}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, isOpenSource: event.target.checked }))
                  }
                />
                Modelo open source
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, isDefault: event.target.checked }))
                  }
                />
                Definir como padrão
              </label>
              <Button
                onClick={async () => {
                  if (!form.name.trim() || !form.provider.trim()) {
                    toast.showError('Informe nome e fornecedor.');
                    return;
                  }
                  toast.dismiss();
                  setIsSaving(true);
                  try {
                    const response = await fetch('/api/ai/models', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...form,
                        name: form.name.trim(),
                        provider: form.provider.trim(),
                        modelId: form.modelId.trim() || null,
                        endpoint: form.endpoint.trim() || null,
                        notes: form.notes.trim() || null,
                      }),
                    });
                    if (!response.ok) {
                      const payload = await response.json();
                      throw new Error(payload?.error || 'Erro ao salvar modelo');
                    }
                    setForm({
                      name: '',
                      provider: '',
                      type: 'LLM',
                      status: 'PAUSADO',
                      endpoint: '',
                      modelId: '',
                      isDefault: false,
                      isOpenSource: true,
                      notes: '',
                    });
                    await mutate('/api/ai/models');
                    toast.showSuccess('Modelo adicionado ao inventário.');
                  } catch (err: unknown) {
                    toast.showError(
                      err instanceof Error ? err.message : 'Erro ao salvar modelo',
                    );
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving || !form.name.trim() || !form.provider.trim()}
              >
                {isSaving ? 'Salvando...' : 'Adicionar modelo'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Gerencie modelos open source e endpoints de IA."
          tips={[
            'Mantenha um modelo padrão para cada tipo.',
            'Ative apenas modelos que estiver usando.',
            'Documente endpoints e versionamento.',
          ]}
        />
      </div>
    </ModuleDashboardPageShell>
  );
}
