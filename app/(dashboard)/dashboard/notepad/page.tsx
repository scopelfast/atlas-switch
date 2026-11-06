'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { Archive, Link2, Pin, StickyNote } from 'lucide-react';
import { ScriptumStatCard } from '@/components/scriptum/scriptum-stat-card';
import { Button } from '@/components/ui/button';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityEditDeleteActions } from '@/components/ui/entity-edit-delete-actions';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleDashboardPageShell } from '@/components/ui/module-dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { hasPermission, isOwnerLike, type Role } from '@/lib/auth/permissions';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Nota = {
  id: number;
  title: string;
  content?: string | null;
  folder: string;
  tags?: string | null;
  status: string;
  visibility: string;
  pinned: boolean;
  projectId?: number | null;
  updatedAt: string;
};

type ProjectusProject = {
  id: number;
  nome: string;
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

export default function NotepadPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher, swrNoRetryOn403);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'notepad.view');

  const [filters, setFilters] = useState({
    folder: '',
    status: '',
    projectId: '',
  });

  const notesUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.folder) params.set('folder', filters.folder);
    if (filters.status) params.set('status', filters.status);
    if (filters.projectId) params.set('projectId', filters.projectId);
    const query = params.toString();
    return query ? `/api/notepad/notes?${query}` : '/api/notepad/notes';
  }, [filters]);

  const { data: notas, isLoading, error: notasError } = useSWR<Nota[]>(
    notesUrl,
    fetcher,
    swrNoRetryOn403,
  );
  const { data: projectusList, error: projectusError } = useSWR<ProjectusProject[]>(
    '/api/projectus/projects',
    fetcher,
    swrNoRetryOn403,
  );
  const notasList = Array.isArray(notas) ? notas : [];
  const projectusRows = Array.isArray(projectusList) ? projectusList : [];
  const loadError = notasError || null;
  const projectusIntegrationBlocked = Boolean(projectusError);

  const [formState, setFormState] = useState({
    title: '',
    content: '',
    folder: 'Geral',
    tags: '',
    status: 'ATIVA',
    visibility: 'EQUIPE',
    pinned: false,
    projectId: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<number | null>(null);

  const helpTips = isOwnerLike(role)
    ? [
        'Padronize nomes de pasta (ex.: Geral, Cliente X, Trabalho) para filtros funcionarem bem.',
        'Use o vínculo ao Projectus quando a nota for decisão ou contexto de um projeto do portfólio do time.',
        'Tags curtas e consistentes (área-cliente) ajudam a localizar notas na lista.',
      ]
    : [
        'O corpo aceita Markdown simples; o título é obrigatório para gravar.',
        'Combine filtros de pasta, status e projeto (Projectus) para achar notas antigas.',
        'Se aparecer «Acesso restrito», peça ao administrador a permissão Notepad — visualizar no Catálogo.',
      ];

  const projectusNomePorId = useMemo(() => {
    return new Map(projectusRows.map((row) => [row.id, row.nome]));
  }, [projectusRows]);

  const lista = notasList;
  const totalFixadas = lista.filter((n) => n.pinned).length;
  const totalComProjectus = lista.filter((n) => !!n.projectId).length;
  const totalComTags = lista.filter((n) => (n.tags || '').trim().length > 0).length;

  if (user && !canView) {
    return (
      <ModuleDashboardPageShell>
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você não tem permissão para acessar o Notepad Pro.
            </p>
          </CardContent>
        </Card>
        <div className="mt-6">
          <HelpPanel
            title="Ajuda rápida"
            description="Se precisar deste acesso, fale com o administrador do time."
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
            title="Notepad Pro"
            description="Bloco de notas do time: título, pasta, tags, status, visibilidade, texto em Markdown e vínculo opcional a um projeto do módulo Projectus (mesmo time). Liste, filtre e crie notas; não há nesta página conversão automática para tarefas nem escolha de documento do Bibliotheca."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/notepad">Manual</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScriptumStatCard
          variant="violet"
          icon={StickyNote}
          title="Notas na lista"
          description="Linhas retornadas com os filtros atuais"
          value={lista.length}
          footnote="Pasta / status / projeto (Projectus)"
        />
        <ScriptumStatCard
          variant="indigo"
          icon={Pin}
          title="Fixadas"
          description="Notas com «Fixar» ativo nesta vista"
          value={totalFixadas}
          footnote="Contagem no cliente sobre a lista filtrada"
        />
        <ScriptumStatCard
          variant="sky"
          icon={Link2}
          title="Vínculo Projectus"
          description="Notas com projeto do portfólio associado"
          value={totalComProjectus}
          footnote={
            projectusIntegrationBlocked
              ? 'Integração Projectus indisponível no plano ativo'
              : 'Campo opcional na criação da nota'
          }
        />
        <ScriptumStatCard
          variant="emerald"
          icon={Archive}
          title="Com tags"
          description="Campo de tags preenchido"
          value={totalComTags}
          footnote="Separe tags por vírgula ao criar"
        />
      </div>

      {loadError ? (
        <Card className="mt-4 border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/10">
          <CardContent className="pt-4 text-sm text-amber-900 dark:text-amber-100">
            {loadError.message}
          </CardContent>
        </Card>
      ) : null}
      {projectusIntegrationBlocked ? (
        <Card className="mt-4 border-sky-300 bg-sky-50/70 dark:border-sky-500/40 dark:bg-sky-500/10">
          <CardContent className="pt-4 text-sm text-sky-900 dark:text-sky-100">
            Integração com Projectus indisponível neste plano. O Notepad continua funcional sem vínculo de projeto.
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="atlas-surface atlas-hover">
            <CardHeader className="gap-1">
              <CardTitle>Notas recentes</CardTitle>
              <CardDescription>
                Até 50 registros por pedido, ordenados pela última atualização. Os filtros enviam parâmetros para{' '}
                <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">GET /api/notepad/notes</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Select
                  value={filters.folder || '_all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({ ...prev, folder: v === '_all' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas as pastas</SelectItem>
                    <SelectItem value="Geral">Geral</SelectItem>
                    <SelectItem value="Universidade">Universidade</SelectItem>
                    <SelectItem value="Trabalho">Trabalho</SelectItem>
                    <SelectItem value="Pessoal">Pessoal</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.status || '_all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({ ...prev, status: v === '_all' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos os status</SelectItem>
                    <SelectItem value="ATIVA">Ativa</SelectItem>
                    <SelectItem value="ARQUIVADA">Arquivada</SelectItem>
                    <SelectItem value="REVISAR">Revisar</SelectItem>
                  </SelectContent>
                </Select>
                {projectusIntegrationBlocked ? (
                  <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Filtro por projeto indisponível (Projectus bloqueado no plano).
                  </div>
                ) : (
                  <Select
                    value={filters.projectId || '_all'}
                    onValueChange={(v) =>
                      setFilters((prev) => ({ ...prev, projectId: v === '_all' ? '' : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Projeto (Projectus)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Qualquer projeto</SelectItem>
                      {projectusRows.map((row) => (
                        <SelectItem key={row.id} value={String(row.id)}>
                          {row.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {isLoading ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Carregando notas...
                </div>
              ) : notasList.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhuma nota encontrada com estes filtros.
                </div>
              ) : (
                notasList.map((nota) => (
                  <div
                    key={nota.id}
                    className={cn(
                      'atlas-item flex flex-col gap-2',
                      editingNoteId === nota.id
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                        : '',
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="atlas-item-meta">
                          {nota.folder}
                          {nota.projectId
                            ? ` • ${projectusNomePorId.get(nota.projectId) || 'Projeto Projectus'}`
                            : ''}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="atlas-item-title">{nota.title}</p>
                          {editingNoteId === nota.id ? (
                            <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                              Em edição
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {nota.tags ? `Tags: ${nota.tags}` : 'Sem tags'}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        {nota.pinned ? (
                          <span className="atlas-badge bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                            Fixada
                          </span>
                        ) : null}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Atualizado em {new Date(nota.updatedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <EntityEditDeleteActions
                      onEdit={() => {
                        setEditingNoteId(nota.id);
                        setFormState({
                          title: nota.title,
                          content: nota.content || '',
                          folder: nota.folder,
                          tags: nota.tags || '',
                          status: nota.status,
                          visibility: nota.visibility,
                          pinned: nota.pinned,
                          projectId: nota.projectId ? String(nota.projectId) : '',
                        });
                      }}
                      onDelete={() => setPendingDeleteNoteId(nota.id)}
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
              editingNoteId ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
            )}
          >
            <CardHeader className="gap-1">
              <CardTitle>{editingNoteId ? 'Editar nota' : 'Nova nota'}</CardTitle>
              <CardDescription>
                Grava com <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">POST /api/notepad/notes</code>
                . Pasta e tags são texto livre (a pasta «Trabalho» é só sugestão no filtro).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              <ConfirmActionBanner
                open={Boolean(pendingDeleteNoteId)}
                title="Confirmar exclusão de nota"
                message="Excluir esta nota?"
                confirmLabel="Excluir nota"
                cancelLabel="Cancelar"
                onCancel={() => setPendingDeleteNoteId(null)}
                onConfirm={async () => {
                  if (!pendingDeleteNoteId) return;
                  const res = await fetch(`/api/notepad/notes?id=${pendingDeleteNoteId}`, {
                    method: 'DELETE',
                  });
                  if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    setFormError(payload?.error || 'Erro ao excluir nota');
                    return;
                  }
                  if (editingNoteId === pendingDeleteNoteId) {
                    setEditingNoteId(null);
                  }
                  setPendingDeleteNoteId(null);
                  await mutate(notesUrl);
                }}
              />
              {editingNoteId ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Modo de edição ativo. Revise os campos e salve as alterações.
                </p>
              ) : null}
              <Input
                placeholder="Título (obrigatório)"
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Pasta (ex.: Geral, Trabalho)"
                  value={formState.folder}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, folder: event.target.value }))
                  }
                />
                <Input
                  placeholder="Tags (separe por vírgula)"
                  value={formState.tags}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, tags: event.target.value }))
                  }
                />
              </div>
              <Select
                value={formState.status}
                onValueChange={(v) => setFormState((prev) => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVA">Ativa</SelectItem>
                  <SelectItem value="REVISAR">Revisar</SelectItem>
                  <SelectItem value="ARQUIVADA">Arquivada</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={formState.visibility}
                onValueChange={(v) =>
                  setFormState((prev) => ({ ...prev, visibility: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Visibilidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EQUIPE">Equipe</SelectItem>
                  <SelectItem value="GESTAO">Gestão</SelectItem>
                  <SelectItem value="PESSOAL">Pessoal</SelectItem>
                </SelectContent>
              </Select>
              {projectusIntegrationBlocked ? (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Vínculo com projeto indisponível (Projectus bloqueado no plano).
                </div>
              ) : (
                <Select
                  value={formState.projectId || '_none'}
                  onValueChange={(v) =>
                    setFormState((prev) => ({
                      ...prev,
                      projectId: v === '_none' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Projeto Projectus (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem vínculo ao Projectus</SelectItem>
                    {projectusRows.map((row) => (
                      <SelectItem key={row.id} value={String(row.id)}>
                        {row.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <textarea
                className="min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                placeholder="Corpo em Markdown (opcional)…"
                value={formState.content}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, content: event.target.value }))
                }
              />
              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={formState.pinned}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, pinned: event.target.checked }))
                  }
                />
                Fixar nota no topo da lista
              </label>
              {formError && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {formError}
                </p>
              )}
              <Button
                onClick={async () => {
                  if (!formState.title.trim()) {
                    setFormError('Informe o título da nota.');
                    return;
                  }
                  setFormError(null);
                  setIsSaving(true);
                  try {
                    const response = await fetch('/api/notepad/notes', {
                      method: editingNoteId ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...(editingNoteId ? { id: editingNoteId } : {}),
                        title: formState.title.trim(),
                        content: formState.content.trim() || null,
                        folder: formState.folder.trim() || 'Geral',
                        tags: formState.tags.trim() || null,
                        status: formState.status,
                        visibility: formState.visibility,
                        pinned: formState.pinned,
                        projectId: formState.projectId ? Number(formState.projectId) : null,
                      }),
                    });
                    if (!response.ok) {
                      const payload = await response.json();
                      throw new Error(payload?.error || 'Erro ao criar nota');
                    }
                    setFormState({
                      title: '',
                      content: '',
                      folder: 'Geral',
                      tags: '',
                      status: 'ATIVA',
                      visibility: 'EQUIPE',
                      pinned: false,
                      projectId: '',
                    });
                    setEditingNoteId(null);
                    await mutate(notesUrl);
                  } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : 'Erro ao salvar nota';
                    setFormError(msg);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving || !formState.title.trim()}
              >
                {isSaving ? 'Salvando...' : editingNoteId ? 'Salvar nota' : 'Adicionar nota'}
              </Button>
              {editingNoteId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingNoteId(null);
                    setFormState({
                      title: '',
                      content: '',
                      folder: 'Geral',
                      tags: '',
                      status: 'ATIVA',
                      visibility: 'EQUIPE',
                      pinned: false,
                      projectId: '',
                    });
                  }}
                >
                  Cancelar edição
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader className="gap-1">
              <CardTitle>Ligações a outros módulos</CardTitle>
              <CardDescription>
                O que existe hoje na API e nesta tela — sem prometer automações que a UI não mostra.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
                <p className="font-medium text-slate-800 dark:text-slate-100">Projectus</p>
                <p className="mt-1 text-xs leading-relaxed">
                  <strong>Sim nesta página:</strong> lista de projetos do mesmo time (
                  <code className="rounded bg-white/90 px-1 dark:bg-slate-800">GET /api/projectus/projects</code>) e
                  campo opcional <code className="rounded bg-white/90 px-1 dark:bg-slate-800">projectId</code> ao criar
                  a nota. O nome do projeto aparece na lista quando houver vínculo.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
                <p className="font-medium text-slate-800 dark:text-slate-100">Scriptum</p>
                <p className="mt-1 text-xs leading-relaxed">
                  <strong>Não nesta página:</strong> no módulo Scriptum, ao criar um projeto de escrita, pode associar
                  uma <strong>nota existente</strong> do Notepad como rascunho (
                  <code className="rounded bg-white/90 px-1 dark:bg-slate-800">noteId</code>). Fluxo entra pelo
                  Scriptum, não pelo formulário à direita aqui.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2 w-full sm:w-auto">
                  <Link href="/dashboard/scriptum">Abrir Scriptum</Link>
                </Button>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
                <p className="font-medium text-slate-800 dark:text-slate-100">Taskflow e Bibliotheca</p>
                <p className="mt-1 text-xs leading-relaxed">
                  A tabela de notas tem colunas <code className="rounded bg-white/90 px-1 dark:bg-slate-800">taskId</code>{' '}
                  e <code className="rounded bg-white/90 px-1 dark:bg-slate-800">documentId</code> na base de dados; a
                  API pode receber esses IDs no JSON — <strong>esta tela não expõe</strong> seletores nem cria tarefas ou documentos
                  a partir da nota. Integração futura ou uso via API/ferramentas externas.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/projectus">Projectus</Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/manual/notepad">Manual completo</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Notepad Pro é o caderno compartilhado do time: capture decisões e referências com contexto."
          tips={helpTips}
        />
      </div>
    </ModuleDashboardPageShell>
  );
}
