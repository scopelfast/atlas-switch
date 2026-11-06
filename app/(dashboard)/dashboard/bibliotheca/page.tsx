'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { AlertTriangle, FileStack, FolderGit2, Link2 } from 'lucide-react';
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

type Documento = {
  id: number;
  titulo: string;
  categoria: string;
  tamanho: string;
  status: string;
  visibility: string;
  tags?: string | null;
  description?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  source?: string | null;
  projectId?: number | null;
  taskId?: number | null;
  createdAt: string;
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

const rotuloStatus = (status: string) => {
  switch (status) {
    case 'ARQUIVADO':
      return 'Arquivado';
    case 'REVISAR':
      return 'Revisar';
    case 'ATIVO':
    default:
      return 'Ativo';
  }
};

export default function BibliothecaPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher, swrNoRetryOn403);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'bibliotheca.view');

  const [filters, setFilters] = useState({
    category: '',
    status: '',
    projectId: '',
  });

  const documentsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.status) params.set('status', filters.status);
    if (filters.projectId) params.set('projectId', filters.projectId);
    const query = params.toString();
    return query ? `/api/bibliotheca/documents?${query}` : '/api/bibliotheca/documents';
  }, [filters]);

  const { data: documentos, isLoading, error: documentosError } = useSWR<Documento[]>(
    documentsUrl,
    fetcher,
    swrNoRetryOn403,
  );
  const { data: projectusList, error: projectusError } = useSWR<ProjectusProject[]>(
    '/api/projectus/projects',
    fetcher,
    swrNoRetryOn403,
  );
  const documentosList = Array.isArray(documentos) ? documentos : [];
  const projectusRows = Array.isArray(projectusList) ? projectusList : [];
  const loadError = documentosError || null;
  const projectusIntegrationBlocked = Boolean(projectusError);

  const [formState, setFormState] = useState({
    title: '',
    category: 'Pesquisa',
    size: '1.0 MB',
    status: 'ATIVO',
    visibility: 'EQUIPE',
    tags: '',
    description: '',
    projectId: '',
    fileUrl: '',
    fileType: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<number | null>(null);
  const [pendingDeleteDocumentId, setPendingDeleteDocumentId] = useState<number | null>(null);

  const helpTips = isOwnerLike(role)
    ? [
        'Padronize categorias (Pesquisa, Jurídico, Portfólio, Financeiro ou nomes próprios) para filtros baterem com o cadastro.',
        'Preencha tamanho e categoria de forma coerente com o arquivo ou registro (a API exige os três campos).',
        'Use o vínculo ao Projectus quando o documento pertencer a um projeto do portfólio do time.',
      ]
    : [
        'Envie arquivos até 15 MB ou cole a URL após hospedar o arquivo em outro serviço.',
        'Tags curtas ajudam a localizar o registro na lista.',
        'Se aparecer acesso restrito, peça a permissão Bibliotheca — visualizar no Catálogo.',
      ];

  const projectusNomePorId = useMemo(() => {
    return new Map(projectusRows.map((row) => [row.id, row.nome]));
  }, [projectusRows]);

  const lista = documentosList;
  const totalComProjectus = lista.filter((d) => !!d.projectId).length;
  const totalRevisar = lista.filter((d) => d.status === 'REVISAR').length;
  const totalComArquivo = lista.filter((d) => !!(d.fileUrl || '').trim()).length;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ARQUIVADO':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
      case 'REVISAR':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
      default:
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes)) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
              Você não tem permissão para acessar o Bibliotheca.
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
            title="Bibliotheca"
            description="Catálogo de documentos do time: metadados (título, categoria, tamanho, status, visibilidade, tags, descrição), upload opcional para pasta pública (até 15 MB) ou URL manual, e vínculo opcional a um projeto do módulo Projectus. Lista e filtros usam GET /api/bibliotheca/documents; não há nesta página escolha de tarefa Taskflow nem vínculo automático ao BillTrak."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/bibliotheca">Manual</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScriptumStatCard
          variant="violet"
          icon={FileStack}
          title="Documentos na lista"
          description="Registros visíveis com os filtros atuais"
          value={lista.length}
          footnote="Categoria / status / projeto (Projectus)"
        />
        <ScriptumStatCard
          variant="indigo"
          icon={Link2}
          title="Vínculo Projectus"
          description="Documentos associados a um projeto do portfólio"
          value={totalComProjectus}
          footnote={
            projectusIntegrationBlocked
              ? 'Integração Projectus indisponível no plano ativo'
              : 'Campo opcional no formulário'
          }
        />
        <ScriptumStatCard
          variant="sky"
          icon={AlertTriangle}
          title="Em revisão"
          description="Status Revisar nesta vista"
          value={totalRevisar}
          footnote="Contagem no cliente sobre a lista filtrada"
        />
        <ScriptumStatCard
          variant="emerald"
          icon={FolderGit2}
          title="Com arquivo ou URL"
          description="Campo de URL preenchido após upload ou colagem manual"
          value={totalComArquivo}
          footnote="fileUrl gravado na base"
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
            Integração com Projectus indisponível neste plano. O Bibliotheca continua funcional sem vínculo de projeto.
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="atlas-surface atlas-hover">
            <CardHeader className="gap-1">
              <CardTitle>Documentos recentes</CardTitle>
              <CardDescription>
                Até 20 registros por pedido (limite padrão da API), ordenados pela data de criação. Parâmetros de filtro
                em{' '}
                <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">GET /api/bibliotheca/documents</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Select
                  value={filters.category || '_all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      category: v === '_all' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas as categorias</SelectItem>
                    <SelectItem value="Pesquisa">Pesquisa</SelectItem>
                    <SelectItem value="Jurídico">Jurídico</SelectItem>
                    <SelectItem value="Projetos">Portfólio</SelectItem>
                    <SelectItem value="Financeiro">Financeiro</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.status || '_all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: v === '_all' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos os status</SelectItem>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="REVISAR">Revisar</SelectItem>
                    <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
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
                      setFilters((prev) => ({
                        ...prev,
                        projectId: v === '_all' ? '' : v,
                      }))
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
                  Carregando documentos...
                </div>
              ) : documentosList.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhum documento encontrado com estes filtros.
                </div>
              ) : (
                documentosList.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      'atlas-item flex flex-col gap-2',
                      editingDocumentId === doc.id
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                        : '',
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="atlas-item-meta">
                          {doc.categoria}
                          {doc.projectId
                            ? ` • ${projectusNomePorId.get(doc.projectId) || 'Projeto Projectus'}`
                            : ''}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="atlas-item-title">{doc.titulo}</p>
                          {editingDocumentId === doc.id ? (
                            <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                              Em edição
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {doc.tags ? `Tags: ${doc.tags}` : 'Sem tags'} •{' '}
                          {doc.visibility === 'GESTAO' ? 'Gestão' : 'Equipe'}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className={`atlas-badge ${statusBadge(doc.status)}`}>
                          {rotuloStatus(doc.status)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{doc.tamanho}</span>
                      </div>
                    </div>
                    <EntityEditDeleteActions
                      onEdit={() => {
                        setEditingDocumentId(doc.id);
                        setFormState({
                          title: doc.titulo,
                          category: doc.categoria,
                          size: doc.tamanho,
                          status: doc.status,
                          visibility: doc.visibility,
                          tags: doc.tags || '',
                          description: doc.description || '',
                          projectId: doc.projectId ? String(doc.projectId) : '',
                          fileUrl: doc.fileUrl || '',
                          fileType: doc.fileType || '',
                        });
                      }}
                      onDelete={() => setPendingDeleteDocumentId(doc.id)}
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
              editingDocumentId
                ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10'
                : '',
            )}
          >
            <CardHeader className="gap-1">
              <CardTitle>{editingDocumentId ? 'Editar documento' : 'Novo documento'}</CardTitle>
              <CardDescription>
                A API exige <strong>título</strong>, <strong>categoria</strong> e <strong>tamanho</strong> em texto.
                Envio com{' '}
                <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">POST /api/bibliotheca/documents</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              <ConfirmActionBanner
                open={Boolean(pendingDeleteDocumentId)}
                title="Confirmar exclusão de documento"
                message="Excluir este documento?"
                confirmLabel="Excluir documento"
                cancelLabel="Cancelar"
                onCancel={() => setPendingDeleteDocumentId(null)}
                onConfirm={async () => {
                  if (!pendingDeleteDocumentId) return;
                  const res = await fetch(`/api/bibliotheca/documents?id=${pendingDeleteDocumentId}`, {
                    method: 'DELETE',
                  });
                  if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    setFormError(payload?.error || 'Erro ao excluir documento');
                    return;
                  }
                  if (editingDocumentId === pendingDeleteDocumentId) {
                    setEditingDocumentId(null);
                  }
                  setPendingDeleteDocumentId(null);
                  await mutate(documentsUrl);
                }}
              />
              {editingDocumentId ? (
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
                  placeholder="Categoria"
                  value={formState.category}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, category: event.target.value }))
                  }
                />
                <Input
                  placeholder="Tamanho (ex.: 1.2 MB)"
                  value={formState.size}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, size: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={formState.status}
                  onValueChange={(v) => setFormState((prev) => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="REVISAR">Revisar</SelectItem>
                    <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
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
                  </SelectContent>
                </Select>
              </div>
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
              <Input
                placeholder="Tags (separe por vírgula)"
                value={formState.tags}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, tags: event.target.value }))
                }
              />
              <Input
                placeholder="Descrição rápida"
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upload de arquivo</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  PDF, imagem ou outro tipo até 15 MB. O servidor grava em{' '}
                  <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">public/bibliotheca/</code> e
                  devolve URL relativa.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    id="bibliotheca-file"
                    type="file"
                    className="sr-only"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0] ?? null;
                      setUploadStatus(null);
                      setUploadFile(nextFile);
                    }}
                  />
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <label htmlFor="bibliotheca-file" className="cursor-pointer">
                      Escolher arquivo
                    </label>
                  </Button>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {uploadFile ? uploadFile.name : 'Nenhum arquivo selecionado'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={!uploadFile || isUploading}
                    onClick={async () => {
                      if (!uploadFile) return;
                      setIsUploading(true);
                      setUploadStatus('Enviando arquivo...');
                      try {
                        const payload = new FormData();
                        payload.append('file', uploadFile);
                        const response = await fetch('/api/bibliotheca/upload', {
                          method: 'POST',
                          body: payload,
                        });
                        if (!response.ok) {
                          const data = await response.json();
                          throw new Error(data?.error || 'Erro ao enviar arquivo');
                        }
                        const data = await response.json();
                        setFormState((prev) => ({
                          ...prev,
                          fileUrl: data.fileUrl || prev.fileUrl,
                          fileType: data.fileType || prev.fileType,
                          size: data.sizeBytes ? formatFileSize(data.sizeBytes) : prev.size,
                        }));
                        setUploadStatus('Arquivo enviado com sucesso.');
                        setUploadFile(null);
                      } catch (error: unknown) {
                        const msg = error instanceof Error ? error.message : 'Erro ao enviar arquivo';
                        setUploadStatus(msg);
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                  >
                    {isUploading ? 'Enviando...' : 'Fazer upload'}
                  </Button>
                </div>
                {uploadStatus ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{uploadStatus}</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="URL do arquivo (manual)"
                  value={formState.fileUrl}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, fileUrl: event.target.value }))
                  }
                />
                <Input
                  placeholder="Tipo MIME ou extensão"
                  value={formState.fileType}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, fileType: event.target.value }))
                  }
                />
              </div>
              {formError && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {formError}
                </p>
              )}
              <Button
                onClick={async () => {
                  if (!formState.title.trim()) {
                    setFormError('Informe o título do documento.');
                    return;
                  }
                  if (!formState.category.trim() || !formState.size.trim()) {
                    setFormError('Informe categoria e tamanho (a API exige os três campos).');
                    return;
                  }
                  setFormError(null);
                  setIsSaving(true);
                  try {
                    const response = await fetch('/api/bibliotheca/documents', {
                      method: editingDocumentId ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...(editingDocumentId ? { id: editingDocumentId } : {}),
                        titulo: formState.title.trim(),
                        categoria: formState.category.trim(),
                        tamanho: formState.size.trim(),
                        status: formState.status,
                        visibility: formState.visibility,
                        tags: formState.tags.trim() || null,
                        description: formState.description.trim() || null,
                        projectId: formState.projectId ? Number(formState.projectId) : null,
                        fileUrl: formState.fileUrl.trim() || null,
                        fileType: formState.fileType.trim() || null,
                      }),
                    });
                    if (!response.ok) {
                      const payload = await response.json();
                      throw new Error(payload?.error || 'Erro ao criar documento');
                    }
                    setFormState({
                      title: '',
                      category: 'Pesquisa',
                      size: '1.0 MB',
                      status: 'ATIVO',
                      visibility: 'EQUIPE',
                      tags: '',
                      description: '',
                      projectId: '',
                      fileUrl: '',
                      fileType: '',
                    });
                    setEditingDocumentId(null);
                    await mutate(documentsUrl);
                  } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : 'Erro ao salvar documento';
                    setFormError(msg);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving || !formState.title.trim()}
              >
                {isSaving ? 'Salvando...' : editingDocumentId ? 'Salvar documento' : 'Adicionar documento'}
              </Button>
              {editingDocumentId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingDocumentId(null);
                    setFormState({
                      title: '',
                      category: 'Pesquisa',
                      size: '1.0 MB',
                      status: 'ATIVO',
                      visibility: 'EQUIPE',
                      tags: '',
                      description: '',
                      projectId: '',
                      fileUrl: '',
                      fileType: '',
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
              <CardDescription>O que a base de dados e esta página suportam hoje.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
                <p className="font-medium text-slate-800 dark:text-slate-100">Projectus</p>
                <p className="mt-1 text-xs leading-relaxed">
                  <strong>Sim na UI:</strong> lista de projetos do time e campo opcional <code className="rounded bg-white/90 px-1 dark:bg-slate-800">projectId</code> ao criar o documento.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
                <p className="font-medium text-slate-800 dark:text-slate-100">Scriptum e Notepad</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Outros módulos podem referenciar documentos ou notas por ID. Esse fluxo configura-se no módulo de
                  destino (ex.: Scriptum escolhe documento na lista), não neste formulário.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2 w-full sm:w-auto">
                  <Link href="/dashboard/scriptum">Abrir Scriptum</Link>
                </Button>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
                <p className="font-medium text-slate-800 dark:text-slate-100">Taskflow e BillTrak</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Existe coluna <code className="rounded bg-white/90 px-1 dark:bg-slate-800">taskId</code> na tabela de
                  documentos e a API pode receber esse ID no JSON, mas <strong>esta página não mostra</strong> seletor de tarefa.
                  <strong> Não há</strong> envio automático de arquivos para o BillTrak a partir daqui.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/projectus">Projectus</Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/manual/bibliotheca">Manual completo</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Bibliotheca centraliza metadados e ligações; o arquivo pode ser enviado ou referenciado por URL."
          tips={helpTips}
        />
      </div>
    </ModuleDashboardPageShell>
  );
}
