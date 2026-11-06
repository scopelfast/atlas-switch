'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Clock3,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  GripVertical,
  AlertTriangle,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useFloatingFeedback } from '@/components/ui/floating-feedback';
import { Button } from '@/components/ui/button';
import { EntityEditDeleteActions } from '@/components/ui/entity-edit-delete-actions';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import {
  labelChipAppearance,
  normalizeLabelColorForApi,
  parseCanonicalHex,
  statusListRowLeftAccent,
} from '@/lib/taskflow/label-color';
import { TASKFLOW_FIXED_SITUATIONS } from '@/lib/taskflow/status-definition';
import { NATIVE_TASK_TYPES, taskTypeDisplayLabel } from '@/lib/taskflow/task-type';
import {
  datetimeLocalFromIso,
  formatDateTimePtShort,
  formatLocalDateKey,
  formatLocalDateKeyFromIso,
  isoFromDateTimeLocal,
} from '@/lib/taskflow/task-schedule';
import { isTaskflowStatusTerminal } from '@/lib/taskflow/task-terminal';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleHeader } from '@/components/ui/module-header';
import { ScriptumStatCard } from '@/components/scriptum/scriptum-stat-card';
import {
  ModuleSegmentedTabs,
  type ModuleSegmentedTabsItem,
} from '@/components/ui/module-segmented-tabs';
import {
  ModuleWorkspaceHub,
  moduleWorkspaceHubLinkClassName,
} from '@/components/ui/module-workspace-hub';
import { TaskflowInterventionPanel } from '@/components/taskflow/intervention-panel';
import {
  canConfigureTaskflowBoard,
  hasPermission,
  isOwnerLike,
  normalizeRole,
  type Role,
} from '@/lib/auth/permissions';
import { columnKanbanStripe } from '@/lib/taskflow/column-stripe';
import type { ColumnSlaBreach } from '@/lib/taskflow/column-sla';
import { phaseTypeLabelLoose } from '@/lib/taskflow/column-phase';
import { cn } from '@/lib/utils';
import { ACTION_COPY, actionDeleteOutlineClassName } from '@/lib/ui/action-copy';
import useSWR, { mutate as swrMutate } from 'swr';

const TASKFLOW_COLUMN_ACCENTS = [
  'border-t-violet-500',
  'border-t-cyan-500',
  'border-t-fuchsia-500',
  'border-t-amber-500',
] as const;

type TaskflowHubTab = 'operar' | 'nova_tarefa' | 'painel' | 'definicoes';

type TaskflowViewMode = 'kanban' | 'lista' | 'eisenhower' | 'calendar' | 'gantt';

const TASKFLOW_HUB_TAB_ITEMS: readonly ModuleSegmentedTabsItem<TaskflowHubTab>[] = [
  { value: 'operar', label: 'Operar' },
  { value: 'nova_tarefa', label: 'Nova tarefa' },
  { value: 'painel', label: 'Painel' },
  { value: 'definicoes', label: 'Definições' },
];

const TASKFLOW_VIEW_MODE_ITEMS: readonly ModuleSegmentedTabsItem<TaskflowViewMode>[] = [
  { value: 'kanban', label: 'Kanban', ariaLabel: 'Alternar para visualização Kanban' },
  { value: 'lista', label: 'Lista', ariaLabel: 'Alternar para visualização de lista' },
  { value: 'eisenhower', label: 'Eisenhower', ariaLabel: 'Alternar para matriz de Eisenhower' },
  { value: 'calendar', label: 'Calendário', ariaLabel: 'Alternar para calendário' },
  { value: 'gantt', label: 'Gantt', ariaLabel: 'Alternar para Gantt' },
];

type TaskflowColumn = {
  id: number;
  name: string;
  description: string | null;
  position: number;
  phaseType: string;
  maxStayHours: number | null;
  stripeColor: string | null;
};

type TaskflowTask = {
  id: number;
  columnId: number;
  /** E8.9 — tarefa pai (mesmo quadro). */
  parentTaskId?: number | null;
  /** E8.9 — sprint do time. */
  sprintId?: number | null;
  title: string;
  description: string | null;
  priority: string;
  taskType: string;
  statusId: number;
  dueDate: string | null;
  plannedStartAt?: string | null;
  estimatedDurationHours?: number | null;
  createdAt?: string | null;
  completedAt?: string | null;
  assigneeId?: number | null;
  /** M6.3 — ordem preservada; assigneeId permanece como primeiro (legado). */
  assigneeIds?: number[];
  projectId?: number | null;
  columnEnteredAt?: string | null;
  /** M6.6 — molde: regra + série; instâncias: occurrenceKey preenchido. */
  recurrenceRule?: string | null;
  recurrenceSeriesKey?: string | null;
  recurrenceOccurrenceKey?: string | null;
  recurrenceUntil?: string | null;
  /** M6.10 — `DONE` / `CANCELLED` no catálogo de status do time. */
  statusFixedSituation?: string | null;
  isTerminal?: boolean;
};

type TaskflowStatusDefinition = {
  id: number;
  teamId: number;
  code: string;
  name: string;
  description: string | null;
  fixedSituation: string;
  color: string;
  position: number;
};

type TaskflowTaskTypeDefinition = {
  id: number;
  teamId: number;
  code: string;
  name: string;
  description: string | null;
  position: number;
};

type TaskflowSprintRow = {
  id: number;
  teamId: number;
  name: string;
  startAt: string | null;
  endAt: string | null;
};

type TaskflowBoardData = {
  board: {
    id: number;
    name: string;
    description: string | null;
  };
  columns: TaskflowColumn[];
  tasks: TaskflowTask[];
  labels: TaskflowLabel[];
  taskLabels: TaskflowTaskLabel[];
  statusDefinitions?: TaskflowStatusDefinition[];
  taskTypeDefinitions?: TaskflowTaskTypeDefinition[];
  sprints?: TaskflowSprintRow[];
  slaBreaches?: ColumnSlaBreach[];
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

function taskAssigneeIds(task: TaskflowTask): number[] {
  if (task.assigneeIds && task.assigneeIds.length > 0) {
    return task.assigneeIds;
  }
  if (task.assigneeId != null) {
    return [task.assigneeId];
  }
  return [];
}

function taskflowTaskIsTerminal(
  task: TaskflowTask | undefined,
  defs?: TaskflowStatusDefinition[],
): boolean {
  if (!task) {
    return false;
  }
  if (task.isTerminal === true) {
    return true;
  }
  if (task.isTerminal === false) {
    return false;
  }
  const row = defs?.find((s) => s.id === task.statusId);
  return isTaskflowStatusTerminal(row?.fixedSituation);
}

function formatAssigneeNames(ids: number[], map: Map<number, string>): string {
  if (ids.length === 0) {
    return '';
  }
  return ids.map((id) => map.get(id) || `#${id}`).join(', ');
}

function formatAttachmentBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type TaskflowTaskAttachmentRow = {
  id: number;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
  uploadedById: number | null;
};

type ColumnWithTasks = TaskflowColumn & {
  tasks: TaskflowTask[];
};

type TaskflowLabel = {
  id: number;
  name: string;
  color: string;
  priority?: string;
};

type TaskflowTaskLabel = {
  taskId: number;
  labelId: number;
};

type ReunifyMeeting = {
  id: number;
  date: string;
  startTime: string;
  titulo: string;
  status: string;
};

type ChronosAgendaItem = {
  id: number;
  date: string;
  startTime: string;
  /** API Chronos devolve `title`; `titulo` é legado. */
  title?: string;
  titulo?: string;
  tipo?: string;
  type?: string;
};

type TaskflowNotification = {
  id: number;
  action: string;
  timestamp: string;
};

type ProjectusProject = {
  id: string;
  nome: string;
  status: string;
};

type TaskflowAdvancedRule = {
  id: number;
  name: string;
  enabled: boolean;
  dueInDays: number | null;
  priorityEquals: string | null;
  assigneeMissing: boolean;
  actionSetPriority: string | null;
  actionAssignCreator: boolean;
};

/**
 * Monta as colunas com as tarefas associadas para o Kanban.
 */
function buildColumnsWithTasks(columns: TaskflowColumn[], tasks: TaskflowTask[]) {
  const map = new Map<number, TaskflowTask[]>();
  tasks.forEach((task) => {
    if (!map.has(task.columnId)) {
      map.set(task.columnId, []);
    }
    map.get(task.columnId)?.push(task);
  });

  return columns.map((column) => ({
    ...column,
    tasks: map.get(column.id) || [],
  }));
}

/**
 * Cria um path SVG simples para o sparkline com base nos valores.
 */
function buildSparkline(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return '';
  }

  const max = Math.max(...values, 1);
  const step = width / (values.length - 1 || 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * height;
    return `${x},${y}`;
  });

  return `M ${points.join(' L ')}`;
}

/**
 * Define cor da prioridade para destacar visualmente.
 */
function recurrenceRuleUiLabel(code: string | null | undefined): string {
  if (!code) {
    return '';
  }
  const u = code.toUpperCase();
  if (u === 'DAILY') {
    return 'Diária';
  }
  if (u === 'WEEKLY') {
    return 'Semanal';
  }
  if (u === 'MONTHLY') {
    return 'Mensal';
  }
  return code;
}

function getPriorityStyle(priority: string) {
  switch (priority) {
    case 'URGENT':
      return 'bg-orange-500/15 text-orange-700 border-orange-500/35 dark:text-orange-300';
    case 'HIGH':
      return 'bg-rose-500/15 text-rose-600 border-rose-500/30';
    case 'LOW':
      return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
    default:
      return 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30';
  }
}

function getPriorityEdgeClass(priority: string) {
  switch (priority) {
    case 'URGENT':
      return 'border-l-orange-500';
    case 'HIGH':
      return 'border-l-rose-500';
    case 'LOW':
      return 'border-l-emerald-500';
    default:
      return 'border-l-violet-500';
  }
}

/**
 * Tradução amigável das prioridades para o operador.
 */
function getPriorityLabel(priority: string) {
  switch (priority) {
    case 'URGENT':
      return 'URGENTE';
    case 'HIGH':
      return 'ALTA';
    case 'LOW':
      return 'BAIXA';
    case 'MEDIUM':
      return 'MÉDIA';
    default:
      return 'PADRÃO';
  }
}

function formatDateForInput(value: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function diffInDays(start: Date, end: Date) {
  const oneDay = 1000 * 60 * 60 * 24;
  const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endMid.getTime() - startMid.getTime()) / oneDay);
}

function formatTaskflowAction(action: string) {
  switch (action) {
    case 'TASKFLOW_CREATE':
      return 'Nova tarefa criada';
    case 'TASKFLOW_UPDATE':
      return 'Tarefa atualizada';
    case 'TASKFLOW_MOVE':
      return 'Tarefa movida';
    case 'TASKFLOW_DELETE':
      return 'Tarefa removida';
    case 'TASKFLOW_ASSIGNED':
      return 'Foi atribuído a uma tarefa';
    default:
      return 'Atividade no Taskflow';
  }
}

function reorderTaskList(
  data: TaskflowBoardData,
  taskId: number,
  sourceColumnId: number,
  destinationColumnId: number,
  destinationIndex: number,
) {
  const byColumn = new Map<number, TaskflowTask[]>();
  data.columns.forEach((column) => {
    byColumn.set(
      column.id,
      data.tasks.filter((task) => task.columnId === column.id),
    );
  });

  const sourceTasks = byColumn.get(sourceColumnId) || [];
  const destTasks =
    sourceColumnId === destinationColumnId
      ? sourceTasks
      : byColumn.get(destinationColumnId) || [];

  const taskIndex = sourceTasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) {
    return data.tasks;
  }

  const [moved] = sourceTasks.splice(taskIndex, 1);
  moved.columnId = destinationColumnId;
  destTasks.splice(destinationIndex, 0, moved);

  if (sourceColumnId !== destinationColumnId) {
    byColumn.set(sourceColumnId, sourceTasks);
    byColumn.set(destinationColumnId, destTasks);
  }

  return data.columns.flatMap((column) => byColumn.get(column.id) || []);
}

function getColumnTaskIds(tasks: TaskflowTask[], columnId: number) {
  return tasks
    .filter((task) => task.columnId === columnId)
    .map((task) => task.id);
}

/** E8.9 — descendentes directos e indirectos (para evitar ciclo ao escolher pai). */
function collectDescendantTaskIds(rootId: number, tasks: TaskflowTask[]): Set<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const t of tasks) {
    const p = t.parentTaskId ?? null;
    if (p == null) continue;
    const arr = childrenByParent.get(p) ?? [];
    arr.push(t.id);
    childrenByParent.set(p, arr);
  }
  const out = new Set<number>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop() as number;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return out;
}

function formatSprintRangePt(s: TaskflowSprintRow): string {
  const a = s.startAt ? formatDateTimePtShort(s.startAt) : '—';
  const b = s.endAt ? formatDateTimePtShort(s.endAt) : '—';
  return `${a} → ${b}`;
}

/**
 * Página principal do módulo Taskflow.
 */
function taskflowActiveBoardStorageKey(teamId: number) {
  return `atlas-taskflow-active-board-${teamId}`;
}

export default function TaskflowPage() {
  const toast = useFloatingFeedback();
  const setError = useCallback(
    (message: string | null) => {
      if (message) {
        toast.showError(message);
      } else {
        toast.dismiss();
      }
    },
    [toast],
  );
  const [data, setData] = useState<TaskflowBoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [boardSummaries, setBoardSummaries] = useState<
    { id: number; name: string; updatedAt: string | null }[]
  >([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSourceId, setTemplateSourceId] = useState<number | ''>('');
  const [templateNewName, setTemplateNewName] = useState('');
  const [templateCopyLabels, setTemplateCopyLabels] = useState(true);
  const [boardUiBusy, setBoardUiBusy] = useState(false);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const templateClientRequestIdRef = useRef('');
  const boardPrefsHydratedForTeam = useRef<number | null>(null);
  const { data: user } = useSWR<{
    id?: number;
    role?: Role;
    taskflowTtsNotificationsEnabled?: boolean;
  }>('/api/user', fetcher);
  const { data: team } = useSWR<{
    id?: number;
    teamMembers?: { user: { id: number; name: string | null; email: string } }[];
    taskflowAssistSuggestionsEnabled?: boolean;
    taskflowSemanticSearchEnabled?: boolean;
    taskflowPublicPortalEnabled?: boolean;
    taskflowPublicPortalSlug?: string | null;
    taskflowPublicPortalColumnId?: number | null;
    taskflowTtsNotificationsAllowed?: boolean;
  }>('/api/team', fetcher);
  const { data: meetings } = useSWR<ReunifyMeeting[]>(
    '/api/reunify/meetings',
    fetcher,
  );
  const { data: agendaItems } = useSWR<ChronosAgendaItem[]>(
    '/api/chronos/agenda',
    fetcher,
  );
  const { data: projects, error: projectsError } = useSWR<ProjectusProject[]>(
    '/api/projectus/projects',
    fetcher,
    swrNoRetryOn403,
  );
  const projectsList = Array.isArray(projects) ? projects : [];
  const projectusIntegrationBlocked = Boolean(
    projectsError?.message?.toLowerCase().includes('não está habilitado no plano ativo'),
  );
  const projectusIntegrationError =
    projectsError && !projectusIntegrationBlocked ? projectsError : null;
  const { data: automation, mutate: mutateAutomation } = useSWR<{
    autoAssignCreator: boolean;
    autoHighPriorityOnDue: boolean;
  }>('/api/taskflow/automation', fetcher);
  const { data: advancedRules, mutate: mutateAdvancedRules } = useSWR<
    TaskflowAdvancedRule[]
  >('/api/taskflow/automation-rules', fetcher);
  const { data: notifications } = useSWR<TaskflowNotification[]>(
    '/api/taskflow/notifications',
    fetcher,
  );
  const { data: metrics } = useSWR<{
    cycleTimeAvg: number;
    bottleneckColumnId: number | null;
    bottleneckDays: number;
  }>('/api/taskflow/metrics', fetcher);
  const [dailyAddTaskValue, setDailyAddTaskValue] = useState('_none');
  const [dailyChecklistDate, setDailyChecklistDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const dailyChecklistKey = `/api/taskflow/daily-checklist?date=${dailyChecklistDate}`;
  const { data: dailyChecklistItems, mutate: mutateDailyChecklist } = useSWR<
    { id: number; taskId: number; taskTitle: string; taskPriority: string; checked: boolean }[]
  >(dailyChecklistKey, fetcher);

  const assistSwrKey =
    user?.id != null && hasPermission((user.role || 'member') as Role, 'taskflow.view')
      ? '/api/taskflow/assist-suggestions'
      : null;
  const {
    data: assistSuggestions,
    mutate: mutateAssistSuggestions,
    isLoading: assistSuggestionsLoading,
  } = useSWR<
    | {
        optedIn: false;
        disclaimer: null;
        prioritySuggestions: null;
        reassignSuggestions: null;
      }
    | {
        optedIn: true;
        disclaimer: string;
        prioritySuggestions: {
          taskId: number;
          title: string;
          currentPriority: string;
          suggestedPriority: string;
          reason: string;
        }[];
        reassignSuggestions: {
          taskId: number;
          title: string;
          fromUserName: string;
          toUserId: number;
          toUserName: string;
          reason: string;
        }[];
      }
  >(assistSwrKey, fetcher);

  const semanticStatusSwrKey = assistSwrKey ? '/api/taskflow/semantic-search/status' : null;
  const { data: semanticStatus, mutate: mutateSemanticStatus } = useSWR<{
    teamEnabled: boolean;
    indexedTaskCount: number;
    canBuildIndex: boolean;
  }>(semanticStatusSwrKey, fetcher);

  const cloudAiStatusSwrKey = assistSwrKey ? '/api/taskflow/cloud-ai-status' : null;
  const { data: cloudAiStatus, mutate: mutateCloudAiStatus } = useSWR<{
    periodYm: string;
    teamEnabled: boolean;
    provider: 'openai' | 'gemini' | null;
    monthlyRequestCap: number;
    usage: { requests: number; promptTokens: number; completionTokens: number };
    platform: { openai: boolean; gemini: boolean };
    envConfigured: { openai: boolean; gemini: boolean };
    ready: boolean;
    blockReason: string | null;
  }>(cloudAiStatusSwrKey, fetcher);

  const [assistOptInBusy, setAssistOptInBusy] = useState(false);
  const [semanticOptInBusy, setSemanticOptInBusy] = useState(false);
  const [semanticSyncBusy, setSemanticSyncBusy] = useState(false);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticSearchBusy, setSemanticSearchBusy] = useState(false);
  const [semanticHits, setSemanticHits] = useState<
    { taskId: number; title: string; distance: number }[] | null
  >(null);
  const [semanticSearchMsg, setSemanticSearchMsg] = useState<string | null>(null);
  const [cloudAiOptBusy, setCloudAiOptBusy] = useState(false);
  const [cloudAiCapBusy, setCloudAiCapBusy] = useState(false);
  const [cloudAiProviderDraft, setCloudAiProviderDraft] = useState<'openai' | 'gemini'>('openai');
  const [cloudAiCapDraft, setCloudAiCapDraft] = useState('100');
  const [cloudAiPrompt, setCloudAiPrompt] = useState('');
  const [cloudAiTestBusy, setCloudAiTestBusy] = useState(false);
  const [cloudAiTestError, setCloudAiTestError] = useState<string | null>(null);
  const [cloudAiTestOutput, setCloudAiTestOutput] = useState<string | null>(null);

  /** Instância com toggle + chave para o fornecedor escolhido no formulário (antes de ligar a equipe). */
  const cloudAiKeysReadyForDraft = useMemo(() => {
    if (!cloudAiStatus) return false;
    return cloudAiProviderDraft === 'openai'
      ? cloudAiStatus.platform.openai && cloudAiStatus.envConfigured.openai
      : cloudAiStatus.platform.gemini && cloudAiStatus.envConfigured.gemini;
  }, [cloudAiStatus, cloudAiProviderDraft]);

  const webhooksSwrKey =
    data && canConfigureTaskflowBoard((user?.role || 'member') as Role)
      ? '/api/taskflow/webhooks'
      : null;
  const { data: webhooksList, mutate: mutateWebhooks } = useSWR<
    {
      id: number;
      name: string;
      targetUrl: string;
      events: string;
      enabled: boolean;
      hasSecret: boolean;
    }[]
  >(webhooksSwrKey, fetcher);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whSecret, setWhSecret] = useState('');
  const [whEvents, setWhEvents] = useState('task.created,task.updated');
  const [whSampleUrl, setWhSampleUrl] = useState<string | null>(null);
  const [whSampleBusy, setWhSampleBusy] = useState(false);
  const devIntegrationSwrKey =
    data && canConfigureTaskflowBoard((user?.role || 'member') as Role)
      ? '/api/team/taskflow-dev-integration'
      : null;
  const { data: devIntegrationConfig, mutate: mutateDevIntegration } = useSWR<{
    configured: boolean;
    inboundPath: string;
    headerName: string;
  }>(devIntegrationSwrKey, fetcher);
  const [devSecretShown, setDevSecretShown] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalColumnSelect, setPortalColumnSelect] = useState('');

  const portalSubmissionsKey =
    data && canConfigureTaskflowBoard((user?.role || 'member') as Role)
      ? '/api/taskflow/portal-submissions'
      : null;
  const { data: portalQueue, mutate: mutatePortalQueue } = useSWR<
    {
      id: number;
      title: string;
      description: string | null;
      submitterName: string | null;
      submitterEmail: string | null;
      createdAt: string;
    }[]
  >(portalSubmissionsKey, fetcher);

  useEffect(() => {
    if (!data?.columns?.length) return;
    const tid = team?.taskflowPublicPortalColumnId;
    if (tid != null && data.columns.some((c) => c.id === tid)) {
      setPortalColumnSelect(String(tid));
      return;
    }
    setPortalColumnSelect(String(data.columns[0].id));
  }, [data?.columns, team?.taskflowPublicPortalColumnId]);

  useEffect(() => {
    if (!cloudAiStatus) return;
    if (cloudAiStatus.provider === 'openai' || cloudAiStatus.provider === 'gemini') {
      setCloudAiProviderDraft(cloudAiStatus.provider);
    }
    setCloudAiCapDraft(String(cloudAiStatus.monthlyRequestCap ?? 100));
  }, [cloudAiStatus]);

  const ttsSkipFirstRef = useRef(true);
  const ttsLastTeamIdRef = useRef<number | undefined>(undefined);
  const ttsLastNotifIdRef = useRef<number | null>(null);
  const ttsRateHitsRef = useRef<number[]>([]);

  useEffect(() => {
    const tid = team?.id;
    if (tid !== ttsLastTeamIdRef.current) {
      ttsLastTeamIdRef.current = tid;
      ttsSkipFirstRef.current = true;
      ttsLastNotifIdRef.current = null;
      ttsRateHitsRef.current = [];
    }
  }, [team?.id]);

  useEffect(() => {
    const teamAllows = Boolean(team?.taskflowTtsNotificationsAllowed);
    const userEnabled = Boolean(user?.taskflowTtsNotificationsEnabled);
    if (!teamAllows || !userEnabled || !notifications?.length) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const top = notifications[0];
    if (ttsSkipFirstRef.current) {
      ttsSkipFirstRef.current = false;
      ttsLastNotifIdRef.current = top.id;
      return;
    }
    if (top.id === ttsLastNotifIdRef.current) return;

    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const maxPerWindow = 8;
    const recent = ttsRateHitsRef.current.filter((t) => now - t < windowMs);
    ttsRateHitsRef.current = recent;
    if (recent.length >= maxPerWindow) return;
    recent.push(now);

    ttsLastNotifIdRef.current = top.id;
    const text = formatTaskflowAction(top.action);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [
    team?.taskflowTtsNotificationsAllowed,
    user?.taskflowTtsNotificationsEnabled,
    notifications,
    /* formatTaskflowAction é estável no módulo */
    formatTaskflowAction,
  ]);

  const role = (user?.role || 'member') as Role;
  const canView = hasPermission(role, 'taskflow.view');

  /**
   * Dicas personalizadas conforme perfil do usuário.
   */
  const helpTips =
    isOwnerLike(role)
      ? [
        'Use as abas Operar, Nova tarefa, Painel e Definições para separar quadro, captura de ideias, métricas e configuração.',
        'Configure colunas para refletir o fluxo da equipe.',
        'Use métricas para priorizar entregas.',
      ]
      : [
        'Operar: quadro; Nova tarefa: formulário de criação; Painel: indicadores e checklist; Definições: automações (se tiver permissão).',
        'Crie tarefas claras e objetivas.',
        'Mantenha prioridades atualizadas.',
      ];

  if (user && !canView) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você não tem permissão para acessar o Taskflow.
            </p>
          </CardContent>
        </Card>
        <HelpPanel
          title="Ajuda rápida"
          description="Se precisar deste acesso, fale com o gestor."
          tips={helpTips}
        />
      </div>
    );
  }

  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('generic');
  const [columnId, setColumnId] = useState<number | null>(null);
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [newRecurrenceRule, setNewRecurrenceRule] = useState('_none');
  const [newRecurrenceUntil, setNewRecurrenceUntil] = useState('');
  const [plannedStartLocal, setPlannedStartLocal] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  /** E8.9 */
  const [createParentTaskId, setCreateParentTaskId] = useState<number | null>(null);
  const [createSprintId, setCreateSprintId] = useState<number | null>(null);
  const [sprintFilterId, setSprintFilterId] = useState<number | null>(null);
  const [collapsedEpicIds, setCollapsedEpicIds] = useState<number[]>([]);
  const [editParentTaskId, setEditParentTaskId] = useState<number | null>(null);
  const [editSprintId, setEditSprintId] = useState<number | null>(null);
  const [newSprintPanelOpen, setNewSprintPanelOpen] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintStartAt, setNewSprintStartAt] = useState('');
  const [newSprintEndAt, setNewSprintEndAt] = useState('');
  const [isCreatingSprint, setIsCreatingSprint] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('indigo');
  const [newLabelHex, setNewLabelHex] = useState('');
  const [newLabelPriority, setNewLabelPriority] = useState('MEDIUM');
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editLabelName, setEditLabelName] = useState('');
  const [editLabelColor, setEditLabelColor] = useState('indigo');
  const [editLabelHex, setEditLabelHex] = useState('');
  const [editLabelPriority, setEditLabelPriority] = useState('MEDIUM');
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null);
  const [editColumnName, setEditColumnName] = useState('');
  const [editColumnDescription, setEditColumnDescription] = useState('');
  const [editColumnPhaseType, setEditColumnPhaseType] = useState('PRODUCTION');
  const [editColumnMaxStay, setEditColumnMaxStay] = useState('');
  const [editColumnStripe, setEditColumnStripe] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnDescription, setNewColumnDescription] = useState('');
  const [newColumnPhaseType, setNewColumnPhaseType] = useState('PRODUCTION');
  const [newColumnMaxStay, setNewColumnMaxStay] = useState('');
  const [newColumnStripe, setNewColumnStripe] = useState('');
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleDueDays, setNewRuleDueDays] = useState('');
  const [newRulePriority, setNewRulePriority] = useState('ANY');
  const [newRuleAssigneeMissing, setNewRuleAssigneeMissing] = useState(false);
  const [newRuleSetPriority, setNewRuleSetPriority] = useState('HIGH');
  const [newRuleAssignCreator, setNewRuleAssignCreator] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewMode, setViewMode] = useState<TaskflowViewMode>('kanban');
  const [hubTab, setHubTab] = useState<TaskflowHubTab>('operar');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [columnFilter, setColumnFilter] = useState('ALL');
  const [dueDateFilter, setDueDateFilter] = useState('');
  const [taskTypeFilter, setTaskTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('_all');
  const [assigneeFilter, setAssigneeFilter] = useState('_all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [dynamicSort, setDynamicSort] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editColumnId, setEditColumnId] = useState<number | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editPlannedStart, setEditPlannedStart] = useState('');
  const [editEstimatedHours, setEditEstimatedHours] = useState('');
  const [editAssigneeIds, setEditAssigneeIds] = useState<number[]>([]);
  const [editLabelIds, setEditLabelIds] = useState<number[]>([]);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);
  const [editStatusId, setEditStatusId] = useState<number | null>(null);
  const [editTaskType, setEditTaskType] = useState('generic');
  const [editRecurrenceRule, setEditRecurrenceRule] = useState('_none');
  const [editRecurrenceUntil, setEditRecurrenceUntil] = useState('');
  const [createStatusId, setCreateStatusId] = useState<number | null>(null);
  const [editingStatusDefId, setEditingStatusDefId] = useState<number | null>(null);
  const [editStatName, setEditStatName] = useState('');
  const [editStatDescription, setEditStatDescription] = useState('');
  const [editStatColor, setEditStatColor] = useState('');
  const [editStatPosition, setEditStatPosition] = useState('');
  const [newStatCode, setNewStatCode] = useState('');
  const [newStatName, setNewStatName] = useState('');
  const [newStatFixed, setNewStatFixed] = useState('OPEN');
  const [newStatDescription, setNewStatDescription] = useState('');
  const [newStatColor, setNewStatColor] = useState('indigo');
  const [editingTaskTypeDefId, setEditingTaskTypeDefId] = useState<number | null>(null);
  const [editTtName, setEditTtName] = useState('');
  const [editTtDescription, setEditTtDescription] = useState('');
  const [editTtPosition, setEditTtPosition] = useState('');
  const [newTtCode, setNewTtCode] = useState('');
  const [newTtName, setNewTtName] = useState('');
  const [newTtDescription, setNewTtDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [editTaskAttachments, setEditTaskAttachments] = useState<TaskflowTaskAttachmentRow[]>([]);
  const [editAttachmentsLoading, setEditAttachmentsLoading] = useState(false);
  const [editAttachmentUploading, setEditAttachmentUploading] = useState(false);
  const editAttachmentInputRef = useRef<HTMLInputElement>(null);

  /**
   * Carrega o board do Taskflow com colunas e tarefas.
   */
  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      try {
        await fetch('/api/taskflow/recurrence/materialize', { method: 'POST' });
      } catch {
        /* materialização é best-effort */
      }
      const boardQuery =
        selectedBoardId != null && selectedBoardId > 0
          ? `?boardId=${encodeURIComponent(String(selectedBoardId))}`
          : '';
      const response = await fetch(`/api/taskflow/boards${boardQuery}`);
      if (!response.ok) {
        if (response.status === 404 && team?.id) {
          try {
            localStorage.removeItem(taskflowActiveBoardStorageKey(team.id));
          } catch {
            /* ignore */
          }
          setSelectedBoardId(null);
        }
        let detail = '';
        try {
          const j = (await response.json()) as { error?: string };
          detail = typeof j?.error === 'string' ? j.error : '';
        } catch {
          detail = response.statusText || '';
        }
        throw new Error(
          detail
            ? `Não foi possível carregar o Taskflow (HTTP ${response.status}): ${detail}`
            : `Não foi possível carregar o Taskflow (HTTP ${response.status}).`,
        );
      }
      const payload: TaskflowBoardData = await response.json();
      setData(payload);
      setColumnId((prev) => {
        if (!payload?.columns?.length) {
          return prev;
        }
        const ids = new Set(payload.columns.map((c) => c.id));
        if (prev != null && ids.has(prev)) {
          return prev;
        }
        return payload.columns[0].id;
      });
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBoardId, team?.id]);

  /**
   * Cria uma nova tarefa a partir do formulário rápido.
   */
  async function handleCreateTask() {
    if (!data || !columnId || !title.trim()) {
      return;
    }
    if (!dueDate) {
      setError('Defina o prazo para criar a tarefa.');
      return;
    }

    const dueIso = isoFromDateTimeLocal(dueDate);
    if (!dueIso) {
      setError('Prazo de entrega inválido.');
      return;
    }
    const plannedIso = isoFromDateTimeLocal(plannedStartLocal);
    const estTrim = estimatedHours.trim();
    let estimatedDurationHours: number | null = null;
    if (estTrim) {
      const n = Number(estTrim.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        setError('Duração estimada inválida (use horas, ex.: 2 ou 1,5).');
        return;
      }
      estimatedDurationHours = n === 0 ? null : n;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/taskflow/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: data.board.id,
          columnId,
          projectId,
          title: title.trim(),
          priority,
          dueDate: dueIso,
          plannedStartAt: plannedIso,
          estimatedDurationHours,
          assigneeIds,
          taskType,
          ...(createParentTaskId != null ? { parentTaskId: createParentTaskId } : {}),
          ...(createSprintId != null ? { sprintId: createSprintId } : {}),
          ...(createStatusId ? { statusId: createStatusId } : {}),
          ...(newRecurrenceRule !== '_none'
            ? {
                recurrenceRule: newRecurrenceRule,
                ...(newRecurrenceUntil.trim()
                  ? {
                      recurrenceUntil: isoFromDateTimeLocal(newRecurrenceUntil),
                    }
                  : {}),
              }
            : {}),
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao criar a tarefa');
      }

      const created = await response.json();
      if (selectedLabelIds.length > 0) {
        await fetch('/api/taskflow/task-labels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: created.id,
            labelIds: selectedLabelIds,
          }),
        });
      }

      setTitle('');
      setTaskType('generic');
      setPriority('MEDIUM');
      setDueDate('');
      setNewRecurrenceRule('_none');
      setNewRecurrenceUntil('');
      setPlannedStartLocal('');
      setEstimatedHours('');
      setAssigneeIds([]);
      setProjectId(null);
      setCreateParentTaskId(null);
      setCreateSprintId(null);
      setSelectedLabelIds([]);
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar tarefa');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCreateSprint() {
    if (!newSprintName.trim()) {
      setError('Indique o nome da sprint.');
      return;
    }
    const startIso = isoFromDateTimeLocal(newSprintStartAt);
    const endIso = isoFromDateTimeLocal(newSprintEndAt);
    if (!startIso || !endIso) {
      setError('Defina início e fim da sprint (data e hora).');
      return;
    }
    setIsCreatingSprint(true);
    setError(null);
    try {
      const response = await fetch('/api/taskflow/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSprintName.trim(),
          startAt: startIso,
          endAt: endIso,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof (payload as { error?: string })?.error === 'string'
            ? (payload as { error: string }).error
            : 'Falha ao criar sprint',
        );
      }
      const row = payload as { id?: number };
      setNewSprintName('');
      setNewSprintStartAt('');
      setNewSprintEndAt('');
      setNewSprintPanelOpen(false);
      if (typeof row?.id === 'number') {
        setCreateSprintId(row.id);
        setSprintFilterId(row.id);
      }
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar sprint');
    } finally {
      setIsCreatingSprint(false);
    }
  }

  async function handleQuickImport(
    titleValue: string,
    sourceLabel = 'outro módulo',
    extras?: { projectId?: number },
  ) {
    if (!data || !columnId) {
      return;
    }
    if (!user?.id) {
      toast.showError('Sessão inválida: inicie sessão novamente para criar tarefas.');
      return;
    }
    setIsCreating(true);
    toast.dismiss();
    try {
      const due = new Date();
      due.setDate(due.getDate() + 7);
      due.setHours(18, 0, 0, 0);
      const dueIso = due.toISOString();

      const response = await fetch('/api/taskflow/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: data.board.id,
          columnId,
          title: titleValue,
          priority: 'MEDIUM',
          taskType: 'generic',
          dueDate: dueIso,
          assigneeIds: [user.id],
          ...(extras?.projectId != null ? { projectId: extras.projectId } : {}),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Falha ao criar a tarefa',
        );
      }

      await loadBoard();
      toast.showSuccess(`Ação concluída: item de ${sourceLabel} convertido em tarefa no Taskflow.`);
    } catch (err: any) {
      const detail = err?.message ? String(err.message) : 'Revise permissões e tente novamente.';
      toast.showError(
        `Falha ao sincronizar item de ${sourceLabel} no Taskflow. ${detail}`,
        'Integração',
      );
    } finally {
      setIsCreating(false);
    }
  }

  useLayoutEffect(() => {
    if (!canView || team?.id == null) {
      boardPrefsHydratedForTeam.current = null;
      return;
    }
    const tid = team.id;
    if (boardPrefsHydratedForTeam.current === tid) {
      return;
    }
    boardPrefsHydratedForTeam.current = tid;
    try {
      const raw = localStorage.getItem(taskflowActiveBoardStorageKey(tid));
      const n = raw ? Number(raw) : NaN;
      setSelectedBoardId(Number.isFinite(n) && n > 0 ? n : null);
    } catch {
      setSelectedBoardId(null);
    }
  }, [canView, team?.id]);

  useEffect(() => {
    if (!canView) {
      return;
    }
    void loadBoard();
  }, [canView, loadBoard]);

  useEffect(() => {
    if (!canView) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/taskflow/boards?list=1');
        const j = (await r.json()) as {
          boards?: { id: number; name: string; updatedAt: string | null }[];
        };
        if (!cancelled && r.ok && Array.isArray(j.boards)) {
          setBoardSummaries(j.boards);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  useEffect(() => {
    if (team?.id == null || boardSummaries.length === 0 || selectedBoardId == null) {
      return;
    }
    if (!boardSummaries.some((b) => b.id === selectedBoardId)) {
      try {
        localStorage.removeItem(taskflowActiveBoardStorageKey(team.id));
      } catch {
        /* ignore */
      }
      setSelectedBoardId(null);
    }
  }, [team?.id, boardSummaries, selectedBoardId]);

  useEffect(() => {
    if (selectedBoardId == null || selectedBoardId <= 0) {
      return;
    }
    try {
      const raw = localStorage.getItem(`taskflow-hub-tab-${selectedBoardId}`);
      if (
        raw === 'operar' ||
        raw === 'nova_tarefa' ||
        raw === 'painel' ||
        raw === 'definicoes'
      ) {
        setHubTab(raw);
      } else {
        setHubTab('operar');
      }
    } catch {
      setHubTab('operar');
    }
  }, [selectedBoardId]);

  useEffect(() => {
    const defs = data?.statusDefinitions;
    if (!defs?.length) {
      return;
    }
    const open = defs.find((s) => s.fixedSituation === 'OPEN');
    const pick = open?.id ?? defs[0].id;
    setCreateStatusId((prev) => (prev === null ? pick : prev));
  }, [data?.statusDefinitions]);

  useEffect(() => {
    if (!editingTaskId || !canView) {
      setEditTaskAttachments([]);
      return;
    }
    let cancelled = false;
    setEditAttachmentsLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/taskflow/tasks/${editingTaskId}/attachments`);
        const json = await r.json();
        if (!cancelled && r.ok && Array.isArray(json.attachments)) {
          setEditTaskAttachments(json.attachments as TaskflowTaskAttachmentRow[]);
        } else if (!cancelled && r.ok) {
          setEditTaskAttachments([]);
        }
      } catch {
        if (!cancelled) {
          setEditTaskAttachments([]);
        }
      } finally {
        if (!cancelled) {
          setEditAttachmentsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingTaskId, canView]);

  const statusById = useMemo(() => {
    const map = new Map<number, TaskflowStatusDefinition>();
    (data?.statusDefinitions || []).forEach((s) => map.set(s.id, s));
    return map;
  }, [data?.statusDefinitions]);

  const taskTypeCustomRows = useMemo(
    () => data?.taskTypeDefinitions ?? [],
    [data?.taskTypeDefinitions],
  );

  const taskTypeFilterOptions = useMemo(() => {
    const byCode = new Map<string, string>();
    for (const native of NATIVE_TASK_TYPES) {
      byCode.set(native.code, native.label);
    }
    for (const row of taskTypeCustomRows) {
      if (!byCode.has(row.code)) {
        byCode.set(row.code, row.name);
      }
    }
    return Array.from(byCode.entries()).map(([code, name]) => ({ code, name }));
  }, [taskTypeCustomRows]);

  const labelsById = useMemo(() => {
    const map = new Map<number, TaskflowLabel>();
    data?.labels?.forEach((label) => map.set(label.id, label));
    return map;
  }, [data]);

  const teamMemberMap = useMemo(() => {
    const map = new Map<number, string>();
    team?.teamMembers?.forEach((member) => {
      map.set(member.user.id, member.user.name || member.user.email);
    });
    return map;
  }, [team]);

  const bottleneckColumnName = useMemo(() => {
    if (!metrics?.bottleneckColumnId) {
      return null;
    }
    return (
      data?.columns?.find((column) => column.id === metrics.bottleneckColumnId)
        ?.name || null
    );
  }, [data, metrics]);

  const labelIdsByTask = useMemo(() => {
    const map = new Map<number, number[]>();
    data?.taskLabels?.forEach((entry) => {
      if (!map.has(entry.taskId)) {
        map.set(entry.taskId, []);
      }
      map.get(entry.taskId)?.push(entry.labelId);
    });
    return map;
  }, [data]);

  const columnMap = useMemo(() => {
    const map = new Map<number, TaskflowColumn>();
    data?.columns?.forEach((column) => map.set(column.id, column));
    return map;
  }, [data]);

  const taskByIdMap = useMemo(() => {
    const m = new Map<number, TaskflowTask>();
    for (const t of data?.tasks || []) {
      m.set(t.id, t);
    }
    return m;
  }, [data?.tasks]);

  const excludedParentIdsForEdit = useMemo(() => {
    if (editingTaskId == null || !data?.tasks?.length) {
      return new Set<number>();
    }
    const s = collectDescendantTaskIds(editingTaskId, data.tasks);
    s.add(editingTaskId);
    return s;
  }, [editingTaskId, data?.tasks]);

  const sprintById = useMemo(() => {
    const m = new Map<number, TaskflowSprintRow>();
    for (const sp of data?.sprints || []) {
      m.set(sp.id, sp);
    }
    return m;
  }, [data?.sprints]);

  const filteredTasks = useMemo(() => {
    let pool = data?.tasks || [];
    if (sprintFilterId != null && Number.isFinite(sprintFilterId)) {
      pool = pool.filter((t) => (t.sprintId ?? null) === sprintFilterId);
    }
    const hiddenByCollapsedEpic = (task: TaskflowTask): boolean => {
      let pid = task.parentTaskId ?? null;
      while (pid != null) {
        if (collapsedEpicIds.includes(pid)) {
          return true;
        }
        const p = taskByIdMap.get(pid);
        if (!p) {
          break;
        }
        pid = p.parentTaskId ?? null;
      }
      return false;
    };
    return pool.filter((task) => {
      if (hiddenByCollapsedEpic(task)) {
        return false;
      }
      const typeLabel = taskTypeDisplayLabel(task.taskType || 'generic', taskTypeCustomRows);
      const matchesSearch = search
        ? `${task.title} ${task.description || ''} ${typeLabel}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true;
      const matchesPriority =
        priorityFilter === 'ALL' ? true : task.priority === priorityFilter;
      const matchesColumn =
        columnFilter === 'ALL' ? true : task.columnId === Number(columnFilter);
      const dueDateKey = task.dueDate ? formatLocalDateKeyFromIso(task.dueDate) : '';
      const matchesDueDate = dueDateFilter ? dueDateKey !== '' && dueDateKey <= dueDateFilter : true;
      const matchesTaskType = taskTypeFilter === 'ALL' ? true : (task.taskType || 'generic') === taskTypeFilter;
      const matchesStatus = statusFilter === 'ALL' ? true : task.statusId === Number(statusFilter);
      const matchesProject =
        projectFilter === '_all'
          ? true
          : projectFilter === '_none'
            ? task.projectId == null
            : String(task.projectId ?? '') === projectFilter;
      const assigneeIdsForTask = taskAssigneeIds(task);
      const matchesAssignee =
        assigneeFilter === '_all'
          ? true
          : assigneeFilter === '_none'
            ? assigneeIdsForTask.length === 0
            : assigneeIdsForTask.includes(Number(assigneeFilter));
      const isOverdue = task.dueDate
        ? new Date(task.dueDate).getTime() < Date.now()
        : false;
      const matchesOverdue = showOverdueOnly ? isOverdue : true;

      return (
        matchesSearch &&
        matchesPriority &&
        matchesColumn &&
        matchesDueDate &&
        matchesTaskType &&
        matchesStatus &&
        matchesProject &&
        matchesAssignee &&
        matchesOverdue
      );
    });
  }, [
    data,
    search,
    priorityFilter,
    columnFilter,
    dueDateFilter,
    taskTypeFilter,
    statusFilter,
    projectFilter,
    assigneeFilter,
    showOverdueOnly,
    taskTypeCustomRows,
    sprintFilterId,
    collapsedEpicIds,
    taskByIdMap,
  ]);

  /** Tarefas sem sprint que cumprem os outros filtros mas ficam fora do quadro com uma sprint seleccionada. */
  const unsprintedTasksHiddenBySprintFilterCount = useMemo(() => {
    if (sprintFilterId == null || !Number.isFinite(sprintFilterId) || !(data?.tasks || []).length) {
      return 0;
    }
    const pool = (data?.tasks || []).filter((t) => (t.sprintId ?? null) === null);
    const hiddenByCollapsedEpic = (task: TaskflowTask): boolean => {
      let pid = task.parentTaskId ?? null;
      while (pid != null) {
        if (collapsedEpicIds.includes(pid)) {
          return true;
        }
        const p = taskByIdMap.get(pid);
        if (!p) {
          break;
        }
        pid = p.parentTaskId ?? null;
      }
      return false;
    };
    return pool.filter((task) => {
      if (hiddenByCollapsedEpic(task)) {
        return false;
      }
      const typeLabel = taskTypeDisplayLabel(task.taskType || 'generic', taskTypeCustomRows);
      const matchesSearch = search
        ? `${task.title} ${task.description || ''} ${typeLabel}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true;
      const matchesPriority =
        priorityFilter === 'ALL' ? true : task.priority === priorityFilter;
      const matchesColumn =
        columnFilter === 'ALL' ? true : task.columnId === Number(columnFilter);
      const dueDateKey = task.dueDate ? formatLocalDateKeyFromIso(task.dueDate) : '';
      const matchesDueDate = dueDateFilter ? dueDateKey !== '' && dueDateKey <= dueDateFilter : true;
      const matchesTaskType = taskTypeFilter === 'ALL' ? true : (task.taskType || 'generic') === taskTypeFilter;
      const matchesStatus = statusFilter === 'ALL' ? true : task.statusId === Number(statusFilter);
      const matchesProject =
        projectFilter === '_all'
          ? true
          : projectFilter === '_none'
            ? task.projectId == null
            : String(task.projectId ?? '') === projectFilter;
      const assigneeIdsForTask = taskAssigneeIds(task);
      const matchesAssignee =
        assigneeFilter === '_all'
          ? true
          : assigneeFilter === '_none'
            ? assigneeIdsForTask.length === 0
            : assigneeIdsForTask.includes(Number(assigneeFilter));
      const isOverdue = task.dueDate
        ? new Date(task.dueDate).getTime() < Date.now()
        : false;
      const matchesOverdue = showOverdueOnly ? isOverdue : true;
      return (
        matchesSearch &&
        matchesPriority &&
        matchesColumn &&
        matchesDueDate &&
        matchesTaskType &&
        matchesStatus &&
        matchesProject &&
        matchesAssignee &&
        matchesOverdue
      );
    }).length;
  }, [
    data?.tasks,
    sprintFilterId,
    collapsedEpicIds,
    taskByIdMap,
    search,
    priorityFilter,
    columnFilter,
    dueDateFilter,
    taskTypeFilter,
    statusFilter,
    projectFilter,
    assigneeFilter,
    showOverdueOnly,
    taskTypeCustomRows,
  ]);

  const sortedTasks = useMemo(() => {
    if (!dynamicSort) {
      return filteredTasks;
    }

    const scoreTask = (task: TaskflowTask) => {
      let score = 0;
      if (task.priority === 'HIGH') score += 30;
      if (task.priority === 'MEDIUM') score += 15;

      if (task.dueDate) {
        const due = new Date(task.dueDate);
        const now = new Date();
        const diffDays = diffInDays(now, due);
        if (diffDays < 0) score += 50;
        if (diffDays === 0) score += 40;
        if (diffDays <= 2 && diffDays >= 0) score += 25;
      }

      return score;
    };

    return [...filteredTasks].sort((a, b) => scoreTask(b) - scoreTask(a));
  }, [filteredTasks, dynamicSort]);

  const editingTaskRow = useMemo(
    () => (data?.tasks || []).find((task) => task.id === editingTaskId) ?? null,
    [data?.tasks, editingTaskId],
  );

  const assigneeFilterContextLabel = useMemo(() => {
    if (assigneeFilter === '_all') return null;
    if (assigneeFilter === '_none') return 'Sem responsável';
    const memberId = Number(assigneeFilter);
    if (!Number.isFinite(memberId)) return null;
    return teamMemberMap.get(memberId) || `Utilizador #${memberId}`;
  }, [assigneeFilter, teamMemberMap]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch.length > 0) {
      chips.push({
        key: 'search',
        label: `Busca: "${trimmedSearch}"`,
        onClear: () => setSearch(''),
      });
    }
    if (priorityFilter !== 'ALL') {
      chips.push({
        key: 'priority',
        label: `Prioridade: ${getPriorityLabel(priorityFilter)}`,
        onClear: () => setPriorityFilter('ALL'),
      });
    }
    if (columnFilter !== 'ALL') {
      const columnName = data?.columns?.find((column) => String(column.id) === columnFilter)?.name || 'Coluna';
      chips.push({
        key: 'column',
        label: `Coluna: ${columnName}`,
        onClear: () => setColumnFilter('ALL'),
      });
    }
    if (sprintFilterId != null && Number.isFinite(sprintFilterId)) {
      const sprintName = (data?.sprints || []).find((sp) => sp.id === sprintFilterId)?.name || 'Sprint';
      chips.push({
        key: 'sprint',
        label: `Sprint: ${sprintName}`,
        onClear: () => setSprintFilterId(null),
      });
    }
    if (showOverdueOnly) {
      chips.push({
        key: 'overdue',
        label: 'Só atrasadas',
        onClear: () => setShowOverdueOnly(false),
      });
    }
    return chips;
  }, [search, priorityFilter, columnFilter, sprintFilterId, showOverdueOnly, data?.columns, data?.sprints]);

  const clearAllViewFilters = useCallback(() => {
    setSearch('');
    setPriorityFilter('ALL');
    setColumnFilter('ALL');
    setDueDateFilter('');
    setTaskTypeFilter('ALL');
    setStatusFilter('ALL');
    setProjectFilter('_all');
    setAssigneeFilter('_all');
    setSprintFilterId(null);
    setShowOverdueOnly(false);
  }, []);

  const columns = useMemo<ColumnWithTasks[]>(() => {
    if (!data) {
      return [];
    }
    return buildColumnsWithTasks(data.columns, sortedTasks);
  }, [data, sortedTasks]);

  const hasChildrenTaskIds = useMemo(() => {
    const s = new Set<number>();
    for (const t of data?.tasks || []) {
      const p = t.parentTaskId ?? null;
      if (p != null) {
        s.add(p);
      }
    }
    return s;
  }, [data?.tasks]);

  const kanbanDnDEnabled = sprintFilterId === null && collapsedEpicIds.length === 0;

  const eisenhower = useMemo(() => {
    const now = new Date();
    const urgentThreshold = 1000 * 60 * 60 * 24 * 2;

    const classify = (task: TaskflowTask) => {
      const due = task.dueDate ? new Date(task.dueDate) : null;
      const isUrgent = due
        ? due.getTime() - now.getTime() <= urgentThreshold
        : false;
      const isImportant = task.priority === 'HIGH';

      if (isUrgent && isImportant) return 'do';
      if (!isUrgent && isImportant) return 'schedule';
      if (isUrgent && !isImportant) return 'delegate';
      return 'eliminate';
    };

    return filteredTasks.reduce(
      (acc, task) => {
        acc[classify(task)].push(task);
        return acc;
      },
      {
        do: [] as TaskflowTask[],
        schedule: [] as TaskflowTask[],
        delegate: [] as TaskflowTask[],
        eliminate: [] as TaskflowTask[],
      },
    );
  }, [filteredTasks]);

  const calendar = useMemo(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const cells = Array.from({ length: startOffset + daysInMonth }, (_, idx) => {
      const dayNumber = idx - startOffset + 1;
      const date =
        dayNumber > 0 ? new Date(today.getFullYear(), today.getMonth(), dayNumber) : null;
      return { date };
    });

    const tasksByDate = new Map<string, TaskflowTask[]>();
    (data?.tasks || []).forEach((task) => {
      if (!task.dueDate) {
        return;
      }
      const key = formatLocalDateKeyFromIso(task.dueDate);
      if (!key) {
        return;
      }
      if (!tasksByDate.has(key)) {
        tasksByDate.set(key, []);
      }
      tasksByDate.get(key)?.push(task);
    });

    return { cells, tasksByDate, today };
  }, [data]);

  const gantt = useMemo(() => {
    const timelineDays = 30;
    const today = new Date();
    const tasks = (data?.tasks || []).filter((task) => task.dueDate);

    return tasks.map((task) => {
      const startDate = task.createdAt ? new Date(task.createdAt) : today;
      const endDate = task.dueDate ? new Date(task.dueDate) : today;
      const startOffset = Math.max(0, diffInDays(today, startDate));
      const duration = Math.max(1, diffInDays(startDate, endDate));
      const clampedStart = Math.min(startOffset, timelineDays - 1);
      const clampedDuration = Math.min(duration, timelineDays - clampedStart);
      const left = (clampedStart / timelineDays) * 100;
      const width = (clampedDuration / timelineDays) * 100;

      return {
        task,
        left,
        width,
        daysLeft: diffInDays(today, endDate),
      };
    });
  }, [data]);

  async function handleUpdateTask(taskId: number) {
    const editedPreview = data?.tasks?.find((t) => t.id === taskId);
    const isTerminalEdit = taskflowTaskIsTerminal(editedPreview, data?.statusDefinitions);

    if (isTerminalEdit && !isOwnerLike(role)) {
      setError(
        'Tarefa concluída ou cancelada: apenas administrador ou proprietário pode editar descrição e estado.',
      );
      return;
    }

    if (isTerminalEdit && isOwnerLike(role)) {
      setIsSaving(true);
      setError(null);
      try {
        const response = await fetch('/api/taskflow/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: taskId,
            description: editDescription,
            ...(editStatusId != null ? { statusId: editStatusId } : {}),
          }),
        });
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload?.error || 'Erro ao atualizar tarefa');
        }
        setEditingTaskId(null);
        await loadBoard();
        toast.showSuccess('Tarefa actualizada.');
      } catch (err: any) {
        setError(err?.message || 'Erro ao atualizar tarefa');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!editTitle.trim()) {
      setError('Informe um título válido para a tarefa.');
      return;
    }
    if (!isTerminalEdit && editAssigneeIds.length === 0) {
      setError('Selecione pelo menos um responsável.');
      return;
    }

    const duePatchIso = isoFromDateTimeLocal(editDueDate);
    if (!duePatchIso) {
      setError('Prazo de entrega é obrigatório.');
      return;
    }
    let plannedBody: string | null = null;
    if (editPlannedStart.trim()) {
      const p = isoFromDateTimeLocal(editPlannedStart);
      if (!p) {
        setError('Previsão de início inválida.');
        return;
      }
      plannedBody = p;
    }
    const estEditTrim = editEstimatedHours.trim();
    let estimatedPatch: number | null = null;
    if (estEditTrim === '') {
      estimatedPatch = null;
    } else {
      const n = Number(estEditTrim.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        setError('Duração estimada inválida.');
        return;
      }
      estimatedPatch = n === 0 ? null : n;
    }

    const edited = editedPreview;
    const isRecurrenceInstance = !!edited?.recurrenceOccurrenceKey;
    const recurrencePatch: Record<string, unknown> = {};
    if (!isRecurrenceInstance) {
      recurrencePatch.recurrenceRule =
        editRecurrenceRule === '_none' ? null : editRecurrenceRule;
      recurrencePatch.recurrenceUntil =
        editRecurrenceRule === '_none'
          ? null
          : editRecurrenceUntil.trim()
            ? isoFromDateTimeLocal(editRecurrenceUntil)
            : null;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/taskflow/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          title: editTitle.trim(),
          priority: editPriority,
          ...(isTerminalEdit
            ? {}
            : {
                columnId: editColumnId,
                assigneeIds: editAssigneeIds,
              }),
          dueDate: duePatchIso,
          plannedStartAt: plannedBody,
          estimatedDurationHours: estimatedPatch,
          projectId: editProjectId,
          ...(editStatusId != null ? { statusId: editStatusId } : {}),
          taskType: editTaskType,
          parentTaskId: editParentTaskId,
          sprintId: editSprintId,
          ...(!isRecurrenceInstance ? recurrencePatch : {}),
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao atualizar tarefa');
      }

      await fetch('/api/taskflow/task-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          labelIds: editLabelIds,
        }),
      });

      setEditingTaskId(null);
      await loadBoard();
      toast.showSuccess('Tarefa actualizada.');
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar tarefa');
    } finally {
      setIsSaving(false);
    }
  }

  function openTaskEditor(task: TaskflowTask) {
    if (viewMode !== 'lista') {
      setViewMode('lista');
    }
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditPriority(task.priority);
    setEditColumnId(task.columnId);
    setEditDueDate(datetimeLocalFromIso(task.dueDate));
    setEditPlannedStart(datetimeLocalFromIso(task.plannedStartAt ?? null));
    setEditEstimatedHours(
      task.estimatedDurationHours != null && Number.isFinite(task.estimatedDurationHours)
        ? String(task.estimatedDurationHours)
        : '',
    );
    setEditAssigneeIds(taskAssigneeIds(task));
    setEditLabelIds(labelIdsByTask.get(task.id) || []);
    setEditProjectId(task.projectId ?? null);
    setEditStatusId(task.statusId);
    setEditTaskType(task.taskType || 'generic');
    setEditRecurrenceRule(task.recurrenceRule ?? '_none');
    setEditRecurrenceUntil(datetimeLocalFromIso(task.recurrenceUntil ?? null));
    setEditParentTaskId(task.parentTaskId ?? null);
    setEditSprintId(task.sprintId ?? null);
  }

  async function handleUploadEditAttachment(taskId: number, file: File | null) {
    if (!file) {
      return;
    }
    setEditAttachmentUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/taskflow/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: fd,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || 'Falha ao enviar anexo');
      }
      const listR = await fetch(`/api/taskflow/tasks/${taskId}/attachments`);
      const listJ = await listR.json();
      if (listR.ok && Array.isArray(listJ.attachments)) {
        setEditTaskAttachments(listJ.attachments as TaskflowTaskAttachmentRow[]);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar anexo');
    } finally {
      setEditAttachmentUploading(false);
      if (editAttachmentInputRef.current) {
        editAttachmentInputRef.current.value = '';
      }
    }
  }

  async function handleDeleteEditAttachment(taskId: number, attachmentId: number) {
    setEditAttachmentUploading(true);
    setError(null);
    try {
      const r = await fetch(`/api/taskflow/tasks/${taskId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || 'Falha ao remover anexo');
      }
      setEditTaskAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err: any) {
      setError(err?.message || 'Erro ao remover anexo');
    } finally {
      setEditAttachmentUploading(false);
    }
  }

  async function handleMoveTask(
    task: TaskflowTask,
    nextColumnId: number,
    refresh = true,
  ) {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/taskflow/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          columnId: nextColumnId,
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao mover tarefa');
      }
      if (refresh) {
        await loadBoard();
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao mover tarefa');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!data) {
      return;
    }
    if (!kanbanDnDEnabled) {
      return;
    }

    const { destination, source, draggableId } = result;
    if (!destination) {
      return;
    }

    const sourceColumnId = Number(source.droppableId);
    const destinationColumnId = Number(destination.droppableId);
    if (
      sourceColumnId === destinationColumnId &&
      source.index === destination.index
    ) {
      return;
    }

    const taskId = Number(draggableId);
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    if (taskflowTaskIsTerminal(task, data.statusDefinitions)) {
      setError(
        'Tarefas concluídas ou canceladas não podem ser movidas no quadro. Altere o estado na lista se precisar reabrir o fluxo.',
      );
      return;
    }

    const nextTasks = reorderTaskList(
      data,
      taskId,
      sourceColumnId,
      destinationColumnId,
      destination.index,
    );

    setData((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        tasks: nextTasks,
      };
    });

    try {
      if (sourceColumnId !== destinationColumnId) {
        await handleMoveTask(task, destinationColumnId, false);
      }

      await fetch('/api/taskflow/tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnId: sourceColumnId,
          taskIds: getColumnTaskIds(nextTasks, sourceColumnId),
        }),
      });

      if (sourceColumnId !== destinationColumnId) {
        await fetch('/api/taskflow/tasks/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            columnId: destinationColumnId,
            taskIds: getColumnTaskIds(nextTasks, destinationColumnId),
          }),
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao reordenar tarefas');
      await loadBoard();
    }
  }

  async function handleDeleteTask(taskId: number) {
    setIsDeleting(taskId);
    setError(null);
    try {
      const response = await fetch(`/api/taskflow/tasks?id=${taskId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao excluir tarefa');
      }
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir tarefa');
    } finally {
      setIsDeleting(null);
    }
  }

  async function handleCreateLabel() {
    if (!data || !newLabelName.trim()) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const colorNorm = normalizeLabelColorForApi(newLabelHex.trim() || newLabelColor);
      if (!colorNorm.ok) {
        setError(colorNorm.error);
        setIsSaving(false);
        return;
      }
      const response = await fetch('/api/taskflow/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: data.board.id,
          name: newLabelName.trim(),
          color: colorNorm.value,
          priority: newLabelPriority,
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao criar etiqueta');
      }
      setNewLabelName('');
      setNewLabelColor('indigo');
      setNewLabelHex('');
      setNewLabelPriority('MEDIUM');
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar etiqueta');
    } finally {
      setIsSaving(false);
    }
  }

  function openLabelEditor(label: TaskflowLabel) {
    setEditingLabelId(label.id);
    setEditLabelName(label.name);
    const c = label.color || 'indigo';
    if (parseCanonicalHex(c)) {
      setEditLabelHex(c);
      setEditLabelColor('indigo');
    } else {
      setEditLabelHex('');
      setEditLabelColor(c);
    }
    setEditLabelPriority(label.priority || 'MEDIUM');
  }

  async function handleSaveLabel() {
    if (!editingLabelId || !editLabelName.trim()) {
      setError('Indique um nome válido para a etiqueta.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const colorNorm = normalizeLabelColorForApi(editLabelHex.trim() || editLabelColor);
      if (!colorNorm.ok) {
        setError(colorNorm.error);
        setIsSaving(false);
        return;
      }
      const response = await fetch(`/api/taskflow/labels/${editingLabelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editLabelName.trim(),
          color: colorNorm.value,
          priority: editLabelPriority,
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao atualizar etiqueta');
      }
      setEditingLabelId(null);
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar etiqueta');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteLabel(labelId: number) {
    setConfirmAction({
      title: 'Confirmar exclusão de etiqueta',
      message: 'Excluir esta etiqueta? Será removida de todas as tarefas.',
      confirmLabel: 'Excluir etiqueta',
      onConfirm: async () => {
        setIsSaving(true);
        setError(null);
        try {
          const response = await fetch(`/api/taskflow/labels/${labelId}`, { method: 'DELETE' });
          if (!response.ok) {
            const payload = await response.json();
            throw new Error(payload?.error || 'Erro ao excluir etiqueta');
          }
          if (editingLabelId === labelId) {
            setEditingLabelId(null);
          }
          setConfirmAction(null);
          await loadBoard();
        } catch (err: any) {
          setError(err?.message || 'Erro ao excluir etiqueta');
        } finally {
          setIsSaving(false);
        }
      },
    });
    return;
  }

  function openColumnEditor(column: TaskflowColumn) {
    setEditingColumnId(column.id);
    setEditColumnName(column.name);
    setEditColumnDescription(column.description || '');
    setEditColumnPhaseType(column.phaseType || 'PRODUCTION');
    setEditColumnMaxStay(
      column.maxStayHours != null && column.maxStayHours > 0
        ? String(column.maxStayHours)
        : '',
    );
    setEditColumnStripe(column.stripeColor || '');
  }

  async function handleSaveColumn() {
    if (!editingColumnId || !editColumnName.trim()) {
      setError('Indique um nome válido para a fase.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: editColumnName.trim(),
        description: editColumnDescription.trim() || null,
        phaseType: editColumnPhaseType,
        maxStayHours: editColumnMaxStay.trim() ? Number(editColumnMaxStay) : null,
        stripeColor: editColumnStripe.trim() || null,
      };
      const response = await fetch(`/api/taskflow/columns/${editingColumnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao atualizar fase');
      }
      setEditingColumnId(null);
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar fase');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateColumn() {
    if (!newColumnName.trim()) {
      setError('Indique o nome da nova fase.');
      return;
    }
    if (!data) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/taskflow/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: data.board.id,
          name: newColumnName.trim(),
          description: newColumnDescription.trim() || null,
          phaseType: newColumnPhaseType,
          maxStayHours: newColumnMaxStay.trim() ? Number(newColumnMaxStay) : null,
          stripeColor: newColumnStripe.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao criar fase');
      }
      setNewColumnName('');
      setNewColumnDescription('');
      setNewColumnPhaseType('PRODUCTION');
      setNewColumnMaxStay('');
      setNewColumnStripe('');
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar fase');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteColumn(columnId: number) {
    setConfirmAction({
      title: 'Confirmar exclusão de fase',
      message: 'Excluir esta fase? Só é permitido se não houver tarefas nela.',
      confirmLabel: 'Excluir fase',
      onConfirm: async () => {
        setIsSaving(true);
        setError(null);
        try {
          const response = await fetch(`/api/taskflow/columns/${columnId}`, { method: 'DELETE' });
          if (!response.ok) {
            const payload = await response.json();
            throw new Error(payload?.error || 'Erro ao excluir fase');
          }
          if (editingColumnId === columnId) {
            setEditingColumnId(null);
          }
          setConfirmAction(null);
          await loadBoard();
        } catch (err: any) {
          setError(err?.message || 'Erro ao excluir fase');
        } finally {
          setIsSaving(false);
        }
      },
    });
  }

  function openStatusDefinitionEditor(row: TaskflowStatusDefinition) {
    setEditingStatusDefId(row.id);
    setEditStatName(row.name);
    setEditStatDescription(row.description || '');
    setEditStatColor(row.color || 'slate');
    setEditStatPosition(String(row.position ?? 0));
  }

  async function handleSaveStatusDefinition() {
    if (!editingStatusDefId || !editStatName.trim()) {
      setError('Indique um nome válido para o estado.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/taskflow/status-definitions/${editingStatusDefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editStatName.trim(),
          description: editStatDescription.trim() || null,
          color: editStatColor.trim() || 'slate',
          position: editStatPosition.trim() === '' ? 0 : Number(editStatPosition),
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao atualizar estado');
      }
      setEditingStatusDefId(null);
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar estado');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateStatusDefinition() {
    const codeNorm = newStatCode.trim().toLowerCase();
    if (!codeNorm || !newStatName.trim()) {
      setError('Código e nome são obrigatórios para o novo estado.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/taskflow/status-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeNorm,
          name: newStatName.trim(),
          description: newStatDescription.trim() || null,
          fixedSituation: newStatFixed,
          color: newStatColor.trim() || 'indigo',
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao criar estado');
      }
      setNewStatCode('');
      setNewStatName('');
      setNewStatFixed('OPEN');
      setNewStatDescription('');
      setNewStatColor('indigo');
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar estado');
    } finally {
      setIsSaving(false);
    }
  }

  function openTaskTypeDefinitionEditor(row: TaskflowTaskTypeDefinition) {
    setEditingTaskTypeDefId(row.id);
    setEditTtName(row.name);
    setEditTtDescription(row.description || '');
    setEditTtPosition(String(row.position ?? 0));
  }

  async function handleSaveTaskTypeDefinition() {
    if (!editingTaskTypeDefId || !editTtName.trim()) {
      setError('Indique um nome válido para o tipo.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/taskflow/task-types/${editingTaskTypeDefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTtName.trim(),
          description: editTtDescription.trim() || null,
          position: editTtPosition.trim() === '' ? 0 : Number(editTtPosition),
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao atualizar tipo');
      }
      setEditingTaskTypeDefId(null);
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar tipo');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateTaskTypeDefinition() {
    const codeNorm = newTtCode.trim().toLowerCase();
    if (!codeNorm || !newTtName.trim()) {
      setError('Código e nome são obrigatórios para novo tipo.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/taskflow/task-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeNorm,
          name: newTtName.trim(),
          description: newTtDescription.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao criar tipo');
      }
      setNewTtCode('');
      setNewTtName('');
      setNewTtDescription('');
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar tipo');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTaskTypeDefinition(typeDefId: number) {
    setConfirmAction({
      title: 'Confirmar exclusão de tipo',
      message: 'Excluir este tipo personalizado? Só é permitido se nenhuma tarefa o usar.',
      confirmLabel: 'Excluir tipo',
      onConfirm: async () => {
        setIsSaving(true);
        setError(null);
        try {
          const response = await fetch(`/api/taskflow/task-types/${typeDefId}`, { method: 'DELETE' });
          if (!response.ok) {
            const payload = await response.json();
            throw new Error(payload?.error || 'Erro ao excluir tipo');
          }
          if (editingTaskTypeDefId === typeDefId) {
            setEditingTaskTypeDefId(null);
          }
          setConfirmAction(null);
          await loadBoard();
        } catch (err: any) {
          setError(err?.message || 'Erro ao excluir tipo');
        } finally {
          setIsSaving(false);
        }
      },
    });
  }

  async function handleDeleteStatusDefinition(statusDefId: number) {
    setConfirmAction({
      title: 'Confirmar exclusão de estado',
      message: 'Excluir esta definição de estado? Só é permitido se nenhuma tarefa a usar.',
      confirmLabel: 'Excluir estado',
      onConfirm: async () => {
        setIsSaving(true);
        setError(null);
        try {
          const response = await fetch(`/api/taskflow/status-definitions/${statusDefId}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            const payload = await response.json();
            throw new Error(payload?.error || 'Erro ao excluir estado');
          }
          if (editingStatusDefId === statusDefId) {
            setEditingStatusDefId(null);
          }
          setConfirmAction(null);
          await loadBoard();
        } catch (err: any) {
          setError(err?.message || 'Erro ao excluir estado');
        } finally {
          setIsSaving(false);
        }
      },
    });
  }

  const stats = useMemo(() => {
    const total = data?.tasks?.length || 0;
    const completedColumnIds = (data?.columns || [])
      .filter(
        (column) =>
          column.phaseType === 'FINAL' ||
          (!column.phaseType && /conclu|cancel/i.test(column.name)),
      )
      .map((column) => column.id);
    const completed = (data?.tasks || []).filter((task) =>
      completedColumnIds.includes(task.columnId),
    ).length;
    const inProgress = total - completed;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const columnCounts = (data?.columns || []).map(
      (column) => data?.tasks?.filter((task) => task.columnId === column.id).length || 0,
    );
    const overdue = (data?.tasks || []).filter((task) => {
      if (!task.dueDate) {
        return false;
      }
      const due = new Date(task.dueDate);
      const isCompleted = completedColumnIds.includes(task.columnId);
      return !isCompleted && due.getTime() < Date.now();
    }).length;

    const completedTasks = (data?.tasks || []).filter(
      (task) => task.completedAt && task.createdAt,
    );
    const avgLeadTime =
      completedTasks.length === 0
        ? 0
        : Math.round(
            completedTasks.reduce((acc, task) => {
              const start = new Date(task.createdAt as string);
              const end = new Date(task.completedAt as string);
              return acc + diffInDays(start, end);
            }, 0) / completedTasks.length,
          );

    const openTasks = (data?.tasks || []).filter((task) => task.createdAt && !task.completedAt);
    const avgOpenTime =
      openTasks.length === 0
        ? 0
        : Math.round(
            openTasks.reduce((acc, task) => {
              const start = new Date(task.createdAt as string);
              return acc + diffInDays(start, new Date());
            }, 0) / openTasks.length,
          );

    return {
      total,
      completed,
      inProgress,
      completionRate,
      columnCounts,
      overdue,
      avgLeadTime,
      avgOpenTime,
    };
  }, [data]);

  const todayInsights = useMemo(() => {
    const tasks = data?.tasks || [];
    const now = new Date();
    const twoDays = 1000 * 60 * 60 * 24 * 2;

    const overdueTasks = tasks.filter((task) => {
      if (!task.dueDate) {
        return false;
      }
      return new Date(task.dueDate).getTime() < Date.now();
    });

    const dueToday = tasks.filter((task) => {
      if (!task.dueDate) {
        return false;
      }
      return formatLocalDateKey(new Date(task.dueDate)) === formatLocalDateKey(now);
    });

    const dueSoon = tasks.filter((task) => {
      if (!task.dueDate) {
        return false;
      }
      const due = new Date(task.dueDate);
      const t = due.getTime();
      return t >= Date.now() && t - Date.now() <= twoDays;
    });

    const topPriority = tasks
      .filter((task) => task.priority === 'HIGH')
      .slice(0, 3);

    const focusList = [...dueToday, ...dueSoon, ...topPriority]
      .filter((task, index, self) => self.findIndex((item) => item.id === task.id) === index)
      .slice(0, 4);

    const alerts = [];
    if (overdueTasks.length > 0) {
      alerts.push(`Você tem ${overdueTasks.length} tarefa(s) atrasada(s).`);
    }
    if (dueToday.length > 0) {
      alerts.push(`Hoje vencem ${dueToday.length} tarefa(s).`);
    }
    if (dueSoon.length > 0) {
      alerts.push(`Próximas 48h: ${dueSoon.length} tarefa(s) críticas.`);
    }
    if (topPriority.length > 0) {
      alerts.push(`Prioridade alta: ${topPriority.length} tarefa(s) em foco.`);
    }
    const slaN = data?.slaBreaches?.length ?? 0;
    if (slaN > 0) {
      alerts.push(
        `SLA de fase: ${slaN} tarefa(s) acima do tempo máximo permitido na coluna (ver aviso no Kanban).`,
      );
    }

    return {
      focusList,
      alerts,
    };
  }, [data]);

  const weeklySummary = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 7,
    );
    const completed = (data?.tasks || []).filter((task) => {
      if (!task.completedAt) {
        return false;
      }
      return new Date(task.completedAt) >= weekAgo;
    }).length;
    const created = (data?.tasks || []).filter((task) => {
      if (!task.createdAt) {
        return false;
      }
      return new Date(task.createdAt) >= weekAgo;
    }).length;

    return { completed, created };
  }, [data]);

  const interventionTaskOptions = useMemo(() => {
    if (!filteredTasks?.length) return [];
    return filteredTasks
      .filter((t) => !taskflowTaskIsTerminal(t, data?.statusDefinitions))
      .map((t) => ({ id: t.id, title: t.title }));
  }, [filteredTasks, data?.statusDefinitions]);

  const interventionStatusSyncOptions = useMemo(() => {
    const defs = data?.statusDefinitions;
    if (!defs?.length) return [];
    return [...defs]
      .filter((s) => !isTaskflowStatusTerminal(s.fixedSituation))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((s) => ({ id: s.id, name: s.name }));
  }, [data?.statusDefinitions]);

  async function refreshBoardSummaries() {
    try {
      const r = await fetch('/api/taskflow/boards?list=1');
      const j = (await r.json()) as {
        boards?: { id: number; name: string; updatedAt: string | null }[];
      };
      if (r.ok && Array.isArray(j.boards)) {
        setBoardSummaries(j.boards);
      }
    } catch {
      /* ignore */
    }
  }

  function openTemplateModal() {
    templateClientRequestIdRef.current =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const fallback = data?.board?.id ?? boardSummaries[0]?.id;
    setTemplateSourceId(typeof fallback === 'number' ? fallback : '');
    setTemplateNewName('');
    setTemplateCopyLabels(true);
    setShowTemplateModal(true);
  }

  function openNewBoardModal() {
    if (!canConfigureTaskflowBoard(normalizeRole(role))) {
      return;
    }
    const suggested = data?.board?.name ? `${data.board.name} (cópia)` : 'Novo quadro';
    setNewBoardName(suggested);
    setShowNewBoardModal(true);
  }

  function closeNewBoardModal() {
    if (boardUiBusy) return;
    setShowNewBoardModal(false);
    setNewBoardName('');
  }

  async function submitNewEmptyBoard() {
    if (!canConfigureTaskflowBoard(normalizeRole(role))) {
      return;
    }
    const trimmed = newBoardName.trim();
    if (!trimmed) {
      setError('Indique um nome para o quadro.');
      return;
    }
    setBoardUiBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/taskflow/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = (await r.json()) as { error?: string; id?: number };
      if (!r.ok) {
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Não foi possível criar o quadro.',
        );
      }
      const newId = payload?.id;
      if (typeof newId === 'number' && team?.id) {
        try {
          localStorage.setItem(taskflowActiveBoardStorageKey(team.id), String(newId));
        } catch {
          /* ignore */
        }
        setSelectedBoardId(newId);
      }
      setShowNewBoardModal(false);
      setNewBoardName('');
      await refreshBoardSummaries();
      await loadBoard();
      toast.showSuccess('Quadro criado.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar quadro');
    } finally {
      setBoardUiBusy(false);
    }
  }

  async function handleSubmitBoardTemplate() {
    if (!canConfigureTaskflowBoard(normalizeRole(role))) {
      return;
    }
    const nm = templateNewName.trim();
    const sid = Number(templateSourceId);
    if (!nm || !Number.isFinite(sid) || sid < 1) {
      setError('Escolha o quadro modelo e indique um nome para o novo quadro.');
      return;
    }
    setBoardUiBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/taskflow/boards/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBoardId: sid,
          name: nm,
          copyLabels: templateCopyLabels,
          clientRequestId: templateClientRequestIdRef.current,
        }),
      });
      const payload = (await r.json()) as { error?: string; board?: { id: number } };
      if (!r.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'Não foi possível criar o quadro a partir do modelo.',
        );
      }
      const newId = payload?.board?.id;
      if (typeof newId === 'number' && team?.id) {
        try {
          localStorage.setItem(taskflowActiveBoardStorageKey(team.id), String(newId));
        } catch {
          /* ignore */
        }
        setSelectedBoardId(newId);
      }
      setShowTemplateModal(false);
      await refreshBoardSummaries();
      await loadBoard();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar a partir do modelo');
    } finally {
      setBoardUiBusy(false);
    }
  }

  const setHubTabPersisted = useCallback((next: TaskflowHubTab) => {
    setHubTab(next);
    if (selectedBoardId != null && selectedBoardId > 0) {
      try {
        localStorage.setItem(`taskflow-hub-tab-${selectedBoardId}`, next);
      } catch {
        /* ignore */
      }
    }
  }, [selectedBoardId]);

  return (
    <section className="relative flex-1 overflow-hidden bg-gradient-to-b from-violet-50/70 via-white to-cyan-50/40 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/25 lg:p-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(139,92,246,0.22),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,rgba(139,92,246,0.15),transparent)]"
        aria-hidden
      />
      <div className="relative z-[1] flex w-full flex-col gap-6">
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="Taskflow"
            description="Quadro Kanban com abas Operar, Nova tarefa, Painel e Definições: fluxo no quadro, captura dedicada, métricas e configuração."
            className="w-full"
          />
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Button
            asChild
            variant="outline"
            className="w-full border-emerald-200/80 bg-white/90 text-emerald-900 shadow-sm backdrop-blur-sm hover:bg-emerald-50 dark:border-emerald-700/35 dark:bg-slate-900/70 dark:text-emerald-100 dark:hover:bg-emerald-950/35 sm:w-auto"
          >
            <a href="/api/taskflow/export/tasks" download className="inline-flex items-center gap-2">
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Exportar CSV
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full border-teal-200/80 bg-white/90 text-teal-900 shadow-sm backdrop-blur-sm hover:bg-teal-50 dark:border-teal-800/40 dark:bg-slate-900/70 dark:text-teal-100 dark:hover:bg-teal-950/35 sm:w-auto"
          >
            <a
              href="/api/taskflow/export/tasks?format=xlsx"
              download
              className="inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
              Excel
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full border-rose-200/80 bg-white/90 text-rose-900 shadow-sm backdrop-blur-sm hover:bg-rose-50 dark:border-rose-900/40 dark:bg-slate-900/70 dark:text-rose-100 dark:hover:bg-rose-950/35 sm:w-auto"
          >
            <a href="/api/taskflow/export/tasks?format=pdf" download className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0" aria-hidden />
              PDF
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full border-cyan-200/80 bg-white/90 text-cyan-900 shadow-sm backdrop-blur-sm hover:bg-cyan-50 dark:border-cyan-600/30 dark:bg-slate-900/70 dark:text-cyan-100 dark:hover:bg-cyan-950/30 sm:w-auto"
          >
            <Link href="/dashboard/taskflow/reports">Relatórios</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full border-violet-200/80 bg-white/90 text-violet-800 shadow-sm backdrop-blur-sm hover:bg-violet-50 dark:border-violet-500/25 dark:bg-slate-900/70 dark:text-violet-200 dark:hover:bg-violet-950/40 sm:w-auto"
          >
            <Link href="/manual/taskflow">Manual</Link>
          </Button>
        </div>
      </div>
      {projectusIntegrationError ? (
        <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/10">
          <CardContent className="pt-4 text-sm text-amber-900 dark:text-amber-100">
            {projectusIntegrationError.message}
          </CardContent>
        </Card>
      ) : null}
      <ConfirmActionBanner
        open={Boolean(confirmAction)}
        title={confirmAction?.title || 'Confirmar ação'}
        message={confirmAction?.message || ''}
        confirmLabel={confirmAction?.confirmLabel || 'Confirmar'}
        cancelLabel={ACTION_COPY.cancel}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          await confirmAction?.onConfirm();
        }}
      />

      {canView && boardSummaries.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-violet-200/60 bg-white/80 px-4 py-3 shadow-sm dark:border-violet-900/35 dark:bg-slate-900/60">
          <div className="flex min-w-[200px] flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Quadro ativo
            </span>
            <Select
              value={String(
                selectedBoardId ?? data?.board?.id ?? boardSummaries[0]?.id ?? '',
              )}
              onValueChange={(v) => {
                const id = Number(v);
                if (!Number.isFinite(id) || id < 1) {
                  return;
                }
                setSelectedBoardId(id);
                if (team?.id) {
                  try {
                    localStorage.setItem(taskflowActiveBoardStorageKey(team.id), String(id));
                  } catch {
                    /* ignore */
                  }
                }
              }}
              disabled={boardUiBusy || isLoading}
            >
              <SelectTrigger className="h-9 w-full min-w-[220px] bg-white dark:bg-slate-950">
                <SelectValue placeholder="Quadro" />
              </SelectTrigger>
              <SelectContent>
                {boardSummaries.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canConfigureTaskflowBoard(normalizeRole(role)) ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900"
                disabled={boardUiBusy}
                onClick={() => openNewBoardModal()}
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Novo quadro
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-violet-200 bg-violet-50/80 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
                disabled={boardUiBusy || boardSummaries.length < 1}
                onClick={() => openTemplateModal()}
              >
                <Copy className="h-4 w-4 shrink-0" aria-hidden />
                A partir de modelo…
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showTemplateModal ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="taskflow-template-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-violet-200/80 bg-white p-5 shadow-xl dark:border-violet-900/50 dark:bg-slate-900">
            <h2
              id="taskflow-template-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Novo quadro a partir de modelo
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Copia fases do Kanban e, se quiser, as etiquetas. Não copia tarefas nem dados de tempo.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Quadro modelo
                <Select
                  value={String(templateSourceId || boardSummaries[0]?.id || '')}
                  onValueChange={(v) => setTemplateSourceId(Number(v))}
                >
                  <SelectTrigger className="mt-1 h-9 w-full bg-white dark:bg-slate-950">
                    <SelectValue placeholder="Escolha…" />
                  </SelectTrigger>
                  <SelectContent>
                    {boardSummaries.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Nome do novo quadro
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                  value={templateNewName}
                  onChange={(e) => setTemplateNewName(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-violet-400"
                  checked={templateCopyLabels}
                  onChange={(e) => setTemplateCopyLabels(e.target.checked)}
                />
                Copiar etiquetas
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={boardUiBusy}
                onClick={() => setShowTemplateModal(false)}
              >
                {ACTION_COPY.cancel}
              </Button>
              <Button
                type="button"
                className="rounded-full"
                disabled={boardUiBusy}
                onClick={() => void handleSubmitBoardTemplate()}
              >
                {boardUiBusy ? ACTION_COPY.saving : ACTION_COPY.save}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showNewBoardModal && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[380] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="taskflow-new-board-title"
              onClick={() => closeNewBoardModal()}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-violet-200/80 bg-white p-5 shadow-xl dark:border-violet-900/50 dark:bg-slate-900"
                onClick={(event) => event.stopPropagation()}
              >
                <h2
                  id="taskflow-new-board-title"
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                >
                  Novo quadro
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  O quadro começa vazio (fases e colunas padrão). Indique o nome que aparecerá no selector «Quadro
                  ativo».
                </p>
                <div className="mt-4 space-y-2">
                  <label
                    htmlFor="taskflow-new-board-name"
                    className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300"
                  >
                    Nome do quadro
                  </label>
                  <input
                    id="taskflow-new-board-name"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !boardUiBusy) {
                        e.preventDefault();
                        void submitNewEmptyBoard();
                      }
                    }}
                    maxLength={120}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={boardUiBusy}
                    onClick={() => closeNewBoardModal()}
                  >
                    {ACTION_COPY.cancel}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={boardUiBusy || !newBoardName.trim()}
                    onClick={() => void submitNewEmptyBoard()}
                  >
                    {boardUiBusy ? ACTION_COPY.saving : ACTION_COPY.save}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <ModuleWorkspaceHub
        description={
          <>
            {hubTab === 'operar'
              ? 'Intervenções, filtros, integrações rápidas e o quadro (Kanban, lista, calendário, etc.).'
              : null}
            {hubTab === 'nova_tarefa'
              ? 'Formulário completo para criar tarefa (inclui coluna, prazo, responsáveis, recorrência e gestão de etiquetas).'
              : null}
            {hubTab === 'painel'
              ? 'Indicadores do quadro, checklist pessoal por dia, resumo semanal, prioridades do dia, assistência por regras (sem LLM), busca por texto semelhante (adesão OpenAI), modelo na nuvem (adesão da equipe) e registro de atividades.'
              : null}
            {hubTab === 'definicoes'
              ? 'Estrutura do quadro (fases, estado, tipos), etiquetas no formulário, automações, webhooks, portal e integração de desenvolvimento.'
              : null}
          </>
        }
        links={
          <>
            <Link href="/manual/taskflow" className={moduleWorkspaceHubLinkClassName}>
              Manual do Taskflow
            </Link>
            <Link href="/dashboard/taskflow/reports" className={moduleWorkspaceHubLinkClassName}>
              Relatórios detalhados
            </Link>
          </>
        }
        afterLinks={
          hubTab === 'definicoes' && !canConfigureTaskflowBoard(normalizeRole(role)) ? (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
              Algumas secções abaixo só podem ser alteradas por administrador ou gestor do quadro. Membros podem
              rever notificações e automações permitidas ao seu perfil.
            </p>
          ) : null
        }
        tabs={
          <ModuleSegmentedTabs<TaskflowHubTab>
            aria-label="Seções do Taskflow"
            tone="accent"
            tabListClassName="max-w-full"
            items={TASKFLOW_HUB_TAB_ITEMS}
            value={hubTab}
            onValueChange={setHubTabPersisted}
          />
        }
      />

      {hubTab === 'operar' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ScriptumStatCard
            variant="indigo"
            icon={CheckSquare}
            title="Total de tarefas"
            description="Volume do quadro ativo"
            value={stats.total}
            footnote={`${stats.completionRate}% concluído`}
          />
          <ScriptumStatCard
            variant="emerald"
            icon={Clock3}
            title="Entregas"
            description="Fluxo concluído"
            value={stats.completed}
            footnote={`${stats.inProgress} em andamento`}
          />
          <ScriptumStatCard
            variant="sky"
            icon={Sparkles}
            title="Tempo de ciclo"
            description="Média operacional"
            value={`${metrics?.cycleTimeAvg ?? 0}d`}
            footnote={`Prazo médio (ponta a ponta) ${stats.avgLeadTime}d · Em aberto ${stats.avgOpenTime}d`}
          />
          <ScriptumStatCard
            variant="violet"
            icon={AlertTriangle}
            title="Atrasos e gargalo"
            description="Pontos de atenção"
            value={stats.overdue}
            footnote={`${bottleneckColumnName || 'Sem gargalo'}${metrics?.bottleneckDays ? ` (${metrics.bottleneckDays}d)` : ''}`}
          />
        </div>
      ) : null}

      {hubTab === 'operar' ? (
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-2 pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Filtros da lista</CardTitle>
                <CardDescription>
                  Ajuste visualização, pesquisa e recorte do quadro sem sair da área de trabalho.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
              <div className="md:col-span-2 xl:col-span-2 2xl:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Buscar
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-2.5 text-sm text-slate-900 shadow-sm backdrop-blur-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-violet-500/60 dark:focus:ring-violet-400/15"
                  placeholder="Título ou descrição..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Prioridade
                </label>
                <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v)}>
                  <SelectTrigger className="w-full rounded-2xl border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/70">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="MEDIUM">Média</SelectItem>
                    <SelectItem value="LOW">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Coluna
                </label>
                <Select value={columnFilter} onValueChange={(v) => setColumnFilter(v)}>
                  <SelectTrigger className="w-full rounded-2xl border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/70">
                    <SelectValue placeholder="Coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    {data?.columns?.map((column) => (
                      <SelectItem key={column.id} value={String(column.id)}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Sprint
                </label>
                <Select
                  value={sprintFilterId === null ? '_all' : String(sprintFilterId)}
                  onValueChange={(v) => setSprintFilterId(v === '_all' ? null : Number(v))}
                >
                  <SelectTrigger className="w-full rounded-2xl border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/70">
                    <SelectValue placeholder="Sprint" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="_all">Todas</SelectItem>
                    {(data?.sprints || []).map((sp) => (
                      <SelectItem key={sp.id} value={String(sp.id)}>
                        {sp.name} ({formatSprintRangePt(sp)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Prazo até
                </label>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm backdrop-blur-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-violet-500/60 dark:focus:ring-violet-400/15"
                  value={dueDateFilter}
                  onChange={(event) => setDueDateFilter(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Tipo de tarefa
                </label>
                <Select value={taskTypeFilter} onValueChange={(v) => setTaskTypeFilter(v)}>
                  <SelectTrigger className="w-full rounded-2xl border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/70">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {taskTypeFilterOptions.map((row) => (
                      <SelectItem key={row.code} value={row.code}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Estado inicial
                </label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                  <SelectTrigger className="w-full rounded-2xl border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/70">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {(data?.statusDefinitions || []).map((row) => (
                      <SelectItem key={row.id} value={String(row.id)}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 lg:col-span-2 xl:col-span-2 2xl:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Projeto
                </label>
                <Select value={projectFilter} onValueChange={(v) => setProjectFilter(v)}>
                  <SelectTrigger className="w-full rounded-2xl border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/70">
                    <SelectValue placeholder="Projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    <SelectItem value="_none">Sem projeto</SelectItem>
                    {projectsList.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Responsáveis
                </label>
                <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v)}>
                  <SelectTrigger className="w-full rounded-2xl border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/70">
                    <SelectValue placeholder="Responsáveis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    <SelectItem value="_none">Sem responsável</SelectItem>
                    {(team?.teamMembers || []).map((member) => (
                      <SelectItem key={member.user.id} value={String(member.user.id)}>
                        {member.user.name || member.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-700/70 dark:bg-slate-900/30">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Vista
              </label>
              <ModuleSegmentedTabs<TaskflowViewMode>
                aria-label="Modo de visualização"
                tone="accent"
                tabListClassName="max-w-full"
                items={TASKFLOW_VIEW_MODE_ITEMS}
                value={viewMode}
                onValueChange={setViewMode}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn(
                  'rounded-xl border px-4 py-2 text-xs font-semibold transition-colors',
                  dynamicSort
                    ? 'border-violet-600 bg-violet-600 text-white shadow-md hover:bg-violet-500 dark:border-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500'
                    : 'border-slate-300/90 bg-white/90 text-slate-600 shadow-sm hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800',
                )}
                onClick={() => setDynamicSort((prev) => !prev)}
                aria-pressed={dynamicSort}
                aria-label="Alternar ordenação dinâmica de prioridades"
                title="Activado: ordena só na vista por prazo (atraso, hoje, próximos dias) e prioridade — não grava no servidor. Desactivado: mantém a ordem que vê nas colunas."
              >
                {dynamicSort ? 'Ordenação inteligente' : 'Ordenação manual'}
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-xl border px-4 py-2 text-xs font-semibold transition-colors',
                  showOverdueOnly
                    ? 'border-rose-600 bg-rose-600 text-white shadow-md hover:bg-rose-500 dark:border-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400'
                    : 'border-slate-300/90 bg-white/90 text-slate-600 shadow-sm hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800',
                )}
                onClick={() => setShowOverdueOnly((prev) => !prev)}
                aria-pressed={showOverdueOnly}
                aria-label="Alternar filtro de tarefas atrasadas"
              >
                {showOverdueOnly ? 'Só atrasadas' : 'Mostrar atrasadas'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300/90 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                onClick={clearAllViewFilters}
              >
                Limpar filtros
              </button>
              <span className="ml-auto text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {filteredTasks.length} tarefa(s) visível(is)
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hubTab === 'nova_tarefa' && newSprintPanelOpen && canConfigureTaskflowBoard(normalizeRole(role)) ? (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="taskflow-sprint-modal-title"
          onClick={() => setNewSprintPanelOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-violet-200/80 bg-white p-5 shadow-xl dark:border-violet-900/50 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="taskflow-sprint-modal-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Nova sprint (janela de tempo da equipe)
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Defina o período da sprint para organizar o recorte de execução da equipe.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Nome</label>
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={newSprintName}
                  onChange={(e) => setNewSprintName(e.target.value)}
                  placeholder="ex.: Sprint 12"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Início</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={newSprintStartAt}
                  onChange={(e) => setNewSprintStartAt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Fim</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={newSprintEndAt}
                  onChange={(e) => setNewSprintEndAt(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNewSprintPanelOpen(false)}>
                {ACTION_COPY.cancel}
              </Button>
              <Button
                type="button"
                className="rounded-full"
                disabled={isCreatingSprint || !newSprintName.trim()}
                onClick={() => void handleCreateSprint()}
              >
                {isCreatingSprint ? 'A criar…' : 'Criar sprint'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {hubTab === 'operar' && data && user?.id ? (
        <TaskflowInterventionPanel
          taskOptions={interventionTaskOptions}
          statusSyncOptions={interventionStatusSyncOptions}
          viewerUserId={user.id}
          historyUserIdFilter={/^\d+$/.test(assigneeFilter) ? Number(assigneeFilter) : null}
          canManageTeamInterventions={canConfigureTaskflowBoard(normalizeRole(role))}
        />
      ) : null}

      {hubTab === 'painel' && canView ? (
        <Card className="border-violet-200/70 bg-white/90 shadow-sm backdrop-blur-sm dark:border-violet-900/40 dark:bg-slate-900/70">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-base">Assistência no quadro</CardTitle>
            <CardDescription>
              Lista só de leitura: regras sobre as tarefas abertas que vê (atraso de prazo, tempo acima do limite
              em coluna de produção, desequilíbrio de carga entre responsáveis). Não chama API de modelo; alterações
              no Kanban são sempre manuais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            {canConfigureTaskflowBoard(normalizeRole(role)) ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-500"
                  checked={Boolean(team?.taskflowAssistSuggestionsEnabled)}
                  disabled={assistOptInBusy}
                  onChange={async (e) => {
                    setAssistOptInBusy(true);
                    try {
                      const res = await fetch('/api/team/taskflow-assist-suggestions', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ enabled: e.target.checked }),
                      });
                      if (!res.ok) {
                        const payload = (await res.json().catch(() => ({}))) as { error?: string };
                        throw new Error(payload.error || 'Erro ao atualizar');
                      }
                      await swrMutate('/api/team');
                      await mutateAssistSuggestions();
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setAssistOptInBusy(false);
                    }
                  }}
                />
                <span>
                  Ativar sugestões de assistência para esta equipe (adesão explícita). Membros com acesso ao Taskflow
                  passam a ver o resumo abaixo quando houver sinais.
                </span>
              </label>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A ativação desta função é feita por administrador ou gestor do quadro.
              </p>
            )}
            {assistSwrKey && assistSuggestionsLoading ? (
              <p className="text-xs text-slate-500">A carregar sugestões…</p>
            ) : null}
            {assistSuggestions?.optedIn === true ? (
              <>
                <p className="text-xs text-slate-600 dark:text-slate-300">{assistSuggestions.disclaimer}</p>
                {assistSuggestions.prioritySuggestions.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Prioridade sugerida
                    </p>
                    <ul className="mt-1 max-h-40 space-y-1.5 overflow-y-auto text-xs">
                      {assistSuggestions.prioritySuggestions.map((s) => (
                        <li
                          key={`p-${s.taskId}`}
                          className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950/50"
                        >
                          <span className="font-mono text-[10px] text-slate-500">#{s.taskId}</span>{' '}
                          <span className="font-medium">{s.title}</span>
                          <span className="text-slate-500">
                            {' '}
                            · {s.currentPriority} → {s.suggestedPriority}
                          </span>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">{s.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {assistSuggestions.reassignSuggestions.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Carga / responsáveis
                    </p>
                    <ul className="mt-1 max-h-36 space-y-1.5 overflow-y-auto text-xs">
                      {assistSuggestions.reassignSuggestions.map((s) => (
                        <li
                          key={`r-${s.taskId}`}
                          className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950/50"
                        >
                          <span className="font-mono text-[10px] text-slate-500">#{s.taskId}</span>{' '}
                          <span className="font-medium">{s.title}</span>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {s.fromUserName} → {s.toUserName}. {s.reason}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {assistSuggestions.prioritySuggestions.length === 0 &&
                assistSuggestions.reassignSuggestions.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nenhuma sugestão no momento — dados ou sinais ainda não disparam regras (ex.: prazos,
                    SLA de coluna, desequilíbrio de carga).
                  </p>
                ) : null}
              </>
            ) : assistSuggestions && assistSuggestions.optedIn === false ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                As sugestões estão desligadas para esta equipe. Peça a um administrador ou gestor para ativar
                a opção de adesão acima.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {hubTab === 'painel' && assistSwrKey ? (
        <Card className="border-teal-200/70 bg-white/90 shadow-sm backdrop-blur-sm dark:border-teal-900/40 dark:bg-slate-900/70">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-base">Busca por similaridade</CardTitle>
            <CardDescription>
              Escreva uma frase e encontre tarefas parecidas no significado (não só palavra a palavra). Só após a
              equipe ativar e a instância ter OpenAI + chave: os textos das tarefas geram vetores na sua base; o
              quadro aplica-lhe as mesmas regras de visibilidade que ao Kanban. Desativar apaga os vetores semânticos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Ao sincronizar, título e descrição das tarefas enviadas ao índice transitam pela API de incorporação
              textual da OpenAI; os vetores ficam na sua base de dados. Resumo para equipes e DPO: documento técnico no
              repositório em{' '}
              <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">
                Projeto/E8.15-busca-semantica-lgpd.md
              </code>
              .
            </p>
            {canConfigureTaskflowBoard(normalizeRole(role)) ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-teal-200/80 bg-teal-50/90 px-3 py-2 text-xs text-teal-950 dark:border-teal-900/40 dark:bg-teal-950/25 dark:text-teal-100">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-teal-500"
                  checked={Boolean(team?.taskflowSemanticSearchEnabled)}
                  disabled={
                    semanticOptInBusy ||
                    semanticStatus == null ||
                    (!semanticStatus.canBuildIndex && !team?.taskflowSemanticSearchEnabled)
                  }
                  onChange={async (e) => {
                    const nextEnabled = e.target.checked;
                    if (nextEnabled && (semanticStatus == null || !semanticStatus.canBuildIndex)) {
                      const msg =
                        'OpenAI não está disponível: ative o toggle nas integrações globais e defina OPENAI_API_KEY no servidor.';
                      setSemanticSearchMsg(msg);
                      toast.showError(msg, 'Busca por similaridade');
                      return;
                    }
                    setSemanticOptInBusy(true);
                    setSemanticSearchMsg(null);
                    try {
                      const res = await fetch('/api/team/taskflow-semantic-search', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ enabled: nextEnabled }),
                      });
                      const payload = (await res.json().catch(() => ({}))) as { error?: string };
                      if (!res.ok) {
                        const msg = payload.error || 'Erro ao atualizar';
                        setSemanticSearchMsg(msg);
                        toast.showError(msg, 'Busca por similaridade');
                        return;
                      }
                      await swrMutate('/api/team');
                      await mutateSemanticStatus();
                      setSemanticHits(null);
                      if (nextEnabled) {
                        toast.showSuccess('Busca por similaridade ativada para a equipe.');
                      } else {
                        toast.showSuccess('Busca por similaridade desativada; vetores semânticos removidos.');
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Erro ao atualizar';
                      setSemanticSearchMsg(msg);
                      toast.showError(msg, 'Busca por similaridade');
                    } finally {
                      setSemanticOptInBusy(false);
                    }
                  }}
                />
                <span>
                  Ativar busca por similaridade para esta equipe (adesão explícita). Desligar remove os vetores semânticos já
                  armazenados.
                </span>
              </label>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A ativação desta função é feita por administrador ou gestor do quadro.
              </p>
            )}
            {semanticStatus && !semanticStatus.canBuildIndex ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                A instância precisa do toggle OpenAI nas integrações globais e da variável OPENAI_API_KEY no
                servidor para indexar e pesquisar.
              </p>
            ) : null}
            {semanticStatus?.teamEnabled ? (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Tarefas indexadas neste momento:{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {semanticStatus.indexedTaskCount}
                </span>
              </p>
            ) : null}
            {canConfigureTaskflowBoard(normalizeRole(role)) &&
            team?.taskflowSemanticSearchEnabled &&
            semanticStatus?.canBuildIndex ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={semanticSyncBusy}
                  onClick={async () => {
                    setSemanticSyncBusy(true);
                    setSemanticSearchMsg(null);
                    try {
                      const res = await fetch('/api/taskflow/semantic-search/sync', { method: 'POST' });
                      const payload = (await res.json().catch(() => ({}))) as {
                        error?: string;
                        indexed?: number;
                        skipped?: number;
                        note?: string;
                      };
                      if (!res.ok) {
                        setSemanticSearchMsg(payload.error || 'Erro ao sincronizar');
                        return;
                      }
                      await mutateSemanticStatus();
                      setSemanticSearchMsg(
                        `Sincronizado: ${payload.indexed ?? 0} tarefas indexadas` +
                          (payload.skipped ? ` · ${payload.skipped} ignoradas` : '') +
                          (payload.note ? `. ${payload.note}` : ''),
                      );
                    } catch (err) {
                      setSemanticSearchMsg(err instanceof Error ? err.message : 'Erro ao sincronizar');
                    } finally {
                      setSemanticSyncBusy(false);
                    }
                  }}
                >
                  {semanticSyncBusy ? 'A sincronizar…' : 'Reconstruir índice'}
                </Button>
              </div>
            ) : null}
            {team?.taskflowSemanticSearchEnabled && semanticStatus?.canBuildIndex ? (
              <div className="space-y-2 border-t border-slate-200/80 pt-3 dark:border-slate-700">
                <div className="flex flex-wrap gap-2">
                  <input
                    className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    placeholder="Descreva o que procura…"
                    value={semanticQuery}
                    onChange={(e) => setSemanticQuery(e.target.value)}
                    maxLength={2000}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={semanticSearchBusy || semanticQuery.trim().length < 2}
                    onClick={async () => {
                      setSemanticSearchBusy(true);
                      setSemanticSearchMsg(null);
                      try {
                        const q = encodeURIComponent(semanticQuery.trim());
                        const res = await fetch(`/api/taskflow/semantic-search?q=${q}&limit=15`);
                        const json = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          results?: { taskId: number; title: string; distance: number }[];
                        };
                        if (!res.ok) {
                          setSemanticHits(null);
                          setSemanticSearchMsg(json.error || 'Erro na pesquisa');
                          return;
                        }
                        setSemanticHits(json.results ?? []);
                      } catch (err) {
                        setSemanticHits(null);
                        setSemanticSearchMsg(err instanceof Error ? err.message : 'Erro na pesquisa');
                      } finally {
                        setSemanticSearchBusy(false);
                      }
                    }}
                  >
                    {semanticSearchBusy ? 'A pesquisar…' : 'Pesquisar'}
                  </Button>
                </div>
                {semanticHits && semanticHits.length > 0 ? (
                  <ul className="max-h-44 space-y-1 overflow-y-auto text-xs">
                    {semanticHits.map((h) => (
                      <li key={h.taskId}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 text-left hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:bg-slate-900"
                          onClick={() => {
                            const task = (data?.tasks || []).find((t) => t.id === h.taskId);
                            if (task) {
                              openTaskEditor(task);
                            } else {
                              setError(`Tarefa #${h.taskId} não encontrada para edição.`);
                            }
                            setSemanticSearchMsg(null);
                          }}
                        >
                          <span className="font-mono text-[10px] text-slate-500">#{h.taskId}</span>{' '}
                          <span className="font-medium">{h.title}</span>
                          <span className="block text-[11px] text-slate-500">
                            proximidade (cosseno){' '}
                            {typeof h.distance === 'number' ? h.distance.toFixed(4) : h.distance}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : semanticHits && semanticHits.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum resultado próximo.</p>
                ) : null}
              </div>
            ) : team?.taskflowSemanticSearchEnabled && !semanticStatus?.canBuildIndex ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pesquisa indisponível até a instância autorizar OpenAI (integrações globais + chave no
                servidor).
              </p>
            ) : null}
            {semanticSearchMsg ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                {semanticSearchMsg}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {hubTab === 'painel' && cloudAiStatusSwrKey ? (
        <Card className="border-indigo-200/70 bg-white/90 shadow-sm backdrop-blur-sm dark:border-indigo-900/40 dark:bg-slate-900/70">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-indigo-500" aria-hidden />
              Modelo na nuvem
            </CardTitle>
            <CardDescription>
              Opcional: pedidos de teste a OpenAI ou Gemini quando a instância autoriza chaves e a equipe ativa a
              adesão à função. Mostra uso mensal e limite; não altera tarefas sozinho. Segredos só no servidor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Mês ({cloudAiStatus?.periodYm ?? '—'}):{' '}
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {cloudAiStatus?.usage.requests ?? 0} / {cloudAiStatus?.monthlyRequestCap ?? '—'} pedidos
              </span>
              {cloudAiStatus && cloudAiStatus.usage.promptTokens > 0 ? (
                <>
                  {' '}
                  · texto (entrada / saída, em tokens): {cloudAiStatus.usage.promptTokens} /{' '}
                  {cloudAiStatus.usage.completionTokens}
                </>
              ) : null}
            </p>
            {cloudAiStatus && !cloudAiStatus.ready && cloudAiStatus.blockReason ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                {cloudAiStatus.blockReason}
              </p>
            ) : null}
            {canConfigureTaskflowBoard(normalizeRole(role)) ? (
              <div className="space-y-2 rounded-xl border border-indigo-200/60 bg-indigo-50/50 px-3 py-2 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-indigo-500"
                  checked={Boolean(cloudAiStatus?.teamEnabled)}
                  disabled={
                    cloudAiOptBusy ||
                    cloudAiStatus == null ||
                    (!cloudAiStatus.teamEnabled && !cloudAiKeysReadyForDraft)
                  }
                  onChange={async (e) => {
                    const turnOn = e.target.checked;
                    if (turnOn) {
                      if (cloudAiStatus == null || !cloudAiKeysReadyForDraft) {
                        toast.showError(
                          cloudAiProviderDraft === 'openai'
                            ? 'OpenAI não está disponível: ative o toggle nas integrações globais e defina OPENAI_API_KEY.'
                            : 'Gemini não está disponível: ative o toggle nas integrações globais e defina GEMINI_API_KEY.',
                          'Modelo na nuvem',
                        );
                        return;
                      }
                    }
                    setCloudAiOptBusy(true);
                    try {
                      if (turnOn) {
                        const res = await fetch('/api/team/taskflow-cloud-ai', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            enabled: true,
                            provider: cloudAiProviderDraft,
                          }),
                        });
                        const j = (await res.json().catch(() => ({}))) as { error?: string };
                        if (!res.ok) {
                          toast.showError(j.error || 'Erro ao ativar', 'Modelo na nuvem');
                          return;
                        }
                      } else {
                        const res = await fetch('/api/team/taskflow-cloud-ai', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enabled: false }),
                        });
                        const j = (await res.json().catch(() => ({}))) as { error?: string };
                        if (!res.ok) {
                          toast.showError(j.error || 'Erro ao desativar', 'Modelo na nuvem');
                          return;
                        }
                      }
                      await swrMutate('/api/team');
                      await mutateCloudAiStatus();
                      if (turnOn) {
                        toast.showSuccess('Modelo na nuvem ativado para a equipe.');
                      } else {
                        toast.showSuccess('Modelo na nuvem desativado.');
                      }
                    } catch (err) {
                      toast.showError(
                        err instanceof Error ? err.message : 'Erro',
                        'Modelo na nuvem',
                      );
                    } finally {
                      setCloudAiOptBusy(false);
                    }
                  }}
                />
                  <span>Ativar modelo na nuvem para esta equipe (adesão explícita).</span>
                </label>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                  Fornecedor
                  <Select
                    value={cloudAiProviderDraft}
                    onValueChange={async (v) => {
                      const next = v as 'openai' | 'gemini';
                      if (cloudAiStatus?.teamEnabled) {
                        const ok =
                          next === 'openai'
                            ? cloudAiStatus.platform.openai && cloudAiStatus.envConfigured.openai
                            : cloudAiStatus.platform.gemini && cloudAiStatus.envConfigured.gemini;
                        if (!ok) {
                          toast.showError(
                            next === 'openai'
                              ? 'OpenAI não está disponível: ative o toggle nas integrações globais e defina OPENAI_API_KEY.'
                              : 'Gemini não está disponível: ative o toggle nas integrações globais e defina GEMINI_API_KEY.',
                            'Modelo na nuvem',
                          );
                          return;
                        }
                      }
                      setCloudAiProviderDraft(next);
                      if (!cloudAiStatus?.teamEnabled) return;
                      setCloudAiOptBusy(true);
                      try {
                        const res = await fetch('/api/team/taskflow-cloud-ai', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ provider: next }),
                        });
                        const j = (await res.json().catch(() => ({}))) as { error?: string };
                        if (!res.ok) {
                          toast.showError(j.error || 'Erro ao mudar fornecedor', 'Modelo na nuvem');
                          return;
                        }
                        await swrMutate('/api/team');
                        await mutateCloudAiStatus();
                        toast.showSuccess('Fornecedor atualizado.');
                      } catch (err) {
                        toast.showError(
                          err instanceof Error ? err.message : 'Erro',
                          'Modelo na nuvem',
                        );
                      } finally {
                        setCloudAiOptBusy(false);
                      }
                    }}
                    disabled={cloudAiOptBusy}
                  >
                    <SelectTrigger className="mt-1 h-9 w-full max-w-xs rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Limite mensal de pedidos
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      className="mt-1 h-9 w-28 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                      value={cloudAiCapDraft}
                      onChange={(ev) => setCloudAiCapDraft(ev.target.value)}
                      disabled={cloudAiCapBusy}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={cloudAiCapBusy}
                    onClick={async () => {
                      setCloudAiCapBusy(true);
                      try {
                        const n = Number(cloudAiCapDraft);
                        const res = await fetch('/api/team/taskflow-cloud-ai', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ monthlyRequestCap: n }),
                        });
                        const j = (await res.json().catch(() => ({}))) as { error?: string };
                        if (!res.ok) {
                          toast.showError(j.error || 'Erro ao gravar', 'Modelo na nuvem');
                          return;
                        }
                        await swrMutate('/api/team');
                        await mutateCloudAiStatus();
                        toast.showSuccess('Limite mensal gravado.');
                      } catch (err) {
                        toast.showError(
                          err instanceof Error ? err.message : 'Erro',
                          'Modelo na nuvem',
                        );
                      } finally {
                        setCloudAiCapBusy(false);
                      }
                    }}
                  >
                    Gravar limite
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Instância: OpenAI permitido = {cloudAiStatus?.platform.openai ? 'sim' : 'não'} (chave{' '}
                  {cloudAiStatus?.envConfigured.openai ? 'definida' : 'em falta'}); Gemini permitido ={' '}
                  {cloudAiStatus?.platform.gemini ? 'sim' : 'não'} (chave{' '}
                  {cloudAiStatus?.envConfigured.gemini ? 'definida' : 'em falta'}).
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A ativação e o limite mensal são geridos por administrador ou gestor do quadro.
              </p>
            )}
            <div className="space-y-2 border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                Pedido de teste (um turno)
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                  placeholder="Ex.: Resuma em três frases o que é um quadro Kanban."
                  value={cloudAiPrompt}
                  onChange={(ev) => setCloudAiPrompt(ev.target.value)}
                  disabled={!cloudAiStatus?.ready || cloudAiTestBusy}
                  maxLength={12000}
                />
              </label>
              {cloudAiTestError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">{cloudAiTestError}</p>
              ) : null}
              {cloudAiTestOutput ? (
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-2 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100">
                  <p className="font-semibold text-slate-600 dark:text-slate-300">Resposta</p>
                  <p className="mt-1 whitespace-pre-wrap">{cloudAiTestOutput}</p>
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="rounded-lg"
                disabled={!cloudAiStatus?.ready || cloudAiTestBusy}
                onClick={async () => {
                  setCloudAiTestBusy(true);
                  setCloudAiTestError(null);
                  setCloudAiTestOutput(null);
                  try {
                    const res = await fetch('/api/taskflow/cloud-ai/chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prompt: cloudAiPrompt }),
                    });
                    const j = (await res.json().catch(() => ({}))) as { error?: string; text?: string };
                    if (!res.ok) {
                      setCloudAiTestError(j.error || 'Pedido falhou');
                      return;
                    }
                    if (typeof j.text === 'string') {
                      setCloudAiTestOutput(j.text);
                    }
                    await mutateCloudAiStatus();
                  } catch (err) {
                    setCloudAiTestError(err instanceof Error ? err.message : 'Erro');
                  } finally {
                    setCloudAiTestBusy(false);
                  }
                }}
              >
                {cloudAiTestBusy ? 'A enviar…' : 'Enviar teste'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hubTab === 'operar' ? (
        <>
      {sprintFilterId != null &&
      Number.isFinite(sprintFilterId) &&
      unsprintedTasksHiddenBySprintFilterCount > 0 ? (
        <div
          className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          <span className="font-semibold">Filtro de sprint ativo.</span>{' '}
          {unsprintedTasksHiddenBySprintFilterCount === 1
            ? 'Há 1 tarefa sem sprint que deixa de aparecer no quadro com esta sprint seleccionada.'
            : `Há ${unsprintedTasksHiddenBySprintFilterCount} tarefas sem sprint que deixam de aparecer no quadro com esta sprint seleccionada.`}{' '}
          Escolha «Todas as sprints» no filtro para as voltar a ver.
        </div>
      ) : null}

        </>
      ) : null}

      {hubTab === 'painel' ? (
        <>
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Total de tarefas</CardTitle>
            <CardDescription>Volume total monitorado</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-4xl font-semibold tracking-tight atlas-gradient-text">
              {stats.total}
            </div>
            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
              {stats.completionRate}% concluído
            </div>
          </CardContent>
        </Card>

        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Entregas</CardTitle>
            <CardDescription>Tarefas finalizadas</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-4xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-300">
              {stats.completed}
            </div>
            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
              {stats.inProgress} em andamento · {stats.overdue} atrasadas
            </div>
          </CardContent>
        </Card>

        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Ritmo do quadro</CardTitle>
            <CardDescription>Distribuição por coluna</CardDescription>
          </CardHeader>
          <CardContent>
            <svg width="100%" height="64" viewBox="0 0 220 64">
              <path
                d={buildSparkline(stats.columnCounts, 220, 56)}
                fill="none"
                stroke="url(#spark)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="spark" x1="0" x2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Tempo médio</CardTitle>
            <CardDescription>Prazo ponta a ponta e tempo em aberto</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span>Prazo médio (ponta a ponta)</span>
              <span className="font-semibold">{stats.avgLeadTime}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Em aberto</span>
              <span className="font-semibold">{stats.avgOpenTime}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tempo de ciclo</span>
              <span className="font-semibold">{metrics?.cycleTimeAvg ?? 0}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Gargalo</span>
              <span className="font-semibold">
                {bottleneckColumnName || '—'} {metrics?.bottleneckDays ? `(${metrics.bottleneckDays}d)` : ''}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Checklist diário</CardTitle>
            <CardDescription>
              A sua lista por data: marca concluído, remove ou acrescenta tarefas do quadro que já vê. Gravado
              na conta; não muda prazos nem estados no Kanban.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={dailyChecklistDate}
                onChange={(event) => setDailyChecklistDate(event.target.value)}
              />
            </div>
            {(dailyChecklistItems || []).length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma tarefa no checklist. Adicione tarefas do quadro abaixo.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {(dailyChecklistItems || []).map((item) => (
                  <li
                    key={item.id}
                    className={`atlas-item flex items-center justify-between gap-2 ${item.checked ? 'opacity-60 line-through' : ''}`}
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={async () => {
                          await fetch('/api/taskflow/daily-checklist', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id: item.id,
                              checked: !item.checked,
                            }),
                          });
                          mutateDailyChecklist();
                        }}
                      />
                      <span className={getPriorityStyle(item.taskPriority)}>
                        {getPriorityLabel(item.taskPriority)}
                      </span>
                      <span>{item.taskTitle}</span>
                    </label>
                    <button
                      type="button"
                      className="rounded-full border border-rose-400 px-2 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-500 hover:text-white dark:border-rose-500 dark:text-rose-200 dark:hover:bg-rose-500 dark:hover:text-white"
                      onClick={async () => {
                        await fetch(`/api/taskflow/daily-checklist?id=${item.id}`, {
                          method: 'DELETE',
                        });
                        mutateDailyChecklist();
                      }}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Select
                value={dailyAddTaskValue}
                onValueChange={async (v) => {
                  if (v === '_none') return;
                  const taskId = Number(v);
                  if (!taskId) return;
                  await fetch('/api/taskflow/daily-checklist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      taskId,
                      date: dailyChecklistDate,
                    }),
                  });
                  setDailyAddTaskValue('_none');
                  mutateDailyChecklist();
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Adicionar tarefa…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Adicionar tarefa…</SelectItem>
                  {(data?.tasks || [])
                    .filter(
                      (task) =>
                        !(dailyChecklistItems || []).some((c) => c.taskId === task.id),
                    )
                    .map((task) => (
                      <SelectItem key={task.id} value={String(task.id)}>
                        {task.title} ({getPriorityLabel(task.priority)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Resumo semanal</CardTitle>
            <CardDescription>Últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span>Tarefas criadas</span>
              <span className="font-semibold">{weeklySummary.created}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tarefas concluídas</span>
              <span className="font-semibold">{weeklySummary.completed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Prioridades de hoje</CardTitle>
            <CardDescription>Foco automático com base em prazos</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {todayInsights.focusList.length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma prioridade detectada para hoje.
              </div>
            ) : (
              todayInsights.focusList.map((task) => (
                <div key={task.id} className="atlas-item flex items-center justify-between">
                  <div>
                    <p className="atlas-item-title">{task.title}</p>
                    <p className="atlas-item-meta">
                      {task.dueDate
                        ? `Prazo: ${formatDateTimePtShort(task.dueDate)}`
                        : 'Sem prazo'}
                    </p>
                  </div>
                  <span className={`atlas-badge border ${getPriorityStyle(task.priority)}`}>
                    {getPriorityLabel(task.priority)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Alertas inteligentes</CardTitle>
            <CardDescription>Recomendações proativas</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            {todayInsights.alerts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tudo sob controle por enquanto.
              </p>
            ) : (
              todayInsights.alerts.map((alert, index) => (
                <div key={`${alert}-${index}`} className="atlas-item">
                  {alert}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
        </>
      ) : null}

      {hubTab === 'definicoes' && data && canConfigureTaskflowBoard(role) ? (
        <>
        <Card className="atlas-surface mb-4 transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Fases do Kanban</CardTitle>
            <CardDescription>
              Cadastre colunas com tipo <strong>Inicial</strong> (só uma), <strong>Produção</strong> ou{' '}
              <strong>Final</strong> (várias). Opcional: horas máximas na fase (aviso no quadro) e cor da faixa
              (token ou #hex).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {data.columns.map((col) =>
                editingColumnId === col.id ? (
                  <div
                    key={col.id}
                    className="flex flex-col gap-2 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/25 sm:flex-row sm:flex-wrap sm:items-end"
                  >
                    <div className="min-w-0 flex-1 sm:min-w-[140px]">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Nome</label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        value={editColumnName}
                        onChange={(e) => setEditColumnName(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:max-w-md sm:flex-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Descrição</label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        value={editColumnDescription}
                        onChange={(e) => setEditColumnDescription(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:w-40">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Tipo</label>
                      <Select value={editColumnPhaseType} onValueChange={setEditColumnPhaseType}>
                        <SelectTrigger className="mt-1 rounded-2xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INITIAL">Inicial</SelectItem>
                          <SelectItem value="PRODUCTION">Produção</SelectItem>
                          <SelectItem value="FINAL">Final</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:w-28">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Máx. horas</label>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        placeholder="—"
                        value={editColumnMaxStay}
                        onChange={(e) => setEditColumnMaxStay(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:w-32">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Faixa</label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        placeholder="indigo ou #hex"
                        value={editColumnStripe}
                        onChange={(e) => setEditColumnStripe(e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={isSaving}
                        onClick={() => setEditingColumnId(null)}
                      >
                        {ACTION_COPY.cancel}
                      </Button>
                      <Button
                        type="button"
                        className="rounded-full"
                        disabled={isSaving || !editColumnName.trim()}
                        onClick={handleSaveColumn}
                      >
                        {isSaving ? ACTION_COPY.saving : ACTION_COPY.save}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="rounded-full"
                        disabled={isSaving}
                        onClick={() => handleDeleteColumn(col.id)}
                      >
                        {ACTION_COPY.delete}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={col.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 px-3 py-2 dark:border-slate-700/80"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{col.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {phaseTypeLabelLoose(col.phaseType)}
                        {col.maxStayHours != null && col.maxStayHours > 0
                          ? ` · máx. ${col.maxStayHours}h`
                          : ' · sem limite de tempo'}
                        {col.stripeColor ? ` · faixa: ${col.stripeColor}` : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => openColumnEditor(col)}
                    >
                      Editar
                    </Button>
                  </div>
                ),
              )}
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300/80 p-3 dark:border-slate-600/80">
              <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Nova fase</p>
              <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-end">
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Nome da fase"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                  />
                </div>
                <div className="w-full xl:min-w-[12rem] xl:flex-1">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Descrição (opcional)"
                    value={newColumnDescription}
                    onChange={(e) => setNewColumnDescription(e.target.value)}
                  />
                </div>
                <div className="w-full xl:w-40">
                  <Select value={newColumnPhaseType} onValueChange={setNewColumnPhaseType}>
                    <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INITIAL">Inicial</SelectItem>
                      <SelectItem value="PRODUCTION">Produção</SelectItem>
                      <SelectItem value="FINAL">Final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full xl:w-28">
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Máx. h"
                    value={newColumnMaxStay}
                    onChange={(e) => setNewColumnMaxStay(e.target.value)}
                  />
                </div>
                <div className="w-full xl:w-32">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Faixa"
                    value={newColumnStripe}
                    onChange={(e) => setNewColumnStripe(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={isSaving || !newColumnName.trim()}
                  onClick={handleCreateColumn}
                >
                  Adicionar fase
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="atlas-surface mb-4 transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Catálogo de status</CardTitle>
            <CardDescription>
              Situações fixas alinham regras (ex.: coluna final → concluído). A cor aparece na vista em lista.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {(data.statusDefinitions || []).map((row) =>
                editingStatusDefId === row.id ? (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/25 sm:flex-row sm:flex-wrap sm:items-end"
                  >
                    <div className="min-w-0 flex-1 sm:min-w-[140px]">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Nome</label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        value={editStatName}
                        onChange={(e) => setEditStatName(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:max-w-md sm:flex-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Descrição</label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        value={editStatDescription}
                        onChange={(e) => setEditStatDescription(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:w-32">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Cor</label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        value={editStatColor}
                        onChange={(e) => setEditStatColor(e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                    <div className="w-full sm:w-24">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Ordem</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        value={editStatPosition}
                        onChange={(e) => setEditStatPosition(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={isSaving}
                        onClick={() => setEditingStatusDefId(null)}
                      >
                        {ACTION_COPY.cancel}
                      </Button>
                      <Button
                        type="button"
                        className="rounded-full"
                        disabled={isSaving || !editStatName.trim()}
                        onClick={handleSaveStatusDefinition}
                      >
                        {isSaving ? ACTION_COPY.saving : ACTION_COPY.save}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="rounded-full"
                        disabled={isSaving}
                        onClick={() => handleDeleteStatusDefinition(row.id)}
                      >
                        {ACTION_COPY.delete}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 px-3 py-2 dark:border-slate-700/80"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {row.code} · {row.fixedSituation}
                        {row.color ? ` · cor: ${row.color}` : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => openStatusDefinitionEditor(row)}
                    >
                      Editar
                    </Button>
                  </div>
                ),
              )}
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300/80 p-3 dark:border-slate-600/80">
              <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Novo status</p>
              <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="código (ex.: revisao)"
                    value={newStatCode}
                    onChange={(e) => setNewStatCode(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Nome visível"
                    value={newStatName}
                    onChange={(e) => setNewStatName(e.target.value)}
                  />
                </div>
                <div className="w-full lg:w-44">
                  <Select value={newStatFixed} onValueChange={setNewStatFixed}>
                    <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASKFLOW_FIXED_SITUATIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full lg:w-36">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Cor (token ou #hex)"
                    value={newStatColor}
                    onChange={(e) => setNewStatColor(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div className="w-full lg:min-w-[10rem] lg:flex-1">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Descrição (opcional)"
                    value={newStatDescription}
                    onChange={(e) => setNewStatDescription(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={isSaving || !newStatCode.trim() || !newStatName.trim()}
                  onClick={handleCreateStatusDefinition}
                >
                  Adicionar status
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="atlas-surface mb-4 transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Tipos de tarefa (personalizados)</CardTitle>
            <CardDescription>
              Além dos tipos nativos no formulário, pode definir códigos próprios da equipe. O código não pode
              coincidir com um tipo nativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {(data.taskTypeDefinitions || []).map((row) =>
                editingTaskTypeDefId === row.id ? (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/25 sm:flex-row sm:flex-wrap sm:items-end"
                  >
                    <div className="min-w-0 flex-1 sm:min-w-[140px]">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Nome</label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        value={editTtName}
                        onChange={(e) => setEditTtName(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:max-w-md sm:flex-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Descrição</label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        value={editTtDescription}
                        onChange={(e) => setEditTtDescription(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:w-24">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Ordem</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                        value={editTtPosition}
                        onChange={(e) => setEditTtPosition(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={isSaving}
                        onClick={() => setEditingTaskTypeDefId(null)}
                      >
                        {ACTION_COPY.cancel}
                      </Button>
                      <Button
                        type="button"
                        className="rounded-full"
                        disabled={isSaving || !editTtName.trim()}
                        onClick={handleSaveTaskTypeDefinition}
                      >
                        {isSaving ? ACTION_COPY.saving : ACTION_COPY.save}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="rounded-full"
                        disabled={isSaving}
                        onClick={() => handleDeleteTaskTypeDefinition(row.id)}
                      >
                        {ACTION_COPY.delete}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 px-3 py-2 dark:border-slate-700/80"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">código: {row.code}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => openTaskTypeDefinitionEditor(row)}
                    >
                      Editar
                    </Button>
                  </div>
                ),
              )}
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300/80 p-3 dark:border-slate-600/80">
              <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Novo tipo personalizado</p>
              <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="código (ex.: homologacao)"
                    value={newTtCode}
                    onChange={(e) => setNewTtCode(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Nome visível"
                    value={newTtName}
                    onChange={(e) => setNewTtName(e.target.value)}
                  />
                </div>
                <div className="w-full lg:min-w-[12rem] lg:flex-1">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Descrição (opcional)"
                    value={newTtDescription}
                    onChange={(e) => setNewTtDescription(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={isSaving || !newTtCode.trim() || !newTtName.trim()}
                  onClick={handleCreateTaskTypeDefinition}
                >
                  Adicionar tipo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </>
      ) : null}

      {hubTab === 'nova_tarefa' ? (
        <>
      <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Nova tarefa</CardTitle>
              <CardDescription>Capture ideias rápido e organize depois</CardDescription>
            </div>
            {canConfigureTaskflowBoard(normalizeRole(role)) ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setNewSprintPanelOpen(true)}
              >
                Gestão de sprint
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Título em destaque, sempre visível e amplo */}
          <div>
            <label
              htmlFor="task-title"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Título da tarefa
            </label>
            <input
              id="task-title"
              type="text"
              className="block w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-indigo-400"
              placeholder="Ex.: Revisar proposta comercial, Preparar apresentação..."
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Comece digitando o nome da tarefa acima.
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Coluna
                  </label>
                  <Select
                    value={columnId ? String(columnId) : '_none'}
                    onValueChange={(v) => setColumnId(v === '_none' ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full rounded-2xl">
                      <SelectValue placeholder="Coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Selecione a coluna</SelectItem>
                      {data?.columns?.map((column) => (
                        <SelectItem key={column.id} value={String(column.id)}>
                          {column.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Tipo de tarefa
                  </label>
                  <Select value={taskType} onValueChange={setTaskType}>
                    <SelectTrigger className="w-full rounded-2xl">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {NATIVE_TASK_TYPES.map((t) => (
                        <SelectItem key={t.code} value={t.code}>
                          {t.label}
                        </SelectItem>
                      ))}
                      {taskTypeCustomRows.map((t) => (
                        <SelectItem key={`c-${t.id}`} value={t.code}>
                          {t.name} (personalizado)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Prioridade
                  </label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="w-full rounded-2xl">
                      <SelectValue placeholder="Prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="MEDIUM">Média</SelectItem>
                      <SelectItem value="LOW">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Estado inicial
                  </label>
                  <Select
                    value={createStatusId ? String(createStatusId) : '_none'}
                    onValueChange={(v) => setCreateStatusId(v === '_none' ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full rounded-2xl">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.statusDefinitions || []).map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Prazo de entrega (data e hora)
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Início previsto (opcional)
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    value={plannedStartLocal}
                    onChange={(event) => setPlannedStartLocal(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Duração est. (h)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="ex.: 4 ou 1,5"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    value={estimatedHours}
                    onChange={(event) => setEstimatedHours(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Recorrência
                  </label>
                  <Select value={newRecurrenceRule} onValueChange={setNewRecurrenceRule}>
                    <SelectTrigger className="w-full rounded-2xl">
                      <SelectValue placeholder="Recorrência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem recorrência</SelectItem>
                      <SelectItem value="DAILY">Diária</SelectItem>
                      <SelectItem value="WEEKLY">Semanal</SelectItem>
                      <SelectItem value="MONTHLY">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newRecurrenceRule !== '_none' ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                      Repetir até (opcional)
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                      value={newRecurrenceUntil}
                      onChange={(event) => setNewRecurrenceUntil(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Projeto
                  </label>
                  <Select
                    value={projectId ? String(projectId) : '_none'}
                    onValueChange={(v) => setProjectId(v === '_none' ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full rounded-2xl">
                      <SelectValue placeholder="Projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem projeto</SelectItem>
                      {projectsList.map((project) => (
                        <SelectItem key={project.id} value={String(project.id)}>
                          {project.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Tarefa pai (épico)
                  </label>
                  <Select
                    value={createParentTaskId == null ? '_none' : String(createParentTaskId)}
                    onValueChange={(v) =>
                      setCreateParentTaskId(v === '_none' ? null : Number(v))
                    }
                  >
                    <SelectTrigger className="w-full rounded-2xl">
                      <SelectValue placeholder="Sem pai" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="_none">Nenhuma (tarefa raiz)</SelectItem>
                      {(data?.tasks || [])
                        .slice()
                        .sort((a, b) => a.title.localeCompare(b.title, 'pt'))
                        .map((t) => (
                          <SelectItem key={`p-${t.id}`} value={String(t.id)}>
                            #{t.id} · {t.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Sprint
                  </label>
                  <Select
                    value={createSprintId == null ? '_none' : String(createSprintId)}
                    onValueChange={(v) =>
                      setCreateSprintId(v === '_none' ? null : Number(v))
                    }
                  >
                    <SelectTrigger className="w-full rounded-2xl">
                      <SelectValue placeholder="Sem sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem sprint</SelectItem>
                      {(data?.sprints || []).map((sp) => (
                        <SelectItem key={`cs-${sp.id}`} value={String(sp.id)}>
                          {sp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
                Responsáveis
              </p>
              <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                Opcional: se não escolher ninguém, fica só o criador; caso contrário, o criador entra na lista automaticamente.
              </p>
              <div className="flex max-h-36 flex-wrap content-start gap-x-5 gap-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950/60">
                {team?.teamMembers?.length ? (
                  team.teamMembers.map((member) => {
                    const on = assigneeIds.includes(member.user.id);
                    return (
                      <label
                        key={member.user.id}
                        className="flex min-w-[10rem] cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={on}
                          onChange={() => {
                            setAssigneeIds((prev) =>
                              on
                                ? prev.filter((id) => id !== member.user.id)
                                : [...prev, member.user.id],
                            );
                          }}
                        />
                        <span className="truncate">{member.user.name || member.user.email}</span>
                      </label>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-400">Sem membros na equipe</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-5 dark:border-slate-700/80">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Preencha o <strong>título</strong>, escolha a <strong>coluna</strong> e o{' '}
                  <strong>prazo com hora</strong> para criar. Início previsto, duração, projeto, tarefa pai e sprint são opcionais.
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="w-full shrink-0 rounded-xl sm:w-auto sm:min-w-[11rem]"
                  onClick={handleCreateTask}
                  disabled={isCreating || !title.trim() || !columnId || !dueDate}
                >
                  {isCreating ? 'Salvando…' : 'Criar tarefa'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Etiquetas
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {data?.labels?.length ? (
                  data.labels.map((label) => {
                    if (editingLabelId === label.id) {
                      return (
                      <div
                        key={label.id}
                        className="flex w-full flex-col gap-2 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/25 sm:flex-row sm:flex-wrap sm:items-end"
                      >
                        <div className="min-w-0 flex-1 sm:min-w-[140px]">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                            Nome
                          </label>
                          <input
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                            value={editLabelName}
                            onChange={(event) => setEditLabelName(event.target.value)}
                          />
                        </div>
                        <div className="w-full sm:w-[8.5rem]">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                            Cor
                          </label>
                          <Select value={editLabelColor} onValueChange={setEditLabelColor}>
                            <SelectTrigger className="mt-1 rounded-2xl">
                              <SelectValue placeholder="Cor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="indigo">Índigo</SelectItem>
                              <SelectItem value="emerald">Esmeralda</SelectItem>
                              <SelectItem value="amber">Âmbar</SelectItem>
                              <SelectItem value="rose">Rosa</SelectItem>
                              <SelectItem value="cyan">Ciano</SelectItem>
                              <SelectItem value="violet">Violeta</SelectItem>
                              <SelectItem value="slate">Ardósia</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-full min-w-0 sm:max-w-[11rem] sm:flex-1">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                            Hex (opcional)
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                            placeholder="#2563EB"
                            value={editLabelHex}
                            onChange={(event) => setEditLabelHex(event.target.value)}
                            spellCheck={false}
                          />
                        </div>
                        <div className="w-full sm:w-[10.5rem]">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                            Prioridade
                          </label>
                          <Select value={editLabelPriority} onValueChange={setEditLabelPriority}>
                            <SelectTrigger className="mt-1 rounded-2xl">
                              <SelectValue placeholder="Prioridade" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="URGENT">Urgente</SelectItem>
                              <SelectItem value="HIGH">Alta</SelectItem>
                              <SelectItem value="MEDIUM">Média</SelectItem>
                              <SelectItem value="LOW">Baixa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            disabled={isSaving}
                            onClick={() => setEditingLabelId(null)}
                          >
                            {ACTION_COPY.cancel}
                          </Button>
                          <Button
                            type="button"
                            className="rounded-full"
                            disabled={isSaving || !editLabelName.trim()}
                            onClick={handleSaveLabel}
                          >
                            {isSaving ? ACTION_COPY.saving : ACTION_COPY.save}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            className="rounded-full"
                            disabled={isSaving}
                            onClick={() => handleDeleteLabel(label.id)}
                          >
                            {ACTION_COPY.delete}
                          </Button>
                        </div>
                      </div>
                      );
                    }
                    const chipOn = labelChipAppearance(label.color);
                    const selected = selectedLabelIds.includes(label.id);
                    return (
                      <div key={label.id} className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={`rounded-full px-3 py-1 text-left text-xs font-semibold ${
                            selected
                              ? chipOn.className
                              : 'border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'
                          }`}
                          style={selected ? chipOn.style : undefined}
                          onClick={() =>
                            setSelectedLabelIds((prev) =>
                              prev.includes(label.id)
                                ? prev.filter((id) => id !== label.id)
                                : [...prev, label.id],
                            )
                          }
                        >
                          <span>{label.name}</span>
                          <span className="ml-1.5 text-[10px] font-normal opacity-75">
                            ({getPriorityLabel(label.priority || 'MEDIUM')})
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full px-2 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          onClick={() => openLabelEditor(label)}
                        >
                          Editar
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-400">
                    Nenhuma etiqueta criada ainda.
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-end">
              <div className="min-w-0 flex-1 xl:min-w-[200px]">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Nova etiqueta
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  placeholder="Ex.: Pesquisa"
                  value={newLabelName}
                  onChange={(event) => setNewLabelName(event.target.value)}
                />
              </div>
              <div className="w-full xl:w-40">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Cor
                </label>
                <Select value={newLabelColor} onValueChange={setNewLabelColor}>
                  <SelectTrigger className="mt-2 rounded-2xl">
                    <SelectValue placeholder="Cor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indigo">Índigo</SelectItem>
                    <SelectItem value="emerald">Esmeralda</SelectItem>
                    <SelectItem value="amber">Âmbar</SelectItem>
                    <SelectItem value="rose">Rosa</SelectItem>
                    <SelectItem value="cyan">Ciano</SelectItem>
                    <SelectItem value="violet">Violeta</SelectItem>
                    <SelectItem value="slate">Ardósia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full min-w-0 xl:max-w-[11rem] xl:flex-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Hex (opcional)
                </label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  placeholder="#2563EB"
                  value={newLabelHex}
                  onChange={(event) => setNewLabelHex(event.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="w-full xl:w-44">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Prioridade da etiqueta
                </label>
                <Select value={newLabelPriority} onValueChange={setNewLabelPriority}>
                  <SelectTrigger className="mt-2 rounded-2xl">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="MEDIUM">Média</SelectItem>
                    <SelectItem value="LOW">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="shrink-0 rounded-full"
                disabled={isSaving || !newLabelName.trim()}
                onClick={handleCreateLabel}
              >
                {isSaving ? 'Salvando…' : 'Criar etiqueta'}
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se preencher <strong>hex</strong>, ele prevalece sobre a cor predefinida. Formato: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">#RGB</code> ou{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">#RRGGBB</code>.
            </p>
          </div>
        </CardContent>
      </Card>
        </>
      ) : null}

      {hubTab === 'definicoes' ? (
        <>
      <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
        <CardHeader className="gap-1">
          <CardTitle>Regras automáticas</CardTitle>
          <CardDescription>Automatize ações repetitivas</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
          <label className="flex items-center justify-between gap-3">
            <span>Atribuir tarefas novas ao criador</span>
            <input
              type="checkbox"
              checked={Boolean(automation?.autoAssignCreator)}
              onChange={async (event) => {
                const nextValue = event.target.checked;
                await fetch('/api/taskflow/automation', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    autoAssignCreator: nextValue,
                    autoHighPriorityOnDue: Boolean(
                      automation?.autoHighPriorityOnDue,
                    ),
                  }),
                });
                mutateAutomation();
              }}
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Prioridade alta se o prazo for até 48h</span>
            <input
              type="checkbox"
              checked={Boolean(automation?.autoHighPriorityOnDue)}
              onChange={async (event) => {
                const nextValue = event.target.checked;
                await fetch('/api/taskflow/automation', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    autoAssignCreator: Boolean(automation?.autoAssignCreator),
                    autoHighPriorityOnDue: nextValue,
                  }),
                });
                mutateAutomation();
              }}
            />
          </label>
        </CardContent>
      </Card>

      <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
        <CardHeader className="gap-1">
          <CardTitle>Webhooks de saída</CardTitle>
          <CardDescription>
            Envio em JSON (método POST) para endereço HTTPS quando tarefas são criadas ou atualizadas. Consulte a
            documentação interna sobre formato JSON, eventos e assinatura HMAC. Máximo de 5 endereços por equipe;
            deduplicação por URL de destino. Não altera e-mails do Taskflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link href="/manual/zapier-make">Manual (Zapier / Make)</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={whSampleBusy}
              onClick={async () => {
                setWhSampleBusy(true);
                setWhSampleUrl(null);
                toast.dismiss();
                try {
                  const res = await fetch('/api/taskflow/webhooks/sample-payload-link', { method: 'POST' });
                  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
                  if (!res.ok) {
                    throw new Error(j.error || 'Não foi possível gerar');
                  }
                  if (typeof j.url === 'string') {
                    setWhSampleUrl(j.url);
                  }
                } catch (e) {
                  console.error(e);
                  toast.showError(e instanceof Error ? e.message : 'Erro ao gerar URL');
                } finally {
                  setWhSampleBusy(false);
                }
              }}
            >
              {whSampleBusy ? 'A gerar…' : 'Gerar URL de exemplo (24 h)'}
            </Button>
          </div>
          {whSampleUrl ? (
            <p className="break-all rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 font-mono text-[11px] text-slate-800 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100">
              {whSampleUrl}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Nome</label>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="Ex.: Zapier / n8n"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">URL (https)</label>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Segredo opcional (HMAC-SHA256 do corpo)
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={whSecret}
                onChange={(e) => setWhSecret(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Eventos (códigos separados por vírgula)
              </label>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={whEvents}
                onChange={(e) => setWhEvents(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="self-start rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={!whName.trim() || !whUrl.trim()}
            onClick={async () => {
              toast.dismiss();
              const res = await fetch('/api/taskflow/webhooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: whName.trim(),
                  targetUrl: whUrl.trim(),
                  secret: whSecret.trim() || undefined,
                  events: whEvents.trim() || undefined,
                }),
              });
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              if (!res.ok) {
                toast.showError(data.error || 'Não foi possível criar');
                return;
              }
              setWhName('');
              setWhUrl('');
              setWhSecret('');
              setWhEvents('task.created,task.updated');
              await mutateWebhooks();
            }}
          >
            Adicionar webhook
          </button>
          <div className="mt-2 space-y-2">
            {(webhooksList || []).length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum webhook configurado.</p>
            ) : (
              (webhooksList || []).map((w) => (
                <div
                  key={w.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{w.name}</span>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={w.enabled}
                        onChange={async (e) => {
                          await fetch(`/api/taskflow/webhooks/${w.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enabled: e.target.checked }),
                          });
                          await mutateWebhooks();
                        }}
                      />
                      Ativo
                    </label>
                  </div>
                  <p className="break-all text-slate-600 dark:text-slate-300">{w.targetUrl}</p>
                  <p className="text-slate-500">Eventos: {w.events}</p>
                  {w.hasSecret ? (
                    <p className="text-slate-500">Segredo configurado (não mostrado).</p>
                  ) : null}
                  <button
                    type="button"
                    className="self-start text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
                    onClick={async () => {
                      if (!confirm('Remover este webhook?')) return;
                      await fetch(`/api/taskflow/webhooks/${w.id}`, { method: 'DELETE' });
                      await mutateWebhooks();
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
        <CardHeader className="gap-1">
          <CardTitle>Integração de desenvolvimento (GitHub / GitLab)</CardTitle>
          <CardDescription>
            Entrada via <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">POST</code> com corpo
            JSON e cabeçalho secreto — grava ligações <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">https://</code> na tarefa (commit, PR). Limite de pedidos por endereço IP; o webhook nativo do GitHub não envia{' '}
            <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">taskId</code> — use um script ou
            Action que monte o corpo mínimo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
          {devSecretShown ? (
            <p className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 font-mono text-[11px] text-violet-950 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-100">
              Guarde o segredo — não será mostrado outra vez:
              <br />
              {devSecretShown}
            </p>
          ) : null}
          <p className="text-xs">
            Estado:{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {devIntegrationConfig?.configured ? 'segredo configurado' : 'sem segredo'}
            </span>
          </p>
          <p className="break-all text-xs">
            <span className="font-semibold">Rota:</span> {devIntegrationConfig?.inboundPath ?? '/api/taskflow/inbound/dev'}
          </p>
          <p className="text-xs">
            <span className="font-semibold">Cabeçalho:</span>{' '}
            {devIntegrationConfig?.headerName ?? 'X-Atlas-Taskflow-Dev-Secret'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Corpo mínimo:{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
              {`{"taskId":123,"url":"https://github.com/org/repo/commit/abc","title":"fix: …"}`}
            </code>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full text-xs"
              onClick={async () => {
                toast.dismiss();
                setDevSecretShown(null);
                const res = await fetch('/api/team/taskflow-dev-integration', { method: 'POST' });
                const j = (await res.json().catch(() => ({}))) as { error?: string; secret?: string };
                if (res.status === 201 && typeof j.secret === 'string') {
                  setDevSecretShown(j.secret);
                  await mutateDevIntegration();
                  return;
                }
                if (res.status === 409) {
                  toast.showError(j.error || 'Segredo já existe. Use «Regenerar».');
                  return;
                }
                toast.showError(j.error || 'Não foi possível criar o segredo.');
              }}
            >
              Gerar segredo (primeira vez)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full text-xs"
              onClick={async () => {
                if (!confirm('Regenerar invalida o segredo anterior. Continuar?')) return;
                toast.dismiss();
                setDevSecretShown(null);
                const res = await fetch('/api/team/taskflow-dev-integration', { method: 'PATCH' });
                const j = (await res.json().catch(() => ({}))) as { error?: string; secret?: string };
                if (res.ok && typeof j.secret === 'string') {
                  setDevSecretShown(j.secret);
                  await mutateDevIntegration();
                  return;
                }
                toast.showError(j.error || 'Não foi possível regenerar.');
              }}
            >
              Regenerar segredo
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            API autenticada:{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET/POST /api/taskflow/tasks/…/external-links</code>{' '}
            (ligações manuais por tarefa).
          </p>
        </CardContent>
      </Card>

      <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
        <CardHeader className="gap-1">
          <CardTitle>Portal público</CardTitle>
          <CardDescription>
            Formulário sem login com fila de moderação antes de criar tarefa. Limite de pedidos por endereço IP;
            campo oculto anti-bot. Dados opcionais do remetente tratados pelo responsável pela equipe (LGPD).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
          {isOwnerLike(role) ? (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Coluna de destino (após aprovação)
              </label>
              <select
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={portalColumnSelect}
                disabled={!data?.columns?.length || portalBusy}
                onChange={async (e) => {
                  const v = e.target.value;
                  setPortalColumnSelect(v);
                  if (!team?.taskflowPublicPortalEnabled) return;
                  const col = Number(v);
                  if (!Number.isFinite(col)) return;
                  setPortalBusy(true);
                  toast.dismiss();
                  try {
                    const res = await fetch('/api/team/taskflow-public-portal', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enabled: true, columnId: col }),
                    });
                    const j = (await res.json().catch(() => ({}))) as { error?: string };
                    if (!res.ok) {
                      toast.showError(j.error || 'Erro ao atualizar coluna');
                      return;
                    }
                    await swrMutate('/api/team');
                  } finally {
                    setPortalBusy(false);
                  }
                }}
              >
                {(data?.columns || []).map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-400"
                  checked={Boolean(team?.taskflowPublicPortalEnabled)}
                  disabled={portalBusy || !data?.columns?.length}
                  onChange={async (e) => {
                    setPortalBusy(true);
                    toast.dismiss();
                    try {
                      const col = Number(portalColumnSelect);
                      if (e.target.checked && (!Number.isFinite(col) || col <= 0)) {
                        toast.showError('Escolha uma coluna válida.');
                        return;
                      }
                      const res = await fetch('/api/team/taskflow-public-portal', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          enabled: e.target.checked,
                          columnId: Number.isFinite(col) ? col : undefined,
                        }),
                      });
                      const j = (await res.json().catch(() => ({}))) as { error?: string };
                      if (!res.ok) {
                        toast.showError(j.error || 'Erro ao guardar');
                        return;
                      }
                      await swrMutate('/api/team');
                    } finally {
                      setPortalBusy(false);
                    }
                  }}
                />
                Ativar formulário público (gera URL secreta)
              </label>
              {team?.taskflowPublicPortalEnabled && team?.taskflowPublicPortalSlug ? (
                <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="break-all font-mono text-slate-800 dark:text-slate-100">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/taskflow-portal/${team.taskflowPublicPortalSlug}`
                      : `/taskflow-portal/${team.taskflowPublicPortalSlug}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
                      disabled={portalBusy}
                      onClick={async () => {
                        const url =
                          typeof window !== 'undefined'
                            ? `${window.location.origin}/taskflow-portal/${team.taskflowPublicPortalSlug}`
                            : '';
                        if (url) await navigator.clipboard.writeText(url);
                        toast.showSuccess('Link copiado para a área de transferência.');
                      }}
                    >
                      Copiar link
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-600"
                      disabled={portalBusy}
                      onClick={async () => {
                        const col = Number(portalColumnSelect);
                        if (!Number.isFinite(col)) return;
                        setPortalBusy(true);
                        toast.dismiss();
                        try {
                          const res = await fetch('/api/team/taskflow-public-portal', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              enabled: true,
                              columnId: col,
                              regenerateSlug: true,
                            }),
                          });
                          const j = (await res.json().catch(() => ({}))) as { error?: string };
                          if (!res.ok) {
                            toast.showError(j.error || 'Erro');
                            return;
                          }
                          await swrMutate('/api/team');
                          toast.showSuccess('Novo slug gerado. Atualize o link compartilhado.');
                        } finally {
                          setPortalBusy(false);
                        }
                      }}
                    >
                      Regenerar slug
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Só o proprietário ou o administrador ativa o portal e define a coluna de destino.
            </p>
          )}
          {canConfigureTaskflowBoard(role) ? (
            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                Fila de moderação (pendentes)
              </p>
              {!portalQueue?.length ? (
                <p className="text-xs text-slate-500">Nenhum pedido pendente.</p>
              ) : (
                <ul className="space-y-3">
                  {portalQueue.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl border border-slate-200/80 bg-white/90 p-3 text-xs dark:border-slate-700 dark:bg-slate-950/40"
                    >
                      <p className="font-semibold text-slate-900 dark:text-slate-50">{p.title}</p>
                      {p.description ? (
                        <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                          {p.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-slate-500">
                        {p.submitterName || '—'} · {p.submitterEmail || '—'} ·{' '}
                        {formatDateTimePtShort(p.createdAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          disabled={portalBusy}
                          onClick={async () => {
                            setPortalBusy(true);
                            toast.dismiss();
                            try {
                              const res = await fetch(`/api/taskflow/portal-submissions/${p.id}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'approve' }),
                              });
                              const j = (await res.json().catch(() => ({}))) as { error?: string };
                              if (!res.ok) {
                                toast.showError(j.error || 'Erro ao aprovar');
                                return;
                              }
                              await mutatePortalQueue();
                              await loadBoard();
                            } finally {
                              setPortalBusy(false);
                            }
                          }}
                        >
                          Aprovar → tarefa
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-300"
                          disabled={portalBusy}
                          onClick={async () => {
                            if (!confirm('Recusar este pedido?')) return;
                            setPortalBusy(true);
                            toast.dismiss();
                            try {
                              const res = await fetch(`/api/taskflow/portal-submissions/${p.id}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'reject' }),
                              });
                              const j = (await res.json().catch(() => ({}))) as { error?: string };
                              if (!res.ok) {
                                toast.showError(j.error || 'Erro');
                                return;
                              }
                              await mutatePortalQueue();
                            } finally {
                              setPortalBusy(false);
                            }
                          }}
                        >
                          Recusar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
        <CardHeader className="gap-1">
          <CardTitle>Automação avançada</CardTitle>
          <CardDescription>Regras com múltiplas condições</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="grid gap-3 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Nome
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                value={newRuleName}
                onChange={(event) => setNewRuleName(event.target.value)}
                placeholder="Ex.: Prazo curto + sem responsável"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Prazo ≤ (dias)
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                value={newRuleDueDays}
                onChange={(event) => setNewRuleDueDays(event.target.value)}
                placeholder="2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Prioridade
              </label>
              <Select value={newRulePriority} onValueChange={setNewRulePriority}>
                <SelectTrigger className="mt-2 rounded-2xl">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANY">Qualquer</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="MEDIUM">Média</SelectItem>
                  <SelectItem value="LOW">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Condição
              </label>
              <Select
                value={newRuleAssigneeMissing ? 'missing' : 'any'}
                onValueChange={(v) => setNewRuleAssigneeMissing(v === 'missing')}
              >
                <SelectTrigger className="mt-2 rounded-2xl">
                  <SelectValue placeholder="Condição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer responsável</SelectItem>
                  <SelectItem value="missing">Sem responsável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Ação prioridade
              </label>
              <Select value={newRuleSetPriority} onValueChange={setNewRuleSetPriority}>
                <SelectTrigger className="mt-2 rounded-2xl">
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="MEDIUM">Média</SelectItem>
                  <SelectItem value="LOW">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={newRuleAssignCreator}
                  onChange={(event) => setNewRuleAssignCreator(event.target.checked)}
                />
                Atribuir ao criador
              </label>
            </div>
          </div>
          <div>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={isSaving || !newRuleName.trim()}
              onClick={async () => {
                const payload = {
                  name: newRuleName.trim(),
                  dueInDays: newRuleDueDays ? Number(newRuleDueDays) : null,
                  priorityEquals: newRulePriority === 'ANY' ? null : newRulePriority,
                  assigneeMissing: newRuleAssigneeMissing,
                  actionSetPriority: newRuleSetPriority,
                  actionAssignCreator: newRuleAssignCreator,
                };
                await fetch('/api/taskflow/automation-rules', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                setNewRuleName('');
                setNewRuleDueDays('');
                setNewRulePriority('ANY');
                setNewRuleAssigneeMissing(false);
                setNewRuleSetPriority('HIGH');
                setNewRuleAssignCreator(false);
                mutateAdvancedRules();
              }}
            >
              Criar regra
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {(advancedRules || []).length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma regra avançada criada
              </div>
            ) : (
              advancedRules?.map((rule) => (
                <div key={rule.id} className="atlas-item flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {rule.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        Ativa
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={async (event) => {
                            await fetch('/api/taskflow/automation-rules', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: rule.id, enabled: event.target.checked }),
                            });
                            mutateAdvancedRules();
                          }}
                        />
                      </label>
                      <Button
                        variant="destructive"
                        className="rounded-full"
                        onClick={async () => {
                          await fetch(`/api/taskflow/automation-rules?id=${rule.id}`, {
                            method: 'DELETE',
                          });
                          mutateAdvancedRules();
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Condições:
                    {rule.dueInDays !== null ? ` prazo ≤ ${rule.dueInDays}d` : ' qualquer prazo'}
                    {rule.priorityEquals ? ` · prioridade ${rule.priorityEquals}` : ' · qualquer prioridade'}
                    {rule.assigneeMissing ? ' · sem responsável' : ''}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Ações:
                    {rule.actionSetPriority ? ` prioridade → ${rule.actionSetPriority}` : ''}
                    {rule.actionAssignCreator ? ' · atribuir ao criador' : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
        </>
      ) : null}

      {hubTab === 'painel' ? (
        <>
      <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
        <CardHeader className="gap-1">
          <CardTitle>Notificações recentes</CardTitle>
          <CardDescription>
            Últimas entradas de atividade da equipe no Taskflow (até seis na lista). Atribuições a si aparecem
            como notificação para si; as restantes ações do módulo entram para todos. Abaixo: opções de leitura em
            voz alta no navegador (equipe + preferência pessoal).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-2 text-xs dark:border-slate-700 dark:bg-slate-900/50">
            {canConfigureTaskflowBoard(normalizeRole(role)) ? (
              <label className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={Boolean(team?.taskflowTtsNotificationsAllowed)}
                  onChange={async (event) => {
                    const res = await fetch('/api/team/taskflow-tts-notifications', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ allowed: event.target.checked }),
                    });
                    if (!res.ok) {
                      const j = (await res.json().catch(() => ({}))) as { error?: string };
                      console.error(j.error || res.status);
                      return;
                    }
                    await swrMutate('/api/team');
                  }}
                />
                <span>Permitir que membros usem leitura em voz alta (navegador)</span>
              </label>
            ) : null}
            <label
              className={`mt-1 flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-200 ${
                !team?.taskflowTtsNotificationsAllowed ? 'cursor-not-allowed opacity-50' : ''
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                disabled={!team?.taskflowTtsNotificationsAllowed}
                checked={Boolean(user?.taskflowTtsNotificationsEnabled)}
                onChange={async (event) => {
                  const res = await fetch('/api/user/taskflow-tts-notifications', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: event.target.checked }),
                  });
                  if (!res.ok) {
                    const j = (await res.json().catch(() => ({}))) as { error?: string };
                    console.error(j.error || res.status);
                    return;
                  }
                  await swrMutate('/api/user');
                }}
              />
              <span>Ler novas notificações em voz alta neste dispositivo</span>
            </label>
            <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
              Usa a voz do sistema (Web Speech API). Não substitui e-mail nem o feed; limite de oito leituras por
              hora. Voz offline tipo Coqui TTS pode integrar-se em instalação self-hosted (ver documentação).
            </p>
          </div>
          {(notifications || []).length === 0 ? (
            <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
              Nenhuma notificação ainda
            </div>
          ) : (
            notifications?.slice(0, 6).map((item) => (
              <div key={item.id} className="atlas-item flex items-center justify-between">
                <span>{formatTaskflowAction(item.action)}</span>
                <span className="text-xs text-slate-400">
                  {new Date(item.timestamp).toLocaleString('pt-BR')}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
        </>
      ) : null}

      {hubTab === 'operar' ? (
        <>
      <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
        <CardHeader className="gap-1">
          <CardTitle>Integrações rápidas</CardTitle>
          <CardDescription>
            Transforme reuniões e agenda em tarefas. Impacto: esta ação cria uma tarefa no Taskflow sem alterar o
            registro de origem. O prazo da tarefa criada fica por padrão em 7 dias (18:00); ajuste depois no cartão ou na
            lista.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {assigneeFilterContextLabel ? (
            <div className="lg:col-span-3 rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
              Filtro ativo por responsável: <strong>{assigneeFilterContextLabel}</strong>. Esta seção mantém as integrações rápidas globais da equipe.
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              Reunify
            </p>
            {(meetings || []).length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma reunião encontrada
              </div>
            ) : (
              meetings?.slice(0, 3).map((meeting) => (
                <div key={meeting.id} className="atlas-item flex items-center justify-between">
                  <div>
                    <p className="atlas-item-title">{meeting.titulo}</p>
                    <p className="atlas-item-meta">
                      {formatDateForInput(meeting.date)} · {meeting.startTime}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={isCreating || !columnId}
                    onClick={() =>
                      handleQuickImport(`Reunify: ${meeting.titulo}`, 'Reunify')
                    }
                  >
                    Criar tarefa
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              Chronos
            </p>
            {(agendaItems || []).length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhum compromisso encontrado
              </div>
            ) : (
              agendaItems?.slice(0, 3).map((item) => (
                <div key={item.id} className="atlas-item flex items-center justify-between">
                  <div>
                    <p className="atlas-item-title">{item.title ?? item.titulo ?? '—'}</p>
                    <p className="atlas-item-meta">
                      {formatDateForInput(item.date)} · {item.startTime}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={isCreating || !columnId}
                    onClick={() =>
                      handleQuickImport(`Chronos: ${item.title ?? item.titulo ?? ''}`, 'Chronos')
                    }
                  >
                    Criar tarefa
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              Projectus
            </p>
            {projectusIntegrationBlocked ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Integração Projectus indisponível no plano ativo.
              </div>
            ) : projectsList.length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhum projeto encontrado
              </div>
            ) : (
              projectsList.slice(0, 3).map((project) => (
                <div key={project.id} className="atlas-item flex items-center justify-between">
                  <div>
                    <p className="atlas-item-title">{project.nome}</p>
                    <p className="atlas-item-meta">{project.status.replace('_', ' ')}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={isCreating || !columnId}
                    onClick={() =>
                      handleQuickImport(`Projectus: ${project.nome}`, 'Projectus', {
                        projectId: Number(project.id),
                      })
                    }
                  >
                    Criar tarefa
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
        </>
      ) : null}

      {hubTab === 'operar' ? (
        <>
      {isLoading ? (
        <div className="atlas-surface flex items-center gap-3 px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
          <span
            className="inline-flex h-9 w-9 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600 dark:border-violet-900 dark:border-t-violet-400"
            aria-hidden
          />
          <span className="font-medium text-slate-600 dark:text-slate-300">Carregando o quadro…</span>
        </div>
      ) : viewMode === 'kanban' ? (
        <>
          {!kanbanDnDEnabled && (
            <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              Com filtro de sprint ou épicos colapsados, o arraste no Kanban fica desativado para evitar
              inconsistências na ordem.
            </p>
          )}
          <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {columns.map((column, columnIndex) => {
              const stripe = columnKanbanStripe(
                column.stripeColor,
                TASKFLOW_COLUMN_ACCENTS[columnIndex % TASKFLOW_COLUMN_ACCENTS.length],
              );
              return (
              <Card
                key={column.id}
                className={cn(
                  'atlas-surface flex flex-col border-t-[3px] shadow-lg transition-shadow duration-300 hover:shadow-xl',
                  stripe.className,
                )}
                style={stripe.style}
              >
                <CardHeader className="gap-1 pb-2">
                  <CardTitle className="text-base font-semibold tracking-tight">
                    {column.name}
                  </CardTitle>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {phaseTypeLabelLoose(column.phaseType)}
                    {column.maxStayHours != null && column.maxStayHours > 0
                      ? ` · máx. ${column.maxStayHours}h`
                      : ''}
                  </p>
                  <CardDescription className="line-clamp-2">
                    {column.description || 'Sem descrição'}
                  </CardDescription>
                </CardHeader>
                <Droppable droppableId={String(column.id)}>
                  {(droppableProvided, droppableSnapshot) => (
                    <CardContent
                      className={cn(
                        'flex min-h-[120px] flex-1 flex-col gap-3 overflow-visible transition-colors',
                        droppableSnapshot.isDraggingOver &&
                          'rounded-2xl bg-violet-50/70 ring-2 ring-violet-300/80 dark:bg-violet-500/10 dark:ring-violet-400/35',
                      )}
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                    >
                      {column.tasks.length === 0 ? (
                        <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                          Nenhuma tarefa nesta coluna
                        </div>
                      ) : (
                        column.tasks.map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={String(task.id)}
                            index={index}
                            isDragDisabled={
                              !kanbanDnDEnabled ||
                              taskflowTaskIsTerminal(task, data?.statusDefinitions)
                            }
                          >
                            {(draggableProvided, draggableSnapshot) => {
                              const kanbanTaskTerminal = taskflowTaskIsTerminal(
                                task,
                                data?.statusDefinitions,
                              );
                              const dragLocked = kanbanTaskTerminal || !kanbanDnDEnabled;
                              const card = (
                                <div
                                  className={cn(
                                    'atlas-item border-l-4 text-sm text-slate-700 shadow-sm dark:text-slate-200',
                                    getPriorityEdgeClass(task.priority),
                                    draggableSnapshot.isDragging &&
                                      'shadow-xl ring-2 ring-violet-300/90 dark:ring-violet-500/45',
                                  )}
                                  ref={draggableProvided.innerRef}
                                  style={draggableProvided.draggableProps.style}
                                  {...draggableProvided.draggableProps}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          dragLocked
                                            ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                                            : 'cursor-grab text-slate-400 transition-colors duration-150 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-300',
                                        )}
                                        {...(dragLocked ? {} : draggableProvided.dragHandleProps)}
                                        aria-label={
                                          dragLocked
                                            ? kanbanTaskTerminal
                                              ? `Tarefa encerrada: ${task.title}`
                                              : `Arrastar desativado: ${task.title}`
                                            : `Mover tarefa: ${task.title}`
                                        }
                                        title={
                                          kanbanTaskTerminal
                                            ? 'Concluída ou cancelada — não pode mover no quadro'
                                            : !kanbanDnDEnabled
                                              ? 'Com filtro de sprint ou épicos colapsados, arrastar está desativado'
                                              : 'Arraste para mover'
                                        }
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </span>
                                      {hasChildrenTaskIds.has(task.id) && (
                                        <button
                                          type="button"
                                          className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                          title={
                                            collapsedEpicIds.includes(task.id)
                                              ? 'Expandir subtarefas'
                                              : 'Colapsar subtarefas'
                                          }
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setCollapsedEpicIds((prev) =>
                                              prev.includes(task.id)
                                                ? prev.filter((id) => id !== task.id)
                                                : [...prev, task.id],
                                            );
                                          }}
                                        >
                                          {collapsedEpicIds.includes(task.id) ? (
                                            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                                          ) : (
                                            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                                          )}
                                        </button>
                                      )}
                                      <span className="atlas-item-title">
                                        {task.title}
                                      </span>
                                      {kanbanTaskTerminal && (
                                        <span className="rounded-full border border-slate-300/80 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                          Encerrada
                                        </span>
                                      )}
                                      {task.recurrenceRule && !task.recurrenceOccurrenceKey && (
                                        <span className="rounded-full border border-violet-300/60 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-500/35 dark:bg-violet-500/15 dark:text-violet-200">
                                          Recorrente ({recurrenceRuleUiLabel(task.recurrenceRule)})
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`atlas-badge border ${getPriorityStyle(
                                        task.priority,
                                      )}`}
                                    >
                                      {getPriorityLabel(task.priority)}
                                    </span>
                                  </div>
                                  {!((kanbanTaskTerminal && !isOwnerLike(role))) ? (
                                    <div className="mt-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 rounded-full px-2 text-[11px]"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          openTaskEditor(task);
                                        }}
                                      >
                                        Editar
                                      </Button>
                                    </div>
                                  ) : null}
                                  {(task.parentTaskId != null || task.sprintId != null) && (
                                    <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                                      {task.parentTaskId != null && (
                                        <>
                                          Pai:{' '}
                                          <span className="font-medium text-slate-600 dark:text-slate-300">
                                            {taskByIdMap.get(task.parentTaskId)?.title ??
                                              `#${task.parentTaskId}`}
                                          </span>
                                        </>
                                      )}
                                      {task.parentTaskId != null && task.sprintId != null && ' · '}
                                      {task.sprintId != null && (
                                        <>
                                          Sprint:{' '}
                                          <span className="font-medium text-slate-600 dark:text-slate-300">
                                            {sprintById.get(task.sprintId)?.name ?? `#${task.sprintId}`}
                                          </span>
                                        </>
                                      )}
                                    </p>
                                  )}
                                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    {taskTypeDisplayLabel(task.taskType || 'generic', taskTypeCustomRows)}
                                  </p>
                                  {task.dueDate && (
                                    <p className="mt-1 text-xs text-slate-400">
                                      Prazo: {formatDateTimePtShort(task.dueDate)}
                                    </p>
                                  )}
                                {task.dueDate &&
                                  new Date(task.dueDate).getTime() < Date.now() && (
                                    <span className="mt-2 inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-300">
                                      Atrasada
                                    </span>
                                  )}
                                  {(() => {
                                    const b = data?.slaBreaches?.find((x) => x.taskId === task.id);
                                    if (!b) return null;
                                    const over = Math.round((b.hoursInColumn - b.maxStayHours) * 10) / 10;
                                    return (
                                      <span className="mt-2 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                                        SLA da fase «{b.columnName}» (+{over}h)
                                      </span>
                                    );
                                  })()}
                                  {(labelIdsByTask.get(task.id) || []).length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {(labelIdsByTask.get(task.id) || [])
                                        .slice(0, 2)
                                        .map((labelId) => {
                                          const label = labelsById.get(labelId);
                                          if (!label) {
                                            return null;
                                          }
                                          const la = labelChipAppearance(label.color);
                                          return (
                                            <span
                                              key={`${task.id}-${labelId}`}
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${la.className}`}
                                              style={la.style}
                                            >
                                              {label.name}
                                            </span>
                                          );
                                        })}
                                    </div>
                                  )}
                                  {taskAssigneeIds(task).length > 0 && (
                                    <p className="mt-2 text-xs text-slate-400">
                                      Responsáveis:{' '}
                                      {formatAssigneeNames(taskAssigneeIds(task), teamMemberMap)}
                                    </p>
                                  )}
                                  {task.description && (
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                      {task.description}
                                    </p>
                                  )}
                                  {task.projectId && (
                                    <p className="mt-2 text-xs text-slate-400">
                                      Projeto:{' '}
                                      {projectsList.find((p) => String(p.id) === String(task.projectId))
                                        ?.nome || '—'}
                                    </p>
                                  )}
                                </div>
                              );

                              if (draggableSnapshot.isDragging) {
                                return (
                                  <>
                                    <div className="atlas-item border-dashed opacity-40">
                                      <div className="flex items-center gap-2">
                                        <GripVertical className="h-4 w-4 text-slate-400" />
                                        <span className="atlas-item-title">
                                          {task.title}
                                        </span>
                                      </div>
                                    </div>
                                    {createPortal(card, document.body)}
                                  </>
                                );
                              }

                              return card;
                            }}
                          </Draggable>
                        ))
                      )}
                      {droppableProvided.placeholder}
                    </CardContent>
                  )}
                </Droppable>
              </Card>
            );
            })}
          </div>
        </DragDropContext>
        </>
      ) : viewMode === 'lista' ? (
        <>
        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Lista de tarefas</CardTitle>
            <CardDescription>Visualize e edite tarefas rapidamente</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {sortedTasks.length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma tarefa encontrada
              </div>
            ) : (
              sortedTasks.map((task) => {
                const statusRow = statusById.get(task.statusId);
                const rowStripe = statusListRowLeftAccent(statusRow?.color);
                const listTaskTerminal = taskflowTaskIsTerminal(task, data?.statusDefinitions);
                return (
                <div
                  key={task.id}
                  className={cn(
                    'atlas-item flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
                    rowStripe.className,
                  )}
                  style={rowStripe.style}
                >
                  {false ? (
                    <div className="flex flex-1 flex-col gap-2">
                      {listTaskTerminal && isOwnerLike(role) ? (
                        <>
                          <p className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100">
                            Tarefa encerrada: só pode alterar a <strong>descrição</strong> e o{' '}
                            <strong>estado</strong> (sem prazos, coluna, responsáveis ou outros campos).
                          </p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {editTitle}
                          </p>
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Descrição
                          </label>
                          <textarea
                            className="min-h-[5rem] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                            value={editDescription}
                            onChange={(event) => setEditDescription(event.target.value)}
                            rows={4}
                          />
                          <Select
                            value={editStatusId != null ? String(editStatusId) : '_none'}
                            onValueChange={(v) => setEditStatusId(v === '_none' ? null : Number(v))}
                          >
                            <SelectTrigger className="rounded-2xl">
                              <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                              {(data?.statusDefinitions || []).map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      ) : null}
                      {!(listTaskTerminal && isOwnerLike(role)) ? (
                      <>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                      />
                      <Select value={editPriority} onValueChange={setEditPriority}>
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue placeholder="Prioridade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="URGENT">Urgente</SelectItem>
                          <SelectItem value="HIGH">Alta</SelectItem>
                          <SelectItem value="MEDIUM">Média</SelectItem>
                          <SelectItem value="LOW">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={editStatusId != null ? String(editStatusId) : '_none'}
                        onValueChange={(v) => setEditStatusId(v === '_none' ? null : Number(v))}
                      >
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {(data?.statusDefinitions || []).map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={editTaskType} onValueChange={setEditTaskType}>
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {NATIVE_TASK_TYPES.map((t) => (
                            <SelectItem key={t.code} value={t.code}>
                              {t.label}
                            </SelectItem>
                          ))}
                          {taskTypeCustomRows.map((t) => (
                            <SelectItem key={`e-${t.id}`} value={t.code}>
                              {t.name} (personalizado)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editColumnId ? String(editColumnId) : '_none'}
                        onValueChange={(v) => setEditColumnId(v === '_none' ? null : Number(v))}
                        disabled={listTaskTerminal}
                      >
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue placeholder="Coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          {data?.columns?.map((column) => (
                            <SelectItem key={column.id} value={String(column.id)}>
                              {column.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input
                        type="datetime-local"
                        className="min-w-[12rem] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                        value={editDueDate}
                        onChange={(event) => setEditDueDate(event.target.value)}
                      />
                      {!task.recurrenceOccurrenceKey ? (
                        <>
                          <Select value={editRecurrenceRule} onValueChange={setEditRecurrenceRule}>
                            <SelectTrigger className="min-w-[10rem] rounded-2xl">
                              <SelectValue placeholder="Recorrência" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">Sem recorrência</SelectItem>
                              {(
                                task.recurrenceRule
                                  ? ([task.recurrenceRule] as string[])
                                  : (['DAILY', 'WEEKLY', 'MONTHLY'] as const)
                              ).map((code) => (
                                <SelectItem key={code} value={code}>
                                  {recurrenceRuleUiLabel(code)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {editRecurrenceRule !== '_none' && (
                            <input
                              type="datetime-local"
                              className="min-w-[12rem] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                              value={editRecurrenceUntil}
                              onChange={(event) => setEditRecurrenceUntil(event.target.value)}
                              title="Fim da série (opcional)"
                            />
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Ocorrência gerada pela recorrência (molde: série{' '}
                          {task.recurrenceSeriesKey?.slice(0, 8) ?? '—'}…)
                        </p>
                      )}
                      <input
                        type="datetime-local"
                        className="min-w-[12rem] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                        placeholder="Início previsto"
                        value={editPlannedStart}
                        onChange={(event) => setEditPlannedStart(event.target.value)}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="h estimadas"
                        className="w-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                        value={editEstimatedHours}
                        onChange={(event) => setEditEstimatedHours(event.target.value)}
                      />
                      <div
                        className={cn(
                          'min-w-[12rem] max-w-[14rem]',
                          listTaskTerminal && 'pointer-events-none opacity-50',
                        )}
                      >
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Responsáveis
                        </p>
                        <div className="max-h-28 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950/60">
                          {team?.teamMembers?.map((member) => {
                            const on = editAssigneeIds.includes(member.user.id);
                            return (
                              <label
                                key={member.user.id}
                                className={cn(
                                  'flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200',
                                  listTaskTerminal ? 'cursor-not-allowed' : 'cursor-pointer',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  disabled={listTaskTerminal}
                                  checked={on}
                                  onChange={() => {
                                    setEditAssigneeIds((prev) =>
                                      on
                                        ? prev.filter((id) => id !== member.user.id)
                                        : [...prev, member.user.id],
                                    );
                                  }}
                                />
                                <span>{member.user.name || member.user.email}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <Select
                        value={editProjectId ? String(editProjectId) : '_none'}
                        onValueChange={(v) =>
                          setEditProjectId(v === '_none' ? null : Number(v))
                        }
                      >
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue placeholder="Projeto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Sem projeto</SelectItem>
                          {projectsList.map((project) => (
                            <SelectItem key={project.id} value={String(project.id)}>
                              {project.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editParentTaskId == null ? '_none' : String(editParentTaskId)}
                        onValueChange={(v) =>
                          setEditParentTaskId(v === '_none' ? null : Number(v))
                        }
                        disabled={listTaskTerminal}
                      >
                        <SelectTrigger className="min-w-[10rem] rounded-2xl">
                          <SelectValue placeholder="Tarefa pai" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value="_none">Sem pai</SelectItem>
                          {(data?.tasks || [])
                            .filter((t) => !excludedParentIdsForEdit.has(t.id))
                            .slice()
                            .sort((a, b) => a.title.localeCompare(b.title, 'pt'))
                            .map((t) => (
                              <SelectItem key={`ep-${t.id}`} value={String(t.id)}>
                                #{t.id} · {t.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editSprintId == null ? '_none' : String(editSprintId)}
                        onValueChange={(v) =>
                          setEditSprintId(v === '_none' ? null : Number(v))
                        }
                        disabled={listTaskTerminal}
                      >
                        <SelectTrigger className="min-w-[9rem] rounded-2xl">
                          <SelectValue placeholder="Sprint" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Sem sprint</SelectItem>
                          {(data?.sprints || []).map((sp) => (
                            <SelectItem key={`es-${sp.id}`} value={String(sp.id)}>
                              {sp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(data?.labels || []).map((label) => {
                          const la = labelChipAppearance(label.color);
                          const on = editLabelIds.includes(label.id);
                          return (
                            <button
                              key={label.id}
                              type="button"
                              className={`rounded-full px-3 py-1 text-left text-xs font-semibold ${
                                on
                                  ? la.className
                                  : 'border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'
                              }`}
                              style={on ? la.style : undefined}
                              onClick={() =>
                                setEditLabelIds((prev) =>
                                  prev.includes(label.id)
                                    ? prev.filter((id) => id !== label.id)
                                    : [...prev, label.id],
                                )
                              }
                            >
                              <span>{label.name}</span>
                              <span className="ml-1 text-[10px] font-normal opacity-75">
                                ({getPriorityLabel(label.priority || 'MEDIUM')})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Anexos
                        </p>
                        <input
                          ref={editAttachmentInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            void handleUploadEditAttachment(task.id, f);
                          }}
                        />
                        {editAttachmentsLoading ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            A carregar anexos...
                          </p>
                        ) : editTaskAttachments.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Sem anexos. Envie um arquivo (máx. 15MB; download autenticado).
                          </p>
                        ) : (
                          <ul className="mt-1 space-y-1.5">
                            {editTaskAttachments.map((a) => (
                              <li
                                key={a.id}
                                className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
                              >
                                <a
                                  href={`/api/taskflow/attachments/${a.id}/file`}
                                  className="text-indigo-600 underline dark:text-indigo-400"
                                  download
                                >
                                  {a.originalName}
                                </a>
                                <span className="text-slate-400">
                                  ({formatAttachmentBytes(a.sizeBytes)})
                                </span>
                                {(canConfigureTaskflowBoard(role) ||
                                  a.uploadedById === user?.id) && (
                                  <button
                                    type="button"
                                    className="rounded-full text-rose-600 underline decoration-rose-600/50 hover:text-rose-700 dark:text-rose-400"
                                    disabled={editAttachmentUploading}
                                    onClick={() => void handleDeleteEditAttachment(task.id, a.id)}
                                  >
                                    Remover
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full text-xs"
                            disabled={editAttachmentUploading || editAttachmentsLoading}
                            onClick={() => editAttachmentInputRef.current?.click()}
                          >
                            {editAttachmentUploading ? 'Enviando...' : 'Adicionar arquivo'}
                          </Button>
                        </div>
                      </div>
                      </>
                    ) : null}
                    </div>
                  ) : (
                    <div>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="atlas-item-title">{task.title}</span>
                        {listTaskTerminal && (
                          <span className="rounded-full border border-slate-300/80 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Encerrada
                          </span>
                        )}
                        {task.recurrenceRule && !task.recurrenceOccurrenceKey && (
                          <span className="rounded-full border border-violet-300/60 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-500/35 dark:bg-violet-500/15 dark:text-violet-200">
                            Recorrente ({recurrenceRuleUiLabel(task.recurrenceRule)})
                          </span>
                        )}
                        {task.recurrenceOccurrenceKey && (
                          <span className="rounded-full border border-slate-300/70 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-500/15 dark:text-slate-300">
                            Instância recorrente
                          </span>
                        )}
                      </p>
                      <p className="atlas-item-meta">
                        {columnMap.get(task.columnId)?.name || 'Sem coluna'}
                        {statusRow ? ` · ${statusRow.name}` : ''}
                        {' · '}
                        {taskTypeDisplayLabel(task.taskType || 'generic', taskTypeCustomRows)}
                      </p>
                      {(task.parentTaskId != null || task.sprintId != null) && (
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {task.parentTaskId != null && (
                            <>
                              Pai:{' '}
                              <span className="font-medium text-slate-600 dark:text-slate-300">
                                {taskByIdMap.get(task.parentTaskId)?.title ??
                                  `#${task.parentTaskId}`}
                              </span>
                            </>
                          )}
                          {task.parentTaskId != null && task.sprintId != null && ' · '}
                          {task.sprintId != null && (
                            <>
                              Sprint:{' '}
                              <span className="font-medium text-slate-600 dark:text-slate-300">
                                {sprintById.get(task.sprintId)?.name ?? `#${task.sprintId}`}
                              </span>
                            </>
                          )}
                        </p>
                      )}
                      {task.dueDate && (
                        <p className="text-xs text-slate-400">
                          Prazo: {formatDateTimePtShort(task.dueDate)}
                        </p>
                      )}
                      {task.plannedStartAt && (
                        <p className="text-xs text-slate-400">
                          Início previsto: {formatDateTimePtShort(task.plannedStartAt)}
                        </p>
                      )}
                      {task.estimatedDurationHours != null &&
                        Number.isFinite(task.estimatedDurationHours) && (
                          <p className="text-xs text-slate-400">
                            Duração estimada: {task.estimatedDurationHours} h
                          </p>
                        )}
                      {task.dueDate &&
                        new Date(task.dueDate).getTime() < Date.now() && (
                          <span className="mt-2 inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-300">
                            Atrasada
                          </span>
                        )}
                      {taskAssigneeIds(task).length > 0 && (
                        <p className="text-xs text-slate-400">
                          Responsáveis:{' '}
                          {formatAssigneeNames(taskAssigneeIds(task), teamMemberMap)}
                        </p>
                      )}
                      {task.projectId && (
                        <p className="text-xs text-slate-400">
                          Projeto:{' '}
                          {projectsList.find((p) => String(p.id) === String(task.projectId))?.nome ||
                            '—'}
                        </p>
                      )}
                      {(labelIdsByTask.get(task.id) || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(labelIdsByTask.get(task.id) || []).map((labelId) => {
                            const label = labelsById.get(labelId);
                            if (!label) {
                              return null;
                            }
                            const la = labelChipAppearance(label.color);
                            return (
                              <span
                                key={`${task.id}-${labelId}`}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${la.className}`}
                                style={la.style}
                              >
                                {label.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`atlas-badge border ${getPriorityStyle(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                    {!(listTaskTerminal && !isOwnerLike(role)) ? (
                      <EntityEditDeleteActions
                        onEdit={() => openTaskEditor(task)}
                        onDelete={() => handleDeleteTask(task.id)}
                        disabled={isDeleting === task.id}
                      />
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={actionDeleteOutlineClassName}
                        disabled={isDeleting === task.id}
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        {ACTION_COPY.delete}
                      </Button>
                    )}
                  </div>
                </div>
              );
              })
            )}
          </CardContent>
        </Card>
        {editingTaskId != null && editingTaskRow
          ? createPortal(
          <div
            className="fixed inset-0 z-[380] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="taskflow-edit-modal-title"
            onClick={() => setEditingTaskId(null)}
          >
            <div
              className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-violet-200/80 bg-white p-5 shadow-xl dark:border-violet-900/50 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 id="taskflow-edit-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Editar tarefa
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Ajuste os campos e salve sem sair da lista.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Título</label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    placeholder="Título"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Prioridade</label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                      <SelectValue placeholder="Prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="MEDIUM">Média</SelectItem>
                      <SelectItem value="LOW">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Estado</label>
                  <Select
                    value={editStatusId != null ? String(editStatusId) : '_none'}
                    onValueChange={(v) => setEditStatusId(v === '_none' ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.statusDefinitions || []).map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Tipo de tarefa</label>
                  <Select value={editTaskType} onValueChange={setEditTaskType}>
                    <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {NATIVE_TASK_TYPES.map((t) => (
                        <SelectItem key={t.code} value={t.code}>
                          {t.label}
                        </SelectItem>
                      ))}
                      {taskTypeCustomRows.map((t) => (
                        <SelectItem key={`em-${t.id}`} value={t.code}>
                          {t.name} (personalizado)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Planejamento (coluna)</label>
                  <Select
                    value={editColumnId ? String(editColumnId) : '_none'}
                    onValueChange={(v) => setEditColumnId(v === '_none' ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                      <SelectValue placeholder="Coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.columns || []).map((column) => (
                        <SelectItem key={column.id} value={String(column.id)}>
                          {column.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Projeto</label>
                  <Select
                    value={editProjectId ? String(editProjectId) : '_none'}
                    onValueChange={(v) => setEditProjectId(v === '_none' ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                      <SelectValue placeholder="Projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem projeto</SelectItem>
                      {projectsList.map((project) => (
                        <SelectItem key={project.id} value={String(project.id)}>
                          {project.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Prazo de entrega</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    value={editDueDate}
                    onChange={(event) => setEditDueDate(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Início previsto</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    value={editPlannedStart}
                    onChange={(event) => setEditPlannedStart(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Duração estimada (h)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                    placeholder="h estimadas"
                    value={editEstimatedHours}
                    onChange={(event) => setEditEstimatedHours(event.target.value)}
                  />
                </div>
                {!editingTaskRow.recurrenceOccurrenceKey ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Recorrência</label>
                      <Select value={editRecurrenceRule} onValueChange={setEditRecurrenceRule}>
                        <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                          <SelectValue placeholder="Recorrência" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Sem recorrência</SelectItem>
                          {(
                            editingTaskRow.recurrenceRule
                              ? ([editingTaskRow.recurrenceRule] as string[])
                              : (['DAILY', 'WEEKLY', 'MONTHLY'] as const)
                          ).map((code) => (
                            <SelectItem key={code} value={code}>
                              {recurrenceRuleUiLabel(code)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {editRecurrenceRule !== '_none' ? (
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Fim da recorrência (opcional)</label>
                        <input
                          type="datetime-local"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                          value={editRecurrenceUntil}
                          onChange={(event) => setEditRecurrenceUntil(event.target.value)}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="md:col-span-2 xl:col-span-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-700/80 dark:bg-slate-950/40 dark:text-slate-300">
                    Instância gerada por recorrência (série {editingTaskRow.recurrenceSeriesKey?.slice(0, 8) ?? '—'}…).
                    Edite a recorrência na tarefa molde.
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Tarefa pai (épico)</label>
                  <Select
                    value={editParentTaskId == null ? '_none' : String(editParentTaskId)}
                    onValueChange={(v) => setEditParentTaskId(v === '_none' ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                      <SelectValue placeholder="Tarefa pai" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="_none">Nenhuma (tarefa raiz)</SelectItem>
                      {(data?.tasks || [])
                        .filter((t) => !excludedParentIdsForEdit.has(t.id))
                        .slice()
                        .sort((a, b) => a.title.localeCompare(b.title, 'pt'))
                        .map((t) => (
                          <SelectItem key={`modal-parent-${t.id}`} value={String(t.id)}>
                            #{t.id} · {t.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Sprint</label>
                  <Select
                    value={editSprintId == null ? '_none' : String(editSprintId)}
                    onValueChange={(v) => setEditSprintId(v === '_none' ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60">
                      <SelectValue placeholder="Sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem sprint</SelectItem>
                      {(data?.sprints || []).map((sp) => (
                        <SelectItem key={`modal-sprint-${sp.id}`} value={String(sp.id)}>
                          {sp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Responsáveis</label>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950/60">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(team?.teamMembers || []).map((member) => {
                      const on = editAssigneeIds.includes(member.user.id);
                      return (
                        <label
                          key={`modal-assignee-${member.user.id}`}
                          className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={on}
                            onChange={() => {
                              setEditAssigneeIds((prev) =>
                                on
                                  ? prev.filter((id) => id !== member.user.id)
                                  : [...prev, member.user.id],
                              );
                            }}
                          />
                          <span>{member.user.name || member.user.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">Labels</label>
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950/60">
                  {(data?.labels || []).length === 0 ? (
                    <span className="text-xs text-slate-400">Nenhuma label cadastrada.</span>
                  ) : (
                    (data?.labels || []).map((label) => {
                      const la = labelChipAppearance(label.color);
                      const on = editLabelIds.includes(label.id);
                      return (
                        <button
                          key={`modal-label-${label.id}`}
                          type="button"
                          className={`rounded-full px-3 py-1 text-left text-xs font-semibold ${
                            on
                              ? la.className
                              : 'border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'
                          }`}
                          style={on ? la.style : undefined}
                          onClick={() =>
                            setEditLabelIds((prev) =>
                              prev.includes(label.id)
                                ? prev.filter((id) => id !== label.id)
                                : [...prev, label.id],
                            )
                          }
                        >
                          <span>{label.name}</span>
                          <span className="ml-1 text-[10px] font-normal opacity-75">
                            ({getPriorityLabel(label.priority || 'MEDIUM')})
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Descrição
                </label>
                <textarea
                  className="min-h-[5rem] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditingTaskId(null)}>
                  {ACTION_COPY.cancel}
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={isSaving}
                  onClick={() => void handleUpdateTask(editingTaskRow.id)}
                >
                  {isSaving ? ACTION_COPY.saving : ACTION_COPY.save}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
          : null}
        </>
      ) : viewMode === 'calendar' ? (
        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Calendário do mês</CardTitle>
            <CardDescription>Visualize tarefas por data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-xs text-slate-500">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day) => (
                <div key={day} className="text-center font-semibold">
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {calendar.cells.map((cell, index) => {
                const key = cell.date ? formatLocalDateKey(cell.date) : '';
                const tasks = key ? calendar.tasksByDate.get(key) || [] : [];
                const isToday =
                  cell.date &&
                  cell.date.toDateString() === calendar.today.toDateString();

                return (
                  <div
                    key={`${key}-${index}`}
                    className={`min-h-[96px] rounded-2xl border border-slate-200 p-2 text-xs dark:border-slate-700 ${
                      isToday ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : ''
                    }`}
                  >
                    <div className="mb-1 font-semibold text-slate-600 dark:text-slate-300">
                      {cell.date ? cell.date.getDate() : ''}
                    </div>
                    <div className="flex flex-col gap-1">
                      {tasks.slice(0, 3).map((task) => (
                        <span
                          key={task.id}
                          className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-300"
                        >
                          {task.title}
                        </span>
                      ))}
                      {tasks.length > 3 && (
                        <span className="text-[10px] text-slate-400">
                          +{tasks.length - 3} tarefas
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'gantt' ? (
        <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
          <CardHeader className="gap-1">
            <CardTitle>Gantt (30 dias)</CardTitle>
            <CardDescription>Visão de cronograma por prazo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {gantt.length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma tarefa com prazo definida
              </div>
            ) : (
              gantt.map(({ task, left, width, daysLeft }) => (
                <div key={task.id} className="atlas-item">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {task.title}
                    </span>
                    <span>{daysLeft}d</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                      style={{ marginLeft: `${left}%`, width: `${width}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'eisenhower' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
            <CardHeader className="gap-1">
              <CardTitle>Urgente e importante</CardTitle>
              <CardDescription>Faça agora</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {eisenhower.do.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Sem tarefas urgentes
                </div>
              ) : (
                eisenhower.do.map((task) => (
                  <div key={task.id} className="atlas-item">
                    <p className="atlas-item-title">{task.title}</p>
                    <p className="atlas-item-meta">
                      {columnMap.get(task.columnId)?.name || 'Sem coluna'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
            <CardHeader className="gap-1">
              <CardTitle>Importante</CardTitle>
              <CardDescription>Agende</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {eisenhower.schedule.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Sem tarefas importantes
                </div>
              ) : (
                eisenhower.schedule.map((task) => (
                  <div key={task.id} className="atlas-item">
                    <p className="atlas-item-title">{task.title}</p>
                    <p className="atlas-item-meta">
                      {columnMap.get(task.columnId)?.name || 'Sem coluna'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
            <CardHeader className="gap-1">
              <CardTitle>Urgente</CardTitle>
              <CardDescription>Delegue</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {eisenhower.delegate.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Sem tarefas urgentes
                </div>
              ) : (
                eisenhower.delegate.map((task) => (
                  <div key={task.id} className="atlas-item">
                    <p className="atlas-item-title">{task.title}</p>
                    <p className="atlas-item-meta">
                      {columnMap.get(task.columnId)?.name || 'Sem coluna'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="atlas-surface transition-shadow duration-200 hover:shadow-lg">
            <CardHeader className="gap-1">
              <CardTitle>Nem urgente nem importante</CardTitle>
              <CardDescription>Elimine</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {eisenhower.eliminate.length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Sem tarefas de baixo impacto
                </div>
              ) : (
                eisenhower.eliminate.map((task) => (
                  <div key={task.id} className="atlas-item">
                    <p className="atlas-item-title">{task.title}</p>
                    <p className="atlas-item-meta">
                      {columnMap.get(task.columnId)?.name || 'Sem coluna'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
        </>
      ) : null}

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Use o Taskflow para organizar tarefas e prioridades."
          tips={helpTips}
          defaultCollapsed
        />
      </div>
      </div>
    </section>
  );
}
