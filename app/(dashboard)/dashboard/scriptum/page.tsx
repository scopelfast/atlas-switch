'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { BookOpen, PenLine, Percent, Target } from 'lucide-react';
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

type ScriptumProject = {
  id: number;
  title: string;
  type: string;
  status: string;
  goalWords: number;
  currentWords: number;
  dueDate?: string | null;
  summary?: string | null;
  documentId?: number | null;
  noteId?: number | null;
};

type ScriptumChapter = {
  id: number;
  projectId: number;
  title: string;
  status: string;
  wordCount: number;
  position: number;
};

type BibliothecaDocument = {
  id: number;
  titulo: string;
};

type NotepadNote = {
  id: number;
  title: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ScriptumPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'scriptum.view');

  const [filters, setFilters] = useState({ status: '', type: '' });
  const projectsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.type) params.set('type', filters.type);
    const query = params.toString();
    return query ? `/api/scriptum/projects?${query}` : '/api/scriptum/projects';
  }, [filters]);

  const { data: projetos, isLoading } = useSWR<ScriptumProject[]>(projectsUrl, fetcher);
  const { data: documentos } = useSWR<BibliothecaDocument[]>(
    '/api/bibliotheca/documents?limit=50',
    fetcher,
  );
  const { data: notas } = useSWR<NotepadNote[]>('/api/notepad/notes?limit=50', fetcher);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const { data: capitulos } = useSWR<ScriptumChapter[]>(
    selectedProjectId ? `/api/scriptum/chapters?projectId=${selectedProjectId}` : null,
    fetcher,
  );

  const [projectForm, setProjectForm] = useState({
    title: '',
    type: 'ARTIGO',
    status: 'RASCUNHO',
    goalWords: 1200,
    currentWords: 0,
    dueDate: '',
    summary: '',
    documentId: '',
    noteId: '',
  });
  const [chapterForm, setChapterForm] = useState({
    title: '',
    status: 'EM_PROGRESSO',
    wordCount: 0,
    position: 1,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [pendingDeleteProjectId, setPendingDeleteProjectId] = useState<number | null>(null);

  const helpTips =
    isOwnerLike(role)
      ? [
          'Defina meta de palavras realista por projeto e atualize «palavras atuais» ao fechar cada sprint de escrita.',
          'Use capítulos para partir o manuscrito; o estado do capítulo é independente do estado do projeto.',
          'Vincule documento Bibliotheca ou nota Notepad quando o rascunho já existir lá.',
        ]
      : [
          'Seleccione um projeto na lista para ver e criar capítulos.',
          'Filtros de tipo e status ajudam a achar o texto certo em equipas com muitos projetos.',
          'Data de entrega no formulário é opcional mas ajuda o calendário mental da equipa.',
        ];

  const totalMeta = (projetos || []).reduce((acc, item) => acc + item.goalWords, 0);
  const totalAtual = (projetos || []).reduce((acc, item) => acc + item.currentWords, 0);
  const progresso = totalMeta ? Math.round((totalAtual / totalMeta) * 100) : 0;

  const resetProjectForm = () => {
    setEditingProjectId(null);
    setProjectForm({
      title: '',
      type: 'ARTIGO',
      status: 'RASCUNHO',
      goalWords: 1200,
      currentWords: 0,
      dueDate: '',
      summary: '',
      documentId: '',
      noteId: '',
    });
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
              Você não tem permissão para acessar o Scriptum.
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

  return (
    <ModuleDashboardPageShell>
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="Scriptum"
            description="Projetos longos (artigo, tese, roteiro, livro) com meta de palavras, progresso manual, capítulos por projeto e vínculos opcionais a documentos do Bibliotheca ou notas do Notepad — mesmo time."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/scriptum">Manual</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScriptumStatCard
          variant="violet"
          icon={BookOpen}
          title="Projetos"
          description="Linhas na lista (filtros aplicados)"
          value={projetos?.length ?? 0}
          footnote="Tipo / status nos filtros acima"
        />
        <ScriptumStatCard
          variant="indigo"
          icon={Target}
          title="Meta total de palavras"
          description="Soma das metas dos projetos visíveis"
          value={totalMeta.toLocaleString('pt-BR')}
          footnote="Somatório de goalWords"
        />
        <ScriptumStatCard
          variant="sky"
          icon={PenLine}
          title="Palavras escritas"
          description="Soma do progresso declarado"
          value={totalAtual.toLocaleString('pt-BR')}
          footnote="Somatório de currentWords"
        />
        <ScriptumStatCard
          variant="emerald"
          icon={Percent}
          title="Progresso geral"
          description="Atual ÷ meta (lista filtrada)"
          value={totalMeta > 0 ? `${progresso}%` : '—'}
          footnote={totalMeta > 0 ? 'Arredondado' : 'Sem meta na vista'}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="atlas-surface atlas-hover">
            <CardHeader className="gap-1">
              <CardTitle>Projetos de escrita</CardTitle>
              <CardDescription>Clique num projeto para carregar capítulos e criar novos capítulos à direita</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={filters.type || '_all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({ ...prev, type: v === '_all' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tipo</SelectItem>
                    <SelectItem value="ARTIGO">Artigo</SelectItem>
                    <SelectItem value="TESE">Tese</SelectItem>
                    <SelectItem value="ROTEIRO">Roteiro</SelectItem>
                    <SelectItem value="LIVRO">Livro</SelectItem>
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
                    <SelectItem value="_all">Status</SelectItem>
                    <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                    <SelectItem value="EM_PROGRESSO">Em progresso</SelectItem>
                    <SelectItem value="REVISAO">Revisão</SelectItem>
                    <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isLoading ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Carregando projetos...
                </div>
              ) : !projetos || projetos.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhum projeto encontrado.
                </div>
              ) : (
                projetos.map((projeto) => (
                  <div
                    key={projeto.id}
                    className={cn(
                      'atlas-item flex flex-col gap-2',
                      selectedProjectId === projeto.id
                        ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                        : '',
                      editingProjectId === projeto.id
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                        : '',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId(projeto.id)}
                      className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="atlas-item-meta">{projeto.status}</p>
                        <div className="flex items-center gap-2">
                          <p className="atlas-item-title">{projeto.title}</p>
                          {editingProjectId === projeto.id ? (
                            <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                              Em edição
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Meta: {projeto.currentWords}/{projeto.goalWords} palavras
                        </p>
                      </div>
                      <span className="atlas-badge bg-rose-500/10 text-rose-600 dark:text-rose-300">
                        {projeto.type}
                      </span>
                    </button>
                    <EntityEditDeleteActions
                      onEdit={() => {
                        setEditingProjectId(projeto.id);
                        setProjectForm({
                          title: projeto.title,
                          type: projeto.type,
                          status: projeto.status,
                          goalWords: projeto.goalWords,
                          currentWords: projeto.currentWords,
                          dueDate: projeto.dueDate ? projeto.dueDate.slice(0, 10) : '',
                          summary: projeto.summary || '',
                          documentId: projeto.documentId ? String(projeto.documentId) : '',
                          noteId: projeto.noteId ? String(projeto.noteId) : '',
                        });
                      }}
                      onDelete={() => setPendingDeleteProjectId(projeto.id)}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card
            className={cn(
              'atlas-surface atlas-hover',
              editingProjectId ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
            )}
          >
            <CardHeader className="gap-1">
              <CardTitle>Capítulos</CardTitle>
              <CardDescription>Ordenados por posição na API; estado próprio do capítulo</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              {!selectedProjectId ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Selecione um projeto para ver capítulos
                </div>
              ) : !capitulos || capitulos.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhum capítulo cadastrado
                </div>
              ) : (
                capitulos.map((capitulo) => (
                  <div
                    key={capitulo.id}
                    className="atlas-item flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="atlas-item-meta">{capitulo.status}</p>
                      <p className="atlas-item-title">{capitulo.title}</p>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {capitulo.wordCount} palavras
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="atlas-surface atlas-hover">
            <CardHeader className="gap-1">
              <CardTitle>{editingProjectId ? 'Editar projeto' : 'Novo projeto'}</CardTitle>
              <CardDescription>Grava em POST /api/scriptum/projects; vínculos Bibliotheca/Notepad são opcionais</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              <ConfirmActionBanner
                open={Boolean(pendingDeleteProjectId)}
                title="Confirmar exclusão de projeto"
                message="Excluir este projeto de escrita?"
                confirmLabel="Excluir projeto"
                cancelLabel="Cancelar"
                onCancel={() => setPendingDeleteProjectId(null)}
                onConfirm={async () => {
                  if (!pendingDeleteProjectId) return;
                  const res = await fetch(`/api/scriptum/projects?id=${pendingDeleteProjectId}`, {
                    method: 'DELETE',
                  });
                  if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    setFormError(payload?.error || 'Erro ao excluir projeto');
                    return;
                  }
                  if (editingProjectId === pendingDeleteProjectId) {
                    resetProjectForm();
                  }
                  setPendingDeleteProjectId(null);
                  await mutate(projectsUrl);
                }}
              />
              {editingProjectId ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Modo de edição ativo. Revise os campos e salve as alterações.
                </p>
              ) : null}
              <Input
                placeholder="Título do projeto"
                value={projectForm.title}
                onChange={(event) =>
                  setProjectForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={projectForm.type}
                  onValueChange={(v) =>
                    setProjectForm((prev) => ({ ...prev, type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARTIGO">Artigo</SelectItem>
                    <SelectItem value="TESE">Tese</SelectItem>
                    <SelectItem value="ROTEIRO">Roteiro</SelectItem>
                    <SelectItem value="LIVRO">Livro</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={projectForm.status}
                  onValueChange={(v) =>
                    setProjectForm((prev) => ({ ...prev, status: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                    <SelectItem value="EM_PROGRESSO">Em progresso</SelectItem>
                    <SelectItem value="REVISAO">Revisão</SelectItem>
                    <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="number"
                  placeholder="Meta de palavras"
                  value={projectForm.goalWords}
                  onChange={(event) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      goalWords: Number(event.target.value),
                    }))
                  }
                />
                <Input
                  type="number"
                  placeholder="Palavras atuais"
                  value={projectForm.currentWords}
                  onChange={(event) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      currentWords: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Prazo de entrega (opcional)
                </label>
                <Input
                  type="date"
                  value={projectForm.dueDate}
                  onChange={(event) =>
                    setProjectForm((prev) => ({ ...prev, dueDate: event.target.value }))
                  }
                  className="rounded-2xl"
                />
              </div>
              <Input
                placeholder="Resumo do projeto"
                value={projectForm.summary}
                onChange={(event) =>
                  setProjectForm((prev) => ({ ...prev, summary: event.target.value }))
                }
              />
              <Select
                value={projectForm.documentId || '_none'}
                onValueChange={(v) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    documentId: v === '_none' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular documento (Bibliotheca)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Vincular documento (Bibliotheca)</SelectItem>
                  {(documentos || []).map((doc) => (
                    <SelectItem key={doc.id} value={String(doc.id)}>
                      {doc.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={projectForm.noteId || '_none'}
                onValueChange={(v) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    noteId: v === '_none' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular nota (Notepad)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Vincular nota (Notepad)</SelectItem>
                  {(notas || []).map((nota) => (
                    <SelectItem key={nota.id} value={String(nota.id)}>
                      {nota.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formError && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {formError}
                </p>
              )}
              <Button
                onClick={async () => {
                  if (!projectForm.title.trim()) {
                    setFormError('Informe o título do projeto.');
                    return;
                  }
                  setFormError(null);
                  setIsSaving(true);
                  try {
                    const response = await fetch('/api/scriptum/projects', {
                      method: editingProjectId ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...(editingProjectId ? { id: editingProjectId } : {}),
                        title: projectForm.title.trim(),
                        type: projectForm.type,
                        status: projectForm.status,
                        goalWords: Number(projectForm.goalWords),
                        currentWords: Number(projectForm.currentWords),
                        dueDate: projectForm.dueDate || null,
                        summary: projectForm.summary.trim() || null,
                        documentId: projectForm.documentId
                          ? Number(projectForm.documentId)
                          : null,
                        noteId: projectForm.noteId ? Number(projectForm.noteId) : null,
                      }),
                    });
                    if (!response.ok) {
                      const payload = await response.json();
                      throw new Error(payload?.error || 'Erro ao criar projeto');
                    }
                    resetProjectForm();
                    await mutate(projectsUrl);
                  } catch (error: any) {
                    setFormError(error?.message || 'Erro ao salvar projeto');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving || !projectForm.title.trim()}
              >
                {isSaving ? 'Salvando...' : editingProjectId ? 'Salvar projeto' : 'Adicionar projeto'}
              </Button>
              {editingProjectId ? (
                <Button type="button" variant="outline" onClick={resetProjectForm}>
                  Cancelar edição
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader className="gap-1">
              <CardTitle>Novo capítulo</CardTitle>
              <CardDescription>Requer projeto selecionado; POST /api/scriptum/chapters</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              <Input
                placeholder="Título do capítulo"
                value={chapterForm.title}
                onChange={(event) =>
                  setChapterForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="number"
                  placeholder="Posição"
                  value={chapterForm.position}
                  onChange={(event) =>
                    setChapterForm((prev) => ({
                      ...prev,
                      position: Number(event.target.value),
                    }))
                  }
                />
                <Input
                  type="number"
                  placeholder="Palavras"
                  value={chapterForm.wordCount}
                  onChange={(event) =>
                    setChapterForm((prev) => ({
                      ...prev,
                      wordCount: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <Select
                value={chapterForm.status}
                onValueChange={(v) =>
                  setChapterForm((prev) => ({ ...prev, status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EM_PROGRESSO">Em progresso</SelectItem>
                  <SelectItem value="REVISAO">Revisão</SelectItem>
                  <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={async () => {
                  if (!selectedProjectId) {
                    setFormError('Selecione um projeto antes de criar capítulos.');
                    return;
                  }
                  if (!chapterForm.title.trim()) {
                    setFormError('Informe o título do capítulo.');
                    return;
                  }
                  setFormError(null);
                  setIsSaving(true);
                  try {
                    const response = await fetch('/api/scriptum/chapters', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        projectId: selectedProjectId,
                        title: chapterForm.title.trim(),
                        status: chapterForm.status,
                        wordCount: Number(chapterForm.wordCount),
                        position: Number(chapterForm.position),
                      }),
                    });
                    if (!response.ok) {
                      const payload = await response.json();
                      throw new Error(payload?.error || 'Erro ao criar capítulo');
                    }
                    setChapterForm({
                      title: '',
                      status: 'EM_PROGRESSO',
                      wordCount: 0,
                      position: 1,
                    });
                    await mutate(
                      `/api/scriptum/chapters?projectId=${selectedProjectId}`,
                    );
                  } catch (error: any) {
                    setFormError(error?.message || 'Erro ao salvar capítulo');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving || !chapterForm.title.trim()}
              >
                {isSaving ? 'Salvando...' : 'Adicionar capítulo'}
              </Button>
            </CardContent>
          </Card>

          <Card className="atlas-surface atlas-hover">
            <CardHeader className="gap-1">
              <CardTitle>Ligações a outros módulos</CardTitle>
              <CardDescription>O que o código faz hoje nesta página</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/25">
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">Integrado na interface</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <strong>Bibliotheca</strong> — lista de documentos do time (<code className="rounded bg-white/80 px-1 dark:bg-slate-900/80">/api/bibliotheca/documents?limit=50</code>
                    ); ao gravar o projeto pode guardar <code className="rounded bg-white/80 px-1 dark:bg-slate-900/80">documentId</code>.
                  </li>
                  <li>
                    <strong>Notepad Pro</strong> — lista de notas (<code className="rounded bg-white/80 px-1 dark:bg-slate-900/80">/api/notepad/notes?limit=50</code>
                    ); opcional <code className="rounded bg-white/80 px-1 dark:bg-slate-900/80">noteId</code> no projeto.
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="font-semibold text-amber-950 dark:text-amber-200">Sem ligação automática aqui</p>
                <p className="mt-2 text-xs leading-relaxed">
                  <strong>Taskflow</strong>, <strong>Projectus</strong> e outros módulos <strong>não</strong> aparecem
                  nesta vista nem sincronizam capítulos ou tarefas por si. Use o Taskflow à parte se precisar de
                  checklists editoriais.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/bibliotheca">Bibliotheca</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/notepad">Notepad</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/manual/scriptum">Manual</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Use o Scriptum para escrever com consistência."
          tips={helpTips}
        />
      </div>
    </ModuleDashboardPageShell>
  );
}
