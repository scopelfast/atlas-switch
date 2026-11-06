'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Flag,
  FolderKanban,
  Layers,
  ListChecks,
  ShieldAlert,
  Target,
  Wallet,
} from 'lucide-react';
import { ScriptumStatCard } from '@/components/scriptum/scriptum-stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleHeader } from '@/components/ui/module-header';
import {
  ModuleSegmentedTabs,
  type ModuleSegmentedTabsItem,
} from '@/components/ui/module-segmented-tabs';
import {
  ModuleWorkspaceHub,
  moduleWorkspaceHubLinkClassName,
} from '@/components/ui/module-workspace-hub';
import { hasPermission, isOwnerLike, type Role } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { EntityEditDeleteActions } from '@/components/ui/entity-edit-delete-actions';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import { IntegrationImpactBanner } from '@/components/ui/integration-impact-banner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Projeto = {
  id: number;
  nome: string;
  status: 'EM_ANDAMENTO' | 'EM_RISCO' | 'CONCLUIDO';
  prazo: string | null;
  budgetCents: number;
};

type ProjectPhase = {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: 'PLANEJADA' | 'EM_ANDAMENTO' | 'CONCLUIDA';
  position: number;
};

type ProjectTask = {
  id: number;
  projectId: number;
  phaseId?: number | null;
  title: string;
  description?: string | null;
  status: 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUIDA';
  priority: 'ALTA' | 'MEDIA' | 'BAIXA';
  startDate?: string | null;
  dueDate?: string | null;
  effortHours?: number | null;
  progress: number;
};

type ProjectMilestone = {
  id: number;
  projectId: number;
  name: string;
  dueDate: string;
  status: 'ABERTO' | 'CONCLUIDO';
};

type ProjectRisk = {
  id: number;
  projectId: number;
  title: string;
  description?: string | null;
  probability: number;
  impact: number;
  status: 'ABERTO' | 'MITIGADO' | 'OCORREU';
  mitigation?: string | null;
};

type ProjectDependency = {
  id: number;
  taskId: number;
  dependsOnTaskId: number;
};

type ProjectCostCategory = {
  id: number;
  code: string;
  label: string;
  active: boolean;
  position: number;
};

type ProjectCostItem = {
  id: number;
  projectId: number;
  phaseId?: number | null;
  taskId?: number | null;
  type: 'PLANEJADO' | 'REAL';
  category: string;
  categoryId: number;
  categoryDetail?: string | null;
  categoryCode?: string;
  categoryLabel?: string;
  categoryTitle?: string;
  amountCents: number;
  incurredAt?: string | null;
  notes?: string | null;
};

type TaskflowLinkedTask = {
  id: number;
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | string;
  statusId: number;
  statusName: string;
  taskType: string;
  dueDate?: string | null;
  plannedStartAt?: string | null;
  estimatedDurationHours?: number | null;
  columnName: string;
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

/** Valores só-data do Postgres / JSON (`YYYY-MM-DD` ou `…T00:00:00.000Z`) — evita deslocar um dia entre lista e `<input type="date">`. */
const DATE_ONLY_STR = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIDNIGHT_UTC_STR = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(\.\d{3})?Z?$/;

function calendarYmdFromApi(value: string): { y: number; m: number; d: number } | null {
  const s = value.trim();
  let m = s.match(DATE_ONLY_STR);
  if (m) {
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }
  m = s.match(MIDNIGHT_UTC_STR);
  if (m) {
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }
  return null;
}

const formatDate = (value?: string | null) => {
  if (value == null || value === '') return '—';
  const s = String(value).trim();
  const cal = calendarYmdFromApi(s);
  if (cal) {
    const dd = String(cal.d).padStart(2, '0');
    const mo = String(cal.m).padStart(2, '0');
    return `${dd}/${mo}/${cal.y}`;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR');
};

const formatCurrency = (cents?: number) => {
  if (typeof cents !== 'number') {
    return '—';
  }
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const parseDateValue = (value?: string | null) => {
  if (!value) return null;
  const s = String(value).trim();
  const cal = calendarYmdFromApi(s);
  if (cal) {
    const parsed = new Date(cal.y, cal.m - 1, cal.d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatInputDate = (value?: string | null) => {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  const cal = calendarYmdFromApi(s);
  if (cal) {
    return `${cal.y}-${String(cal.m).padStart(2, '0')}-${String(cal.d).padStart(2, '0')}`;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Valor do Select do projeto ativo quando ainda não há id válido na lista filtrada (evita modo não controlado). */
const STICKY_PROJECT_SELECT_NONE = '__projectus_none__';

type MainTab = 'portfólio' | 'visão' | 'planejar';

const PROJECTUS_MAIN_TAB_ITEMS: readonly ModuleSegmentedTabsItem<MainTab>[] = [
  { value: 'portfólio', label: 'Portfólio' },
  { value: 'visão', label: 'Visão' },
  { value: 'planejar', label: 'Planejar' },
];

/**
 * Pagina avancada do modulo Projectus (gestao de projetos).
 */
export default function ProjectusPage() {
  const { data: user } = useSWR<{ role?: Role }>('/api/user', fetcher, swrNoRetryOn403);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'projectus.view');

  const { data: projetos, isLoading, error: projetosError } = useSWR<Projeto[]>(
    '/api/projectus/projects',
    fetcher,
    swrNoRetryOn403,
  );
  const projetosList = Array.isArray(projetos) ? projetos : [];
  const moduleBlocked = Boolean(
    projetosError?.message?.toLowerCase().includes('não está habilitado no plano ativo'),
  );

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [mainTab, setMainTab] = useState<MainTab>('portfólio');

  const [portfolioFilterStatus, setPortfolioFilterStatus] = useState('');
  const [portfolioDateFrom, setPortfolioDateFrom] = useState('');
  const [portfolioDateTo, setPortfolioDateTo] = useState('');
  const [phaseListFilter, setPhaseListFilter] = useState('');

  const { data: phases } = useSWR<ProjectPhase[]>(
    selectedProjectId ? `/api/projectus/phases?projectId=${selectedProjectId}` : null,
    fetcher,
  );
  const { data: tasks } = useSWR<ProjectTask[]>(
    selectedProjectId ? `/api/projectus/tasks?projectId=${selectedProjectId}` : null,
    fetcher,
  );
  const { data: milestones } = useSWR<ProjectMilestone[]>(
    selectedProjectId ? `/api/projectus/milestones?projectId=${selectedProjectId}` : null,
    fetcher,
  );
  const { data: risks } = useSWR<ProjectRisk[]>(
    selectedProjectId ? `/api/projectus/risks?projectId=${selectedProjectId}` : null,
    fetcher,
  );
  const { data: dependencies } = useSWR<ProjectDependency[]>(
    selectedProjectId ? `/api/projectus/dependencies?projectId=${selectedProjectId}` : null,
    fetcher,
  );
  const { data: costs } = useSWR<ProjectCostItem[]>(
    selectedProjectId ? `/api/projectus/costs?projectId=${selectedProjectId}` : null,
    fetcher,
  );
  const { data: costCategories } = useSWR<ProjectCostCategory[]>(
    canView ? '/api/projectus/cost-categories' : null,
    fetcher,
  );
  const { data: taskflowTasks } = useSWR<TaskflowLinkedTask[]>(
    selectedProjectId ? `/api/projectus/taskflow?projectId=${selectedProjectId}` : null,
    fetcher,
  );

  const filteredProjetos = useMemo(() => {
    let list = [...projetosList];
    if (portfolioFilterStatus) {
      list = list.filter((p) => p.status === portfolioFilterStatus);
    }
    const from = portfolioDateFrom ? parseDateValue(portfolioDateFrom) : null;
    const to = portfolioDateTo ? parseDateValue(portfolioDateTo) : null;
    if (from || to) {
      list = list.filter((p) => {
        if (!p.prazo) return false;
        const d = parseDateValue(p.prazo);
        if (!d) return false;
        if (from && d.getTime() < from.getTime()) return false;
        if (to && d.getTime() > to.getTime()) return false;
        return true;
      });
    }
    return list;
  }, [projetosList, portfolioFilterStatus, portfolioDateFrom, portfolioDateTo]);

  const portfolioOverviewStats = useMemo(() => {
    const list = filteredProjetos;
    const totalServer = projetosList.length;
    return {
      naVista: list.length,
      totalServer,
      emAndamento: list.filter((p) => p.status === 'EM_ANDAMENTO').length,
      emRisco: list.filter((p) => p.status === 'EM_RISCO').length,
      concluidos: list.filter((p) => p.status === 'CONCLUIDO').length,
    };
  }, [projetosList, filteredProjetos]);

  const phasesFiltered = useMemo(() => {
    if (!phaseListFilter) return phases ?? [];
    return (phases ?? []).filter((ph) => ph.status === phaseListFilter);
  }, [phases, phaseListFilter]);

  useEffect(() => {
    if (!filteredProjetos.length) {
      if (selectedProjectId != null) setSelectedProjectId(null);
      return;
    }
    if (selectedProjectId == null) {
      setSelectedProjectId(filteredProjetos[0].id);
      return;
    }
    const ok = filteredProjetos.some((p) => p.id === selectedProjectId);
    if (!ok) setSelectedProjectId(filteredProjetos[0].id);
  }, [filteredProjetos, selectedProjectId]);

  const stickyProjectSelectValue = useMemo(() => {
    if (isLoading || filteredProjetos.length === 0) return STICKY_PROJECT_SELECT_NONE;
    if (
      selectedProjectId != null &&
      filteredProjetos.some((p) => p.id === selectedProjectId)
    ) {
      return String(selectedProjectId);
    }
    return STICKY_PROJECT_SELECT_NONE;
  }, [isLoading, filteredProjetos, selectedProjectId]);

  const helpTips =
    isOwnerLike(role)
      ? [
          'Defina fases com datas claras e status visível.',
          'Registre riscos e planos de mitigação.',
          'Use marcos para checkpoints executivos.',
        ]
      : [
          'Atualize o status das tarefas antes das revisões.',
          'Informe bloqueios e dependências.',
        ];

  const selectedProject = projetosList.find((project) => project.id === selectedProjectId);

  const metrics = useMemo(() => {
    const totalTasks = tasks?.length || 0;
    const completedTasks = (tasks || []).filter((task) => task.status === 'CONCLUIDA').length;
    const progress =
      totalTasks === 0
        ? 0
        : Math.round((completedTasks / Math.max(totalTasks, 1)) * 100);
    const riskScore =
      risks && risks.length > 0
        ? Math.round(
            risks.reduce((sum, risk) => sum + risk.probability * risk.impact, 0) /
              risks.length,
          )
        : 0;
    return { totalTasks, completedTasks, progress, riskScore };
  }, [tasks, risks]);

  const costSummary = useMemo(() => {
    const planned = (costs || [])
      .filter((cost) => cost.type === 'PLANEJADO')
      .reduce((sum, cost) => sum + cost.amountCents, 0);
    const actual = (costs || [])
      .filter((cost) => cost.type === 'REAL')
      .reduce((sum, cost) => sum + cost.amountCents, 0);
    const total = planned + actual;
    return { planned, actual, total };
  }, [costs]);

  const ganttBars = useMemo(() => {
    const items = (tasks || []).filter((task) => task.startDate && task.dueDate);
    const dates = items.flatMap((task) => [
      parseDateValue(task.startDate),
      parseDateValue(task.dueDate),
    ]);
    const validDates = dates.filter(Boolean) as Date[];
    const start = validDates.length
      ? new Date(Math.min(...validDates.map((date) => date.getTime())))
      : new Date();
    const end = validDates.length
      ? new Date(Math.max(...validDates.map((date) => date.getTime())))
      : new Date(new Date().setDate(new Date().getDate() + 14));
    const span = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

    const rows = items.map((task) => {
      const startDate = parseDateValue(task.startDate);
      const endDate = parseDateValue(task.dueDate);
      if (!startDate || !endDate) {
        return null;
      }
      const offset = Math.round((startDate.getTime() - start.getTime()) / 86400000);
      const length =
        Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
      return {
        id: task.id,
        title: task.title,
        offset: clamp(offset, 0, span),
        length: clamp(length, 1, span),
        status: task.status,
        priority: task.priority,
      };
    });

    const idToIndex = new Map<number, number>();
    rows.forEach((row, idx) => {
      if (row) idToIndex.set(row.id, idx);
    });

    const dependencyArrows = (dependencies || [])
      .map((dep) => {
        const fromIdx = idToIndex.get(dep.dependsOnTaskId);
        const toIdx = idToIndex.get(dep.taskId);
        if (fromIdx === undefined || toIdx === undefined) return null;
        const fromRow = rows[fromIdx];
        const toRow = rows[toIdx];
        if (!fromRow || !toRow) return null;
        return {
          fromX: ((fromRow.offset + fromRow.length) / span) * 100,
          fromY: fromIdx,
          toX: (toRow.offset / span) * 100,
          toY: toIdx,
        };
      })
      .filter(Boolean) as { fromX: number; fromY: number; toX: number; toY: number }[];

    return {
      start,
      end,
      span,
      rows,
      dependencyArrows,
      rowHeight: 28,
    };
  }, [tasks, dependencies]);

  const [projectName, setProjectName] = useState('');
  const [projectStatus, setProjectStatus] = useState<'EM_ANDAMENTO' | 'EM_RISCO' | 'CONCLUIDO'>(
    'EM_ANDAMENTO',
  );
  const [projectDueDate, setProjectDueDate] = useState('');
  const [projectBudget, setProjectBudget] = useState('');
  const [projectEditingId, setProjectEditingId] = useState<number | null>(null);
  const [projectFeedback, setProjectFeedback] = useState<string | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Projeto | null>(null);

  const [phaseName, setPhaseName] = useState('');
  const [phaseStart, setPhaseStart] = useState('');
  const [phaseEnd, setPhaseEnd] = useState('');
  const [phaseStatus, setPhaseStatus] = useState<ProjectPhase['status']>('PLANEJADA');
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [pendingDeletePhaseId, setPendingDeletePhaseId] = useState<number | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskPhaseId, setTaskPhaseId] = useState<number | null>(null);
  const [taskStart, setTaskStart] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskPriority, setTaskPriority] = useState<ProjectTask['priority']>('MEDIA');
  const [taskStatus, setTaskStatus] = useState<ProjectTask['status']>('ABERTA');
  const [taskProgress, setTaskProgress] = useState(0);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<number | null>(null);

  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneDue, setMilestoneDue] = useState('');
  const [milestoneStatus, setMilestoneStatus] = useState<ProjectMilestone['status']>('ABERTO');
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [pendingDeleteMilestoneId, setPendingDeleteMilestoneId] = useState<number | null>(null);

  const [riskTitle, setRiskTitle] = useState('');
  const [riskProbability, setRiskProbability] = useState(3);
  const [riskImpact, setRiskImpact] = useState(3);
  const [riskStatus, setRiskStatus] = useState<ProjectRisk['status']>('ABERTO');
  const [riskMitigation, setRiskMitigation] = useState('');
  const [editingRiskId, setEditingRiskId] = useState<number | null>(null);
  const [pendingDeleteRiskId, setPendingDeleteRiskId] = useState<number | null>(null);

  const [dependencyTaskId, setDependencyTaskId] = useState<number | null>(null);
  const [dependencyDependsOnId, setDependencyDependsOnId] = useState<number | null>(null);
  const [editingDependencyId, setEditingDependencyId] = useState<number | null>(null);
  const [pendingDeleteDependencyId, setPendingDeleteDependencyId] = useState<number | null>(null);

  const projectAlerts = useMemo(() => {
    const alerts: { type: 'warning' | 'danger' | 'info'; message: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    (tasks || []).forEach((task) => {
      if (task.status === 'CONCLUIDA') return;
      const due = task.dueDate ? parseDateValue(task.dueDate) : null;
      if (due && due.getTime() < today.getTime()) {
        alerts.push({
          type: 'danger',
          message: `Tarefa atrasada: ${task.title}`,
        });
      } else if (due) {
        const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
        if (daysLeft <= 2 && task.priority === 'ALTA') {
          alerts.push({
            type: 'warning',
            message: `Prazo próximo (${daysLeft}d): ${task.title}`,
          });
        }
      }
    });

    (risks || [])
      .filter((r) => r.status === 'ABERTO' && r.probability * r.impact >= 12)
      .forEach((r) => {
        alerts.push({
          type: 'danger',
          message: `Risco alto: ${r.title} (P${r.probability}×I${r.impact})`,
        });
      });

    const projectDue = selectedProject?.prazo ? parseDateValue(selectedProject.prazo) : null;
    if (projectDue && projectDue.getTime() < today.getTime()) {
      alerts.push({ type: 'danger', message: 'Projeto com prazo vencido.' });
    } else if (projectDue) {
      const daysLeft = Math.ceil((projectDue.getTime() - today.getTime()) / 86400000);
      if (daysLeft <= 7) {
        alerts.push({
          type: 'warning',
          message: `Prazo do projeto em ${daysLeft} dias.`,
        });
      }
    }

    const { total } = costSummary;
    const budget = selectedProject?.budgetCents ?? 0;
    if (budget > 0 && total > budget) {
      alerts.push({
        type: 'danger',
        message: `Custo real (${formatCurrency(total)}) acima do orçamento (${formatCurrency(budget)}).`,
      });
    }

    if (alerts.length === 0) {
      alerts.push({ type: 'info', message: 'Nenhum alerta crítico no momento.' });
    }
    return alerts;
  }, [tasks, risks, selectedProject, costSummary]);

  const [costCategoryId, setCostCategoryId] = useState('');
  const [costCategoryDetail, setCostCategoryDetail] = useState('');
  const [costType, setCostType] = useState<ProjectCostItem['type']>('PLANEJADO');
  const [costAmount, setCostAmount] = useState('');
  const [costPhaseId, setCostPhaseId] = useState<number | null>(null);
  const [costTaskId, setCostTaskId] = useState<number | null>(null);
  const [costIncurredAt, setCostIncurredAt] = useState('');
  const [costNotes, setCostNotes] = useState('');
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [pendingDeleteCostId, setPendingDeleteCostId] = useState<number | null>(null);

  const [chronosDate, setChronosDate] = useState('');
  const [chronosStartTime, setChronosStartTime] = useState('09:00');
  const [chronosEndTime, setChronosEndTime] = useState('10:00');
  const [chronosTitle, setChronosTitle] = useState('');
  const [chronosSyncMsg, setChronosSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProject?.nome && !chronosTitle) {
      setChronosTitle(`Bloco de foco: ${selectedProject.nome}`);
    }
  }, [selectedProject, chronosTitle]);

  const resetProjectForm = () => {
    setProjectEditingId(null);
    setProjectName('');
    setProjectStatus('EM_ANDAMENTO');
    setProjectDueDate('');
    setProjectBudget('');
  };

  const handleStartEditProject = (project: Projeto) => {
    setMainTab('portfólio');
    setProjectEditingId(project.id);
    setProjectName(project.nome);
    setProjectStatus(project.status);
    setProjectDueDate(formatInputDate(project.prazo));
    setProjectBudget(project.budgetCents ? String(project.budgetCents / 100) : '');
    setProjectFeedback(null);
  };

  const handleSaveProject = async () => {
    if (!projectEditingId || !projectName.trim()) return;
    setProjectFeedback(null);
    const budgetValue = projectBudget ? Math.round(Number(projectBudget) * 100) : 0;
    const response = await fetch('/api/projectus/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: projectEditingId,
        name: projectName.trim(),
        status: projectStatus,
        dueDate: projectDueDate || null,
        budgetCents: budgetValue,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setProjectFeedback(payload.error || 'Falha ao atualizar projeto.');
      return;
    }
    setProjectFeedback('Projeto atualizado com sucesso.');
    resetProjectForm();
    await mutate('/api/projectus/projects');
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    setProjectFeedback(null);
    const budgetValue = projectBudget ? Math.round(Number(projectBudget) * 100) : 0;
    const response = await fetch('/api/projectus/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectName.trim(),
        status: projectStatus,
        dueDate: projectDueDate || null,
        budgetCents: budgetValue,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setProjectFeedback(payload.error || 'Falha ao criar projeto.');
      return;
    }
    setProjectFeedback('Projeto criado com sucesso.');
    resetProjectForm();
    await mutate('/api/projectus/projects');
  };

  const handleDeleteProject = (project: Projeto) => {
    setProjectPendingDelete(project);
    setProjectFeedback(null);
  };

  const resetPhaseForm = () => {
    setEditingPhaseId(null);
    setPhaseName('');
    setPhaseStart('');
    setPhaseEnd('');
    setPhaseStatus('PLANEJADA');
  };
  const resetTaskForm = () => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskPhaseId(null);
    setTaskStart('');
    setTaskDue('');
    setTaskPriority('MEDIA');
    setTaskStatus('ABERTA');
    setTaskProgress(0);
  };
  const resetMilestoneForm = () => {
    setEditingMilestoneId(null);
    setMilestoneName('');
    setMilestoneDue('');
    setMilestoneStatus('ABERTO');
  };
  const resetRiskForm = () => {
    setEditingRiskId(null);
    setRiskTitle('');
    setRiskProbability(3);
    setRiskImpact(3);
    setRiskStatus('ABERTO');
    setRiskMitigation('');
  };
  const resetDependencyForm = () => {
    setEditingDependencyId(null);
    setDependencyTaskId(null);
    setDependencyDependsOnId(null);
  };
  const resetCostForm = () => {
    setEditingCostId(null);
    setCostCategoryId('');
    setCostCategoryDetail('');
    setCostType('PLANEJADO');
    setCostAmount('');
    setCostPhaseId(null);
    setCostTaskId(null);
    setCostIncurredAt('');
    setCostNotes('');
  };

  const selectedCostCategory = useMemo(() => {
    if (!costCategoryId) return null;
    return (costCategories || []).find((c) => String(c.id) === costCategoryId) ?? null;
  }, [costCategories, costCategoryId]);

  if (user && !canView) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você não tem permissão para acessar o Projectus.
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
      </section>
    );
  }

  if (moduleBlocked) {
    return (
      <section className="relative flex-1 overflow-hidden bg-gradient-to-b from-violet-50/70 via-white to-cyan-50/40 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/25 lg:p-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(139,92,246,0.22),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,rgba(139,92,246,0.15),transparent)]"
          aria-hidden
        />
        <div className="relative z-[1]">
          <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="min-w-0">
              <ModuleHeader
                title="Projectus"
                description="O módulo Projectus está condicionado ao plano ativo do time. Ao habilitar o módulo, ficam disponíveis portfólio, visão e planejamento."
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap items-start justify-end gap-2">
              <Button
                asChild
                variant="outline"
                className="w-full border-violet-200/80 bg-white/90 text-violet-800 shadow-sm backdrop-blur-sm hover:bg-violet-50 dark:border-violet-500/25 dark:bg-slate-900/70 dark:text-violet-200 dark:hover:bg-violet-950/40 sm:w-auto"
              >
                <Link href="/manual/projectus">Manual</Link>
              </Button>
            </div>
          </div>

          <Card className="mt-6 border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/10">
            <CardHeader>
              <CardTitle>Módulo indisponível para este plano</CardTitle>
              <CardDescription>{projetosError?.message}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-amber-900 dark:text-amber-100">
              Solicite ao administrador do time a ativação do módulo no plano ativo para liberar portfólio, fases, tarefas, marcos, riscos e custos.
            </CardContent>
          </Card>

          <div className="mt-6">
            <HelpPanel
              title="Ajuda rápida"
              description="Sem o módulo no plano, o backend bloqueia leitura e escrita."
              tips={helpTips}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex-1 overflow-hidden bg-gradient-to-b from-violet-50/70 via-white to-cyan-50/40 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/25 lg:p-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(139,92,246,0.22),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,rgba(139,92,246,0.15),transparent)]"
        aria-hidden
      />
      <div className="relative z-[1]">
        <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0">
            <ModuleHeader
              title="Projectus"
              description="Três modos no topo — Portfólio (lista, filtros, novo projeto), Visão (mapa do projeto, métricas, Gantt, integrações) e Planejar (edição de fases, tarefas, custos). O projeto ativo fica na barra fixa; o seletor respeita os filtros do portfólio."
              className="w-full"
            />
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <Button
              asChild
              variant="outline"
              className="w-full border-violet-200/80 bg-white/90 text-violet-800 shadow-sm backdrop-blur-sm hover:bg-violet-50 dark:border-violet-500/25 dark:bg-slate-900/70 dark:text-violet-200 dark:hover:bg-violet-950/40 sm:w-auto"
            >
              <Link href="/manual/projectus">Manual</Link>
            </Button>
          </div>
        </div>

      {projetosError ? (
        <Card className="mt-4 border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/10">
          <CardContent className="pt-4 text-sm text-amber-900 dark:text-amber-100">
            {projetosError.message}
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScriptumStatCard
          variant="violet"
          icon={FolderKanban}
          title="Projetos na vista"
          description="Lista do portfólio após filtros de status e prazo"
          value={isLoading ? '—' : portfolioOverviewStats.naVista}
          footnote={
            isLoading
              ? 'Carregando GET /api/projectus/projects'
              : `${portfolioOverviewStats.totalServer} no servidor · contagem no cliente`
          }
        />
        <ScriptumStatCard
          variant="indigo"
          icon={Activity}
          title="Em andamento"
          description="Projetos com status ativo na vista filtrada"
          value={isLoading ? '—' : portfolioOverviewStats.emAndamento}
          footnote="Mesmos filtros do cartão Portfólio"
        />
        <ScriptumStatCard
          variant="sky"
          icon={AlertOctagon}
          title="Em risco"
          description="Projetos sinalizados como EM RISCO na vista"
          value={isLoading ? '—' : portfolioOverviewStats.emRisco}
          footnote="Contagem sobre a lista filtrada"
        />
        <ScriptumStatCard
          variant="emerald"
          icon={CheckCircle2}
          title="Concluídos"
          description="Projetos concluídos na vista atual"
          value={isLoading ? '—' : portfolioOverviewStats.concluidos}
          footnote="Status CONCLUIDO após filtros"
        />
      </div>

      <div className="mt-6">
        <ModuleWorkspaceHub
          description={
            mainTab === 'portfólio' ? (
              <>
                Portfólio: lista de projetos, filtros por estado e prazo, criação de novos projetos e selecção do
                projeto activo.
              </>
            ) : mainTab === 'visão' ? (
              <>
                Visão: resumo do projeto activo, métricas, Gantt e ligações (ex.: Taskflow) quando existirem.
              </>
            ) : (
              <>
                Planejar: edição de fases, tarefas, marcos, riscos, dependências e custos do projeto seleccionado.
              </>
            )
          }
          links={
            <Link href="/manual/projectus" className={moduleWorkspaceHubLinkClassName}>
              Manual do Projectus
            </Link>
          }
          tabs={
            <ModuleSegmentedTabs<MainTab>
              aria-label="Modo Projectus"
              tone="accent"
              tabListClassName="max-w-full"
              items={PROJECTUS_MAIN_TAB_ITEMS}
              value={mainTab}
              onValueChange={setMainTab}
            />
          }
        />
      </div>

      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200/90 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-700/90 dark:bg-slate-950/90 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Projeto ativo</p>
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {selectedProject?.nome ?? '—'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {selectedProject
                ? `${selectedProject.status.replace('_', ' ')} · Prazo: ${selectedProject.prazo ? formatDate(selectedProject.prazo) : 'sem prazo'}`
                : 'Selecione um projeto na lista do Portfólio ou ajuste os filtros.'}
            </p>
          </div>
          <div className="w-full max-w-xs shrink-0">
            <Select
              value={stickyProjectSelectValue}
              onValueChange={(v) => {
                if (v === STICKY_PROJECT_SELECT_NONE) return;
                setSelectedProjectId(Number(v));
              }}
              disabled={isLoading || !filteredProjetos.length}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoading
                      ? 'Carregando…'
                      : !filteredProjetos.length
                        ? 'Sem projetos'
                        : 'Selecione um projeto'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {stickyProjectSelectValue === STICKY_PROJECT_SELECT_NONE ? (
                  <SelectItem value={STICKY_PROJECT_SELECT_NONE} disabled className="opacity-70">
                    {isLoading
                      ? 'Carregando…'
                      : !filteredProjetos.length
                        ? 'Sem projetos na vista'
                        : 'Selecione um projeto'}
                  </SelectItem>
                ) : null}
                {filteredProjetos.map((projeto) => (
                  <SelectItem key={projeto.id} value={String(projeto.id)}>
                    {projeto.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {mainTab === 'portfólio' && (
      <div className="mt-6">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Portfólio e novo projeto</CardTitle>
            <CardDescription>
              Filtre a lista por status e intervalo de prazo; use os cartões de resumo ou a lista para ativar o projeto
              (sincroniza com a barra acima). À direita, crie outro registro no portfólio sem sair da página.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 dark:border-slate-700/60 dark:bg-slate-900/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Filtros da lista
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="block min-h-5 text-xs font-medium leading-none text-slate-600 dark:text-slate-400">
                    Status
                  </label>
                  <Select
                    value={portfolioFilterStatus || '_all'}
                    onValueChange={(v) => setPortfolioFilterStatus(v === '_all' ? '' : v)}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos os status</SelectItem>
                      <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                      <SelectItem value="EM_RISCO">Em risco</SelectItem>
                      <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="block min-h-5 text-xs font-medium leading-none text-slate-600 dark:text-slate-400">
                    Prazo desde
                  </label>
                  <Input
                    type="date"
                    className="h-10 w-full"
                    value={portfolioDateFrom}
                    onChange={(e) => setPortfolioDateFrom(e.target.value)}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="block min-h-5 text-xs font-medium leading-none text-slate-600 dark:text-slate-400">
                    Prazo até
                  </label>
                  <Input
                    type="date"
                    className="h-10 w-full"
                    value={portfolioDateTo}
                    onChange={(e) => setPortfolioDateTo(e.target.value)}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className="block min-h-5 text-xs font-medium leading-none text-slate-600 opacity-0 select-none dark:text-slate-400"
                    aria-hidden
                  >
                    {'\u00a0'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 w-full shrink-0 rounded-md px-3 text-sm font-medium"
                    onClick={() => {
                      setPortfolioFilterStatus('');
                      setPortfolioDateFrom('');
                      setPortfolioDateTo('');
                    }}
                  >
                    Limpar filtros
                  </Button>
                </div>
              </div>
            </div>

            {!isLoading && filteredProjetos.length > 0 && (
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Resumo dos projetos
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Vista filtrada — clique para selecionar.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredProjetos.map((projeto) => {
                    const selected = selectedProjectId === projeto.id;
                    const dueDate = projeto.prazo ? parseDateValue(projeto.prazo) : null;
                    let prazoLegenda: string | null = null;
                    if (dueDate) {
                      const t0 = new Date();
                      t0.setHours(0, 0, 0, 0);
                      const diff = Math.ceil((dueDate.getTime() - t0.getTime()) / 86400000);
                      if (diff < 0) prazoLegenda = `Atrasado ${Math.abs(diff)} d`;
                      else if (diff === 0) prazoLegenda = 'Vence hoje';
                      else if (diff <= 7) prazoLegenda = `${diff} d até o prazo`;
                    }
                    return (
                      <button
                        key={projeto.id}
                        type="button"
                        onClick={() => setSelectedProjectId(projeto.id)}
                        className={cn(
                          'flex flex-col gap-2 rounded-xl border p-3 text-left shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60',
                          selected
                            ? 'border-indigo-400 bg-indigo-50/90 ring-1 ring-indigo-200/80 dark:border-indigo-500/60 dark:bg-indigo-500/15 dark:ring-indigo-500/35'
                            : 'border-slate-200/80 bg-white/70 hover:border-indigo-200/80 hover:bg-white dark:border-slate-700/70 dark:bg-slate-950/50 dark:hover:border-indigo-500/45 dark:hover:bg-slate-900/60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
                            {projeto.nome}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                              projeto.status === 'EM_RISCO' &&
                                'bg-rose-500/15 text-rose-700 dark:text-rose-300',
                              projeto.status === 'CONCLUIDO' &&
                                'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
                              projeto.status === 'EM_ANDAMENTO' &&
                                'bg-amber-500/15 text-amber-800 dark:text-amber-200',
                            )}
                          >
                            {projeto.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="space-y-1.5 border-t border-slate-200/70 pt-2 text-xs dark:border-slate-700/60">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="shrink-0 text-slate-500 dark:text-slate-400">Prazo</span>
                            <span className="min-w-0 truncate text-right font-medium tabular-nums text-slate-800 dark:text-slate-200">
                              {projeto.prazo ? formatDate(projeto.prazo) : '—'}
                            </span>
                          </div>
                          {prazoLegenda ? (
                            <p className="text-right text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                              {prazoLegenda}
                            </p>
                          ) : null}
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500 dark:text-slate-400">Orçamento</span>
                            <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
                              {projeto.budgetCents > 0 ? formatCurrency(projeto.budgetCents) : '—'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <div className="flex min-h-0 flex-col gap-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Lista do portfólio</p>
                <div className="flex max-h-[min(22rem,50vh)] flex-col gap-2 overflow-y-auto pr-1">
                  {isLoading ? (
                    <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                      Carregando projetos...
                    </div>
                  ) : projetosList.length === 0 ? (
                    <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                      Nenhum projeto — crie o primeiro à direita.
                    </div>
                  ) : filteredProjetos.length === 0 ? (
                    <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                      Nenhum projeto corresponde aos filtros.
                    </div>
                  ) : (
                    filteredProjetos.map((projeto) => (
                      <div
                        key={projeto.id}
                        className={cn(
                          'atlas-item flex flex-col gap-3',
                          selectedProjectId === projeto.id
                            ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                            : '',
                          projectEditingId === projeto.id
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
                            <p className="atlas-item-meta">
                              Prazo: {projeto.prazo ? formatDate(projeto.prazo) : 'Sem prazo'}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="atlas-item-title">{projeto.nome}</p>
                              {projectEditingId === projeto.id ? (
                                <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                                  Em edição
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span className="atlas-badge bg-amber-500/10 text-amber-600 dark:text-amber-300">
                            {projeto.status.replace('_', ' ')}
                          </span>
                        </button>
                        <EntityEditDeleteActions
                          onEdit={() => handleStartEditProject(projeto)}
                          onDelete={() => handleDeleteProject(projeto)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div
                className={cn(
                  'relative z-[1] flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700/80 dark:bg-slate-900/30',
                  projectEditingId ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {projectEditingId ? 'Editar projeto' : 'Novo projeto'}
                </p>
                <ConfirmActionBanner
                  open={Boolean(projectPendingDelete)}
                  title="Confirmar exclusão de projeto"
                  message={
                    projectPendingDelete
                      ? `Excluir o projeto "${projectPendingDelete.nome}"? Esta ação não pode ser desfeita.`
                      : ''
                  }
                  confirmLabel="Excluir projeto"
                  cancelLabel="Cancelar"
                  onCancel={() => setProjectPendingDelete(null)}
                  onConfirm={async () => {
                    if (!projectPendingDelete) return;
                    const response = await fetch(
                      `/api/projectus/projects?id=${projectPendingDelete.id}`,
                      { method: 'DELETE' },
                    );
                    if (!response.ok) {
                      const payload = (await response.json().catch(() => ({}))) as { error?: string };
                      setProjectFeedback(payload.error || 'Falha ao excluir projeto.');
                      return;
                    }
                    if (selectedProjectId === projectPendingDelete.id) {
                      setSelectedProjectId(null);
                    }
                    if (projectEditingId === projectPendingDelete.id) {
                      resetProjectForm();
                    }
                    setProjectFeedback('Projeto excluído com sucesso.');
                    setProjectPendingDelete(null);
                    await mutate('/api/projectus/projects');
                  }}
                />
                {projectFeedback ? (
                  <IntegrationImpactBanner
                    tone={projectFeedback.toLowerCase().includes('falha') ? 'error' : 'success'}
                    message={projectFeedback}
                  />
                ) : null}
                {projectEditingId ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Modo de edição ativo. Revise os campos e salve as alterações.
                  </p>
                ) : null}
                <Input
                  placeholder="Nome do projeto"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                />
                <Select
                  value={projectStatus}
                  onValueChange={(v) => setProjectStatus(v as Projeto['status'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                    <SelectItem value="EM_RISCO">Em risco</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  </SelectContent>
                </Select>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Prazo de entrega (opcional)
                  </label>
                  <Input
                    type="date"
                    className="w-full"
                    value={projectDueDate}
                    onChange={(event) => setProjectDueDate(event.target.value)}
                  />
                </div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Orçamento (R$)"
                  value={projectBudget}
                  onChange={(event) => setProjectBudget(event.target.value)}
                />
                <Button
                  type="button"
                  disabled={!projectName.trim()}
                  onClick={projectEditingId ? handleSaveProject : handleCreateProject}
                >
                  {projectEditingId ? 'Salvar projeto' : 'Criar projeto'}
                </Button>
                {projectEditingId ? (
                  <Button type="button" variant="outline" onClick={resetProjectForm}>
                    Cancelar edição
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {mainTab === 'visão' && (
        <>
          {!selectedProjectId ? (
            <Card className="mt-6 atlas-surface atlas-hover">
              <CardContent className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">
                Não há projeto selecionado. Na aba Portfólio, escolha um projeto na lista ou relaxe os filtros para
                voltar a ver resultados.
              </CardContent>
            </Card>
          ) : (
            <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScriptumStatCard
          variant="violet"
          icon={FolderKanban}
          title="Projetos na vista filtrada"
          description="Contagem após filtros do portfólio"
          value={filteredProjetos.length}
          footnote={`${projetosList.length} no servidor · GET /api/projectus/projects`}
        />
        <ScriptumStatCard
          variant="indigo"
          icon={Target}
          title="Progresso das tarefas"
          description="Concluídas ÷ total (projeto ativo)"
          value={`${metrics.progress}%`}
          footnote={`${metrics.completedTasks} de ${metrics.totalTasks} tarefas`}
        />
        <ScriptumStatCard
          variant="sky"
          icon={AlertOctagon}
          title="Riscos cadastrados"
          description="Itens no projeto ativo"
          value={risks?.length ?? 0}
          footnote="Média probabilidade × impacto (projeto ativo)"
        />
        <ScriptumStatCard
          variant="emerald"
          icon={Wallet}
          title="Custo acumulado"
          description="Planejado + real (projeto ativo)"
          value={formatCurrency(costSummary.total)}
          footnote={
            (selectedProject?.budgetCents ?? 0) > 0
              ? `Orçamento ${formatCurrency(selectedProject?.budgetCents)}`
              : 'Sem orçamento definido'
          }
        />
      </div>

      <div className="mt-6">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Mapa do projeto</CardTitle>
              <CardDescription>
                Visão geral só de leitura: fases, tarefas, marcos e riscos lado a lado. O Gantt abaixo detalha só as
                tarefas com datas; aqui vê tudo o que compõe o plano.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setMainTab('planejar')}>
              Editar em Planejar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <div className="flex min-h-0 flex-col rounded-xl border border-slate-200/90 bg-slate-50/50 dark:border-slate-700/80 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 border-b border-slate-200/80 px-3 py-2 dark:border-slate-700/80">
                  <Layers className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Fases</p>
                  <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
                    {phases?.length ?? 0}
                  </span>
                </div>
                <div className="max-h-[min(420px,52vh)] space-y-2 overflow-y-auto p-2">
                  {(phases || []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-2 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhuma fase cadastrada.
                    </p>
                  ) : (
                    [...(phases || [])]
                      .sort((a, b) => a.position - b.position)
                      .map((phase) => (
                        <div
                          key={phase.id}
                          className="rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-2 text-xs dark:border-slate-700/80 dark:bg-slate-950/50"
                        >
                          <p className="font-medium text-slate-800 dark:text-slate-100">{phase.name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {phase.startDate ? formatDate(phase.startDate) : '—'} →{' '}
                            {phase.endDate ? formatDate(phase.endDate) : '—'}
                          </p>
                          <span className="mt-1 inline-flex rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                            {phase.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-xl border border-slate-200/90 bg-slate-50/50 dark:border-slate-700/80 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 border-b border-slate-200/80 px-3 py-2 dark:border-slate-700/80">
                  <ListChecks className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tarefas</p>
                  <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
                    {tasks?.length ?? 0}
                  </span>
                </div>
                <div className="max-h-[min(420px,52vh)] space-y-2 overflow-y-auto p-2">
                  {(tasks || []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-2 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhuma tarefa cadastrada.
                    </p>
                  ) : (
                    [...(tasks || [])]
                      .sort((a, b) => {
                        const as = a.startDate || '';
                        const bs = b.startDate || '';
                        if (as !== bs) return as.localeCompare(bs);
                        return a.title.localeCompare(b.title, 'pt-BR');
                      })
                      .map((task) => {
                        const phaseName =
                          task.phaseId != null
                            ? (phases || []).find((p) => p.id === task.phaseId)?.name
                            : null;
                        return (
                          <div
                            key={task.id}
                            className="rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-2 text-xs dark:border-slate-700/80 dark:bg-slate-950/50"
                          >
                            <p className="font-medium text-slate-800 dark:text-slate-100">{task.title}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {task.startDate ? formatDate(task.startDate) : '—'} →{' '}
                              {task.dueDate ? formatDate(task.dueDate) : '—'} · {task.progress}%
                            </p>
                            {phaseName ? (
                              <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">Fase: {phaseName}</p>
                            ) : null}
                            <span className="mt-1 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-xl border border-slate-200/90 bg-slate-50/50 dark:border-slate-700/80 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 border-b border-slate-200/80 px-3 py-2 dark:border-slate-700/80">
                  <Flag className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Marcos</p>
                  <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
                    {milestones?.length ?? 0}
                  </span>
                </div>
                <div className="max-h-[min(420px,52vh)] space-y-2 overflow-y-auto p-2">
                  {(milestones || []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-2 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhum marco cadastrado.
                    </p>
                  ) : (
                    [...(milestones || [])]
                      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                      .map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-2 text-xs dark:border-slate-700/80 dark:bg-slate-950/50"
                        >
                          <p className="font-medium text-slate-800 dark:text-slate-100">{m.name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {formatDate(m.dueDate)}
                          </p>
                          <span className="mt-1 inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                            {m.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-xl border border-slate-200/90 bg-slate-50/50 dark:border-slate-700/80 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 border-b border-slate-200/80 px-3 py-2 dark:border-slate-700/80">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Riscos</p>
                  <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
                    {risks?.length ?? 0}
                  </span>
                </div>
                <div className="max-h-[min(420px,52vh)] space-y-2 overflow-y-auto p-2">
                  {(risks || []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-2 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhum risco cadastrado.
                    </p>
                  ) : (
                    [...(risks || [])]
                      .sort((a, b) => b.probability * b.impact - a.probability * a.impact)
                      .map((risk) => (
                        <div
                          key={risk.id}
                          className="rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-2 text-xs dark:border-slate-700/80 dark:bg-slate-950/50"
                        >
                          <p className="font-medium text-slate-800 dark:text-slate-100">{risk.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            Prob. {risk.probability} · Imp. {risk.impact} (P×I {risk.probability * risk.impact})
                          </p>
                          <span className="mt-1 inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:text-rose-200">
                            {risk.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Orçamento e indicadores do projeto ativo</CardTitle>
            <CardDescription>
              Custos por tipo e confronto com progresso e risco médio (mesmos dados dos cartões acima).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Financeiro (Projectus)
              </p>
              <div className="flex items-center justify-between">
                <span>Planejado</span>
                <span className="font-semibold">{formatCurrency(costSummary.planned)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Real</span>
                <span className="font-semibold">{formatCurrency(costSummary.actual)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                <span>Orçamento do projeto</span>
                <span className="font-semibold">{formatCurrency(selectedProject?.budgetCents)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Execução
              </p>
              <div className="flex items-center justify-between">
                <span>Progresso</span>
                <span className="font-semibold">{metrics.progress}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Risco médio (P×I)</span>
                <span className="font-semibold">{metrics.riskScore}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                <span>Prazo alvo</span>
                <span className="font-semibold">
                  {selectedProject?.prazo ? formatDate(selectedProject.prazo) : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="atlas-surface atlas-hover overflow-hidden">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-base font-semibold">Gantt simplificado</CardTitle>
            <CardDescription>
              Tarefas do Projectus com início e fim; setas quando existirem dependências registradas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(ganttBars.rows || []).filter(Boolean).length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 text-center dark:border-slate-700">
                <div className="mb-2 text-slate-400 dark:text-slate-500">
                  <svg className="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Nenhuma tarefa com datas definidas
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Adicione tarefas com data de início e prazo para ver o Gantt.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Timeline header */}
                <div className="flex gap-4 pl-40">
                  <div className="flex flex-1 items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/30">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {ganttBars.start.toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span className="text-xs text-slate-400">→</span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {ganttBars.end.toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                </div>
                {/* Bars */}
                <div className="relative">
                  {ganttBars.dependencyArrows && ganttBars.dependencyArrows.length > 0 && (() => {
                    const rowCount = ganttBars.rows.filter(Boolean).length;
                    const rowH = 36;
                    const gap = 16;
                    const totalH = rowCount * (rowH + gap);
                    return (
                      <svg
                        className="pointer-events-none absolute left-40 right-0 top-0 h-full min-h-[80px]"
                        viewBox={`0 0 100 ${totalH}`}
                        preserveAspectRatio="none"
                        style={{ width: 'calc(100% - 10rem)' }}
                      >
                        {ganttBars.dependencyArrows.map((arr, i) => {
                          const fromY = arr.fromY * (rowH + gap) + rowH / 2;
                          const toY = arr.toY * (rowH + gap) + rowH / 2;
                          const midX = (arr.fromX + arr.toX) / 2;
                          const path = `M ${arr.fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${arr.toX} ${toY}`;
                          return (
                            <path
                              key={i}
                              d={path}
                              fill="none"
                              stroke="rgb(99 102 241)"
                              strokeWidth="1"
                              strokeDasharray="4 3"
                              opacity={0.5}
                            />
                          );
                        })}
                      </svg>
                    );
                  })()}
                  <div className="space-y-4">
                    {ganttBars.rows.map((row) => {
                      if (!row) return null;
                      const left = (row.offset / ganttBars.span) * 100;
                      const width = Math.max(4, (row.length / ganttBars.span) * 100);
                      const depOn = (dependencies || []).find((d) => d.taskId === row.id);
                      const depOnTask = depOn
                        ? (tasks || []).find((t) => t.id === depOn.dependsOnTaskId)
                        : null;
                      const task = (tasks || []).find((t) => t.id === row.id);
                      const progress = task?.progress ?? 0;
                      const barColors =
                        row.priority === 'ALTA'
                          ? 'from-rose-500 to-rose-600 dark:from-rose-500 dark:to-rose-600'
                          : row.priority === 'MEDIA'
                            ? 'from-indigo-500 to-indigo-600 dark:from-indigo-500 dark:to-indigo-600'
                            : 'from-emerald-500 to-emerald-600 dark:from-emerald-500 dark:to-emerald-600';
                      return (
                        <div
                          key={row.id}
                          className="flex items-center gap-4"
                          style={{ minHeight: 36 }}
                        >
                          <div
                            className="w-40 shrink-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200"
                            title={row.title}
                          >
                            {row.title}
                            {depOnTask && (
                              <span
                                className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-[10px] text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                                title={`Depende de: ${depOnTask.title}`}
                              >
                                ↗
                              </span>
                            )}
                          </div>
                          <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/80">
                            <div
                              className={`absolute inset-y-0 rounded-lg bg-gradient-to-r ${barColors} shadow-sm transition-all`}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                              }}
                            >
                              {progress > 0 && progress < 100 && (
                                <div
                                  className="absolute inset-y-0 left-0 rounded-l-lg border-r border-white/30 bg-white/20"
                                  style={{ width: `${progress}%` }}
                                />
                              )}
                            </div>
                            {progress > 0 && width > 15 && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
                                {progress}%
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-4">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Resumo do projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Projeto
              </p>
              <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-100">
                {selectedProject?.nome || '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {phases?.length || 0}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Fases</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {milestones?.length || 0}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Marcos</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {risks?.length || 0}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Riscos</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {tasks?.length || 0}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tarefas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {projectAlerts.map((alert, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-xs ${
                  alert.type === 'danger'
                    ? 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
                    : alert.type === 'warning'
                      ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
                      : 'bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300'
                }`}
              >
                {alert.message}
              </div>
            ))}
          </CardContent>
        </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Taskflow (leitura)</CardTitle>
            <CardDescription>
              Tarefas do quadro já associadas a este projeto via API. A ligação é feita no Taskflow; esta lista só
              mostra o espelho.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            {(taskflowTasks || []).length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma tarefa do Taskflow vinculada a este projeto.
              </div>
            ) : (
              (taskflowTasks || []).map((task) => (
                <div key={task.id} className="atlas-item">
                  <div className="flex items-center justify-between">
                    <p className="atlas-item-title">{task.title}</p>
                    <span className="atlas-badge bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                      {task.columnName}
                    </span>
                  </div>
                  <p className="atlas-item-meta">
                    {task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'}
                  </p>
                </div>
              ))
            )}
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link href="/dashboard/taskflow">Abrir Taskflow</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Atalho Chronos</CardTitle>
            <CardDescription>
              Cria um bloco na agenda (POST /api/chronos/agenda). Campos de data e hora usam o tema global no modo
              escuro.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            <IntegrationImpactBanner
              tone="info"
              message="Impacto desta ação: cria compromisso no Chronos para planeamento, sem alterar fases/tarefas/custos do Projectus."
            />
            {chronosSyncMsg ? (
              <IntegrationImpactBanner
                message={chronosSyncMsg}
                tone={chronosSyncMsg.startsWith('Falha') ? 'error' : 'success'}
              />
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Data do bloco</label>
                <Input
                  type="date"
                  value={chronosDate}
                  onChange={(event) => setChronosDate(event.target.value)}
                />
              </div>
              <Input
                placeholder="Título do bloco"
                value={chronosTitle}
                onChange={(event) => setChronosTitle(event.target.value)}
              />
              <div className="hidden sm:block" />
              <Input type="time" value={chronosStartTime} onChange={(e) => setChronosStartTime(e.target.value)} />
              <Input type="time" value={chronosEndTime} onChange={(e) => setChronosEndTime(e.target.value)} />
            </div>
            <Button
              disabled={!chronosDate || !chronosTitle.trim()}
              onClick={async () => {
                setChronosSyncMsg(null);
                try {
                  const res = await fetch('/api/chronos/agenda', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      date: chronosDate,
                      startTime: chronosStartTime,
                      endTime: chronosEndTime,
                      title: chronosTitle.trim(),
                      type: 'FOCO',
                      description: selectedProject?.nome ? `Projeto: ${selectedProject.nome}` : null,
                    }),
                  });
                  const payload = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    id?: number;
                  };
                  if (!res.ok) {
                    setChronosSyncMsg(
                      `Falha ao enviar para o Chronos: ${payload.error || res.statusText || 'pedido inválido'}.`,
                    );
                    return;
                  }
                  setChronosSyncMsg(
                    `Ação concluída: bloco enviado ao Chronos (compromisso #${
                      typeof payload.id === 'number' ? payload.id : '—'
                    }).`,
                  );
                  setChronosDate('');
                  setChronosStartTime('09:00');
                  setChronosEndTime('10:00');
                } catch (e) {
                  setChronosSyncMsg(
                    `Falha ao enviar para o Chronos: ${e instanceof Error ? e.message : 'erro de rede'}.`,
                  );
                }
              }}
            >
              Criar bloco no Chronos
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Ligações a outros módulos</CardTitle>
            <CardDescription>
              O que consome <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">projectId</code> do
              Projectus em outras telas — sem prometer automação que não existe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
              <p className="font-medium text-slate-800 dark:text-slate-100">BillTrak, Bibliotheca, Notepad, ResourceHub</p>
              <p className="mt-1 text-xs leading-relaxed">
                Esses módulos permitem escolher um projeto do portfólio ao criar lançamento, documento, nota ou
                alocação. <strong>Não há</strong> sincronização automática de custos do Projectus para o BillTrak: os
                custos planejados/reais desta página vivem nas APIs do Projectus (
                <code className="rounded bg-white/90 px-1 dark:bg-slate-800">/api/projectus/costs</code>).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard/billtrak">BillTrak</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard/resourcehub">ResourceHub</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard/bibliotheca">Bibliotheca</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard/notepad">Notepad</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/manual/projectus">Manual completo</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
            </>
          )}
        </>
      )}

      {mainTab === 'planejar' && (
        <>
          {!selectedProjectId ? (
            <Card className="mt-6 atlas-surface atlas-hover">
              <CardContent className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">
                Escolha um projeto na barra acima ou na aba Portfólio para planejar fases, tarefas e custos.
              </CardContent>
            </Card>
          ) : (
            <>
      <div className="mt-4 max-w-xs space-y-1">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Filtro da lista de fases (só visual)</p>
        <Select
          value={phaseListFilter || '_all'}
          onValueChange={(v) => setPhaseListFilter(v === '_all' ? '' : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Estado da fase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas as fases</SelectItem>
            <SelectItem value="PLANEJADA">Planejada</SelectItem>
            <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
            <SelectItem value="CONCLUIDA">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Fases</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {phasesFiltered.map((phase) => (
              <div
                key={phase.id}
                className={cn(
                  'atlas-item',
                  editingPhaseId === phase.id ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
                )}
              >
                <p className="atlas-item-title">{phase.name}</p>
                <p className="atlas-item-meta">
                  {phase.startDate ? formatDate(phase.startDate) : '—'} →{' '}
                  {phase.endDate ? formatDate(phase.endDate) : '—'}
                </p>
                <span className="atlas-badge bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                  {phase.status}
                </span>
                {editingPhaseId === phase.id ? (
                  <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">Em edição</span>
                ) : null}
                <EntityEditDeleteActions
                  className="mt-2"
                  onEdit={() => {
                    setEditingPhaseId(phase.id);
                    setPhaseName(phase.name);
                    setPhaseStart(phase.startDate ? formatInputDate(phase.startDate) : '');
                    setPhaseEnd(phase.endDate ? formatInputDate(phase.endDate) : '');
                    setPhaseStatus(phase.status);
                  }}
                  onDelete={() => setPendingDeletePhaseId(phase.id)}
                />
              </div>
            ))}
            <ConfirmActionBanner
              open={Boolean(pendingDeletePhaseId)}
              title="Confirmar exclusão de fase"
              message="Excluir esta fase?"
              confirmLabel="Excluir fase"
              cancelLabel="Cancelar"
              onCancel={() => setPendingDeletePhaseId(null)}
              onConfirm={async () => {
                if (!pendingDeletePhaseId || !selectedProjectId) return;
                await fetch(`/api/projectus/phases?id=${pendingDeletePhaseId}`, { method: 'DELETE' });
                setPendingDeletePhaseId(null);
                if (editingPhaseId === pendingDeletePhaseId) resetPhaseForm();
                await mutate(`/api/projectus/phases?projectId=${selectedProjectId}`);
              }}
            />
            <div
              className={cn(
                'flex flex-col gap-2 rounded-xl p-2',
                editingPhaseId ? 'border border-amber-300/70 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
              )}
            >
              {editingPhaseId ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Modo de edição ativo. Revise os campos e salve as alterações.</p>
              ) : null}
              <input
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Nova fase"
                value={phaseName}
                onChange={(event) => setPhaseName(event.target.value)}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={phaseStart}
                  onChange={(event) => setPhaseStart(event.target.value)}
                />
                <input
                  type="date"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={phaseEnd}
                  onChange={(event) => setPhaseEnd(event.target.value)}
                />
              </div>
              <Select
                value={phaseStatus}
                onValueChange={(v) => setPhaseStatus(v as ProjectPhase['status'])}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANEJADA">Planejada</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                  <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                </SelectContent>
              </Select>
              <button
                className="rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                disabled={!selectedProjectId || !phaseName.trim()}
                onClick={async () => {
                  if (!selectedProjectId) return;
                  await fetch('/api/projectus/phases', {
                    method: editingPhaseId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ...(editingPhaseId ? { id: editingPhaseId } : {}),
                      projectId: selectedProjectId,
                      name: phaseName.trim(),
                      startDate: phaseStart || null,
                      endDate: phaseEnd || null,
                      status: phaseStatus,
                      position: (phases?.length || 0) + 1,
                    }),
                  });
                  resetPhaseForm();
                  await mutate(`/api/projectus/phases?projectId=${selectedProjectId}`);
                }}
              >
                {editingPhaseId ? 'Salvar fase' : 'Adicionar fase'}
              </button>
              {editingPhaseId ? (
                <Button type="button" size="sm" variant="outline" onClick={resetPhaseForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Tarefas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(tasks || []).map((task) => (
              <div
                key={task.id}
                className={cn(
                  'atlas-item',
                  editingTaskId === task.id ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
                )}
              >
                <p className="atlas-item-title">{task.title}</p>
                <p className="atlas-item-meta">
                  {task.startDate ? formatDate(task.startDate) : '—'} →{' '}
                  {task.dueDate ? formatDate(task.dueDate) : '—'} · {task.progress}%
                </p>
                <span className="atlas-badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  {task.status}
                </span>
                {editingTaskId === task.id ? (
                  <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">Em edição</span>
                ) : null}
                <EntityEditDeleteActions
                  className="mt-2"
                  onEdit={() => {
                    setEditingTaskId(task.id);
                    setTaskTitle(task.title);
                    setTaskPhaseId(task.phaseId ?? null);
                    setTaskStart(task.startDate ? formatInputDate(task.startDate) : '');
                    setTaskDue(task.dueDate ? formatInputDate(task.dueDate) : '');
                    setTaskPriority(task.priority);
                    setTaskStatus(task.status);
                    setTaskProgress(task.progress);
                  }}
                  onDelete={() => setPendingDeleteTaskId(task.id)}
                />
              </div>
            ))}
            <ConfirmActionBanner
              open={Boolean(pendingDeleteTaskId)}
              title="Confirmar exclusão de tarefa"
              message="Excluir esta tarefa?"
              confirmLabel="Excluir tarefa"
              cancelLabel="Cancelar"
              onCancel={() => setPendingDeleteTaskId(null)}
              onConfirm={async () => {
                if (!pendingDeleteTaskId || !selectedProjectId) return;
                await fetch(`/api/projectus/tasks?id=${pendingDeleteTaskId}`, { method: 'DELETE' });
                setPendingDeleteTaskId(null);
                if (editingTaskId === pendingDeleteTaskId) resetTaskForm();
                await mutate(`/api/projectus/tasks?projectId=${selectedProjectId}`);
              }}
            />
            <div
              className={cn(
                'flex flex-col gap-2 rounded-xl p-2',
                editingTaskId ? 'border border-amber-300/70 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
              )}
            >
              {editingTaskId ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Modo de edição ativo. Revise os campos e salve as alterações.</p>
              ) : null}
              <input
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Nova tarefa"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
              />
              <Select
                value={taskPhaseId ? String(taskPhaseId) : '_none'}
                onValueChange={(v) =>
                  setTaskPhaseId(v === '_none' ? null : Number(v))
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Fase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem fase</SelectItem>
                  {(phases || []).map((phase) => (
                    <SelectItem key={phase.id} value={String(phase.id)}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={taskStart}
                  onChange={(event) => setTaskStart(event.target.value)}
                />
                <input
                  type="date"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={taskDue}
                  onChange={(event) => setTaskDue(event.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={taskPriority}
                  onValueChange={(v) => setTaskPriority(v as ProjectTask['priority'])}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="MEDIA">Média</SelectItem>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={taskStatus}
                  onValueChange={(v) => setTaskStatus(v as ProjectTask['status'])}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABERTA">Aberta</SelectItem>
                    <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                    <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label
                  htmlFor="projectus-task-progress"
                  className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400"
                >
                  % executado
                </label>
                <p id="projectus-task-progress-hint" className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-500">
                  Quanto da tarefa já foi feito, de 0 a 100.
                </p>
                <input
                  id="projectus-task-progress"
                  type="number"
                  min={0}
                  max={100}
                  aria-describedby="projectus-task-progress-hint"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={taskProgress}
                  onChange={(event) => setTaskProgress(Number(event.target.value))}
                />
              </div>
              <button
                className="rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                disabled={!selectedProjectId || !taskTitle.trim()}
                onClick={async () => {
                  if (!selectedProjectId) return;
                  await fetch('/api/projectus/tasks', {
                    method: editingTaskId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ...(editingTaskId ? { id: editingTaskId } : {}),
                      projectId: selectedProjectId,
                      phaseId: taskPhaseId,
                      title: taskTitle.trim(),
                      startDate: taskStart || null,
                      dueDate: taskDue || null,
                      priority: taskPriority,
                      status: taskStatus,
                      progress: taskProgress,
                    }),
                  });
                  resetTaskForm();
                  await mutate(`/api/projectus/tasks?projectId=${selectedProjectId}`);
                }}
              >
                {editingTaskId ? 'Salvar tarefa' : 'Adicionar tarefa'}
              </button>
              {editingTaskId ? (
                <Button type="button" size="sm" variant="outline" onClick={resetTaskForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Marcos e riscos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-500">Marcos</p>
              {(milestones || []).map((milestone) => (
                <div
                  key={milestone.id}
                  className={cn(
                    'atlas-item',
                    editingMilestoneId === milestone.id
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                      : '',
                  )}
                >
                  <p className="atlas-item-title">{milestone.name}</p>
                  <p className="atlas-item-meta">{formatDate(milestone.dueDate)}</p>
                  {editingMilestoneId === milestone.id ? (
                    <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">Em edição</span>
                  ) : null}
                  <EntityEditDeleteActions
                    className="mt-2"
                    onEdit={() => {
                      setEditingMilestoneId(milestone.id);
                      setMilestoneName(milestone.name);
                      setMilestoneDue(formatInputDate(milestone.dueDate));
                      setMilestoneStatus(milestone.status);
                    }}
                    onDelete={() => setPendingDeleteMilestoneId(milestone.id)}
                  />
                </div>
              ))}
              <ConfirmActionBanner
                open={Boolean(pendingDeleteMilestoneId)}
                title="Confirmar exclusão de marco"
                message="Excluir este marco?"
                confirmLabel="Excluir marco"
                cancelLabel="Cancelar"
                onCancel={() => setPendingDeleteMilestoneId(null)}
                onConfirm={async () => {
                  if (!pendingDeleteMilestoneId || !selectedProjectId) return;
                  await fetch(`/api/projectus/milestones?id=${pendingDeleteMilestoneId}`, { method: 'DELETE' });
                  setPendingDeleteMilestoneId(null);
                  if (editingMilestoneId === pendingDeleteMilestoneId) resetMilestoneForm();
                  await mutate(`/api/projectus/milestones?projectId=${selectedProjectId}`);
                }}
              />
              <div
                className={cn(
                  'flex flex-col gap-2 rounded-xl p-2',
                  editingMilestoneId
                    ? 'border border-amber-300/70 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10'
                    : '',
                )}
              >
                {editingMilestoneId ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Modo de edição ativo. Revise os campos e salve as alterações.
                  </p>
                ) : null}
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  placeholder="Novo marco"
                  value={milestoneName}
                  onChange={(event) => setMilestoneName(event.target.value)}
                />
                <input
                  type="date"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={milestoneDue}
                  onChange={(event) => setMilestoneDue(event.target.value)}
                />
                <Select
                  value={milestoneStatus}
                  onValueChange={(v) => setMilestoneStatus(v as ProjectMilestone['status'])}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABERTO">Aberto</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  className="rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                  disabled={!selectedProjectId || !milestoneName.trim() || !milestoneDue}
                  onClick={async () => {
                    if (!selectedProjectId) return;
                    await fetch('/api/projectus/milestones', {
                      method: editingMilestoneId ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...(editingMilestoneId ? { id: editingMilestoneId } : {}),
                        projectId: selectedProjectId,
                        name: milestoneName.trim(),
                        dueDate: milestoneDue,
                        status: milestoneStatus,
                      }),
                    });
                    resetMilestoneForm();
                    await mutate(`/api/projectus/milestones?projectId=${selectedProjectId}`);
                  }}
                >
                  {editingMilestoneId ? 'Salvar marco' : 'Adicionar marco'}
                </button>
                {editingMilestoneId ? (
                  <Button type="button" size="sm" variant="outline" onClick={resetMilestoneForm}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-500">Riscos</p>
              {(risks || []).map((risk) => (
                <div
                  key={risk.id}
                  className={cn(
                    'atlas-item',
                    editingRiskId === risk.id ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
                  )}
                >
                  <p className="atlas-item-title">{risk.title}</p>
                  <p className="atlas-item-meta">
                    Probabilidade: {risk.probability} · Impacto: {risk.impact} (escala 1–5)
                  </p>
                  {editingRiskId === risk.id ? (
                    <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">Em edição</span>
                  ) : null}
                  <EntityEditDeleteActions
                    className="mt-2"
                    onEdit={() => {
                      setEditingRiskId(risk.id);
                      setRiskTitle(risk.title);
                      setRiskProbability(risk.probability);
                      setRiskImpact(risk.impact);
                      setRiskStatus(risk.status);
                      setRiskMitigation(risk.mitigation || '');
                    }}
                    onDelete={() => setPendingDeleteRiskId(risk.id)}
                  />
                </div>
              ))}
              <ConfirmActionBanner
                open={Boolean(pendingDeleteRiskId)}
                title="Confirmar exclusão de risco"
                message="Excluir este risco?"
                confirmLabel="Excluir risco"
                cancelLabel="Cancelar"
                onCancel={() => setPendingDeleteRiskId(null)}
                onConfirm={async () => {
                  if (!pendingDeleteRiskId || !selectedProjectId) return;
                  await fetch(`/api/projectus/risks?id=${pendingDeleteRiskId}`, { method: 'DELETE' });
                  setPendingDeleteRiskId(null);
                  if (editingRiskId === pendingDeleteRiskId) resetRiskForm();
                  await mutate(`/api/projectus/risks?projectId=${selectedProjectId}`);
                }}
              />
              <div
                className={cn(
                  'flex flex-col gap-2 rounded-xl p-2',
                  editingRiskId
                    ? 'border border-amber-300/70 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10'
                    : '',
                )}
              >
                {editingRiskId ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Modo de edição ativo. Revise os campos e salve as alterações.
                  </p>
                ) : null}
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  placeholder="Novo risco"
                  value={riskTitle}
                  onChange={(event) => setRiskTitle(event.target.value)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="projectus-risk-probability"
                      className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400"
                    >
                      Probabilidade
                    </label>
                    <p
                      id="projectus-risk-probability-hint"
                      className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-500"
                    >
                      Quão provável é o risco materializar-se (1 = raro, 5 = muito provável).
                    </p>
                    <input
                      id="projectus-risk-probability"
                      type="number"
                      min={1}
                      max={5}
                      aria-describedby="projectus-risk-probability-hint"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                      value={riskProbability}
                      onChange={(event) => setRiskProbability(Number(event.target.value))}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="projectus-risk-impact"
                      className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400"
                    >
                      Impacto
                    </label>
                    <p
                      id="projectus-risk-impact-hint"
                      className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-500"
                    >
                      Gravidade se ocorrer (1 = baixo, 5 = crítico). Usamos P×I no resumo do projeto.
                    </p>
                    <input
                      id="projectus-risk-impact"
                      type="number"
                      min={1}
                      max={5}
                      aria-describedby="projectus-risk-impact-hint"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                      value={riskImpact}
                      onChange={(event) => setRiskImpact(Number(event.target.value))}
                    />
                  </div>
                </div>
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  placeholder="Plano de mitigação"
                  value={riskMitigation}
                  onChange={(event) => setRiskMitigation(event.target.value)}
                />
                <Select
                  value={riskStatus}
                  onValueChange={(v) => setRiskStatus(v as ProjectRisk['status'])}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABERTO">Aberto</SelectItem>
                    <SelectItem value="MITIGADO">Mitigado</SelectItem>
                    <SelectItem value="OCORREU">Ocorreu</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  className="rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                  disabled={!selectedProjectId || !riskTitle.trim()}
                  onClick={async () => {
                    if (!selectedProjectId) return;
                    await fetch('/api/projectus/risks', {
                      method: editingRiskId ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...(editingRiskId ? { id: editingRiskId } : {}),
                        projectId: selectedProjectId,
                        title: riskTitle.trim(),
                        probability: riskProbability,
                        impact: riskImpact,
                        status: riskStatus,
                        mitigation: riskMitigation,
                      }),
                    });
                    resetRiskForm();
                    await mutate(`/api/projectus/risks?projectId=${selectedProjectId}`);
                  }}
                >
                  {editingRiskId ? 'Salvar risco' : 'Adicionar risco'}
                </button>
                {editingRiskId ? (
                  <Button type="button" size="sm" variant="outline" onClick={resetRiskForm}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Dependências</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(dependencies || []).length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma dependência registrada.
              </div>
            ) : (
              (dependencies || []).map((dependency) => {
                const task = (tasks || []).find((item) => item.id === dependency.taskId);
                const dependsOn = (tasks || []).find(
                  (item) => item.id === dependency.dependsOnTaskId,
                );
                return (
                  <div
                    key={dependency.id}
                    className={cn(
                      'atlas-item',
                      editingDependencyId === dependency.id
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                        : '',
                    )}
                  >
                    <p className="atlas-item-title">
                      {task?.title || 'Tarefa'} depende de {dependsOn?.title || 'Tarefa'}
                    </p>
                    {editingDependencyId === dependency.id ? (
                      <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">
                        Em edição
                      </span>
                    ) : null}
                    <EntityEditDeleteActions
                      className="mt-2"
                      onEdit={() => {
                        setEditingDependencyId(dependency.id);
                        setDependencyTaskId(dependency.taskId);
                        setDependencyDependsOnId(dependency.dependsOnTaskId);
                      }}
                      onDelete={() => setPendingDeleteDependencyId(dependency.id)}
                    />
                  </div>
                );
              })
            )}
            <ConfirmActionBanner
              open={Boolean(pendingDeleteDependencyId)}
              title="Confirmar exclusão de dependência"
              message="Excluir esta dependência?"
              confirmLabel="Excluir dependência"
              cancelLabel="Cancelar"
              onCancel={() => setPendingDeleteDependencyId(null)}
              onConfirm={async () => {
                if (!pendingDeleteDependencyId || !selectedProjectId) return;
                await fetch(`/api/projectus/dependencies?id=${pendingDeleteDependencyId}`, { method: 'DELETE' });
                setPendingDeleteDependencyId(null);
                if (editingDependencyId === pendingDeleteDependencyId) resetDependencyForm();
                await mutate(`/api/projectus/dependencies?projectId=${selectedProjectId}`);
              }}
            />
            <div
              className={cn(
                'flex flex-col gap-2 rounded-xl p-2',
                editingDependencyId
                  ? 'border border-amber-300/70 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10'
                  : '',
              )}
            >
              {editingDependencyId ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Modo de edição ativo. Revise os campos e salve as alterações.
                </p>
              ) : null}
              <Select
                value={dependencyTaskId ? String(dependencyTaskId) : '_none'}
                onValueChange={(v) =>
                  setDependencyTaskId(v === '_none' ? null : Number(v))
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Tarefa dependente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Tarefa dependente</SelectItem>
                  {(tasks || []).map((task) => (
                    <SelectItem key={task.id} value={String(task.id)}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={dependencyDependsOnId ? String(dependencyDependsOnId) : '_none'}
                onValueChange={(v) =>
                  setDependencyDependsOnId(v === '_none' ? null : Number(v))
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Depende de" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Depende de</SelectItem>
                  {(tasks || []).map((task) => (
                    <SelectItem key={task.id} value={String(task.id)}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                className="rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                disabled={!selectedProjectId || !dependencyTaskId || !dependencyDependsOnId}
                onClick={async () => {
                  if (!selectedProjectId || !dependencyTaskId || !dependencyDependsOnId) {
                    return;
                  }
                  await fetch('/api/projectus/dependencies', {
                    method: editingDependencyId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ...(editingDependencyId ? { id: editingDependencyId } : {}),
                      projectId: selectedProjectId,
                      taskId: dependencyTaskId,
                      dependsOnTaskId: dependencyDependsOnId,
                    }),
                  });
                  resetDependencyForm();
                  await mutate(`/api/projectus/dependencies?projectId=${selectedProjectId}`);
                }}
              >
                {editingDependencyId ? 'Salvar dependência' : 'Adicionar dependência'}
              </button>
              {editingDependencyId ? (
                <Button type="button" size="sm" variant="outline" onClick={resetDependencyForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Custos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(costs || []).length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhum custo registrado.
              </div>
            ) : (
              (costs || []).map((cost) => (
                <div
                  key={cost.id}
                  className={cn(
                    'atlas-item',
                    editingCostId === cost.id ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="atlas-item-title">{cost.categoryTitle ?? cost.category}</p>
                    <span className="atlas-badge bg-slate-500/10 text-slate-600 dark:text-slate-300">
                      {cost.type}
                    </span>
                  </div>
                  <p className="atlas-item-meta">
                    {formatCurrency(cost.amountCents)} • {cost.incurredAt ? formatDate(cost.incurredAt) : '—'}
                  </p>
                  {editingCostId === cost.id ? (
                    <span className="atlas-badge bg-amber-500/15 text-amber-700 dark:text-amber-200">Em edição</span>
                  ) : null}
                  <EntityEditDeleteActions
                    className="mt-2"
                    onEdit={() => {
                      setEditingCostId(cost.id);
                      setCostCategoryId(String(cost.categoryId));
                      setCostCategoryDetail(cost.categoryDetail?.trim() ? cost.categoryDetail : '');
                      setCostType(cost.type);
                      setCostAmount(String(cost.amountCents / 100));
                      setCostPhaseId(cost.phaseId ?? null);
                      setCostTaskId(cost.taskId ?? null);
                      setCostIncurredAt(cost.incurredAt ? formatInputDate(cost.incurredAt) : '');
                      setCostNotes(cost.notes || '');
                    }}
                    onDelete={() => setPendingDeleteCostId(cost.id)}
                  />
                </div>
              ))
            )}
            <ConfirmActionBanner
              open={Boolean(pendingDeleteCostId)}
              title="Confirmar exclusão de custo"
              message="Excluir este custo?"
              confirmLabel="Excluir custo"
              cancelLabel="Cancelar"
              onCancel={() => setPendingDeleteCostId(null)}
              onConfirm={async () => {
                if (!pendingDeleteCostId || !selectedProjectId) return;
                await fetch(`/api/projectus/costs?id=${pendingDeleteCostId}`, { method: 'DELETE' });
                setPendingDeleteCostId(null);
                if (editingCostId === pendingDeleteCostId) resetCostForm();
                await mutate(`/api/projectus/costs?projectId=${selectedProjectId}`);
              }}
            />
            <div
              className={cn(
                'flex flex-col gap-2 rounded-xl p-2',
                editingCostId ? 'border border-amber-300/70 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/10' : '',
              )}
            >
              {editingCostId ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Modo de edição ativo. Revise os campos e salve as alterações.</p>
              ) : null}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Categoria
                </label>
                <p className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-500">
                  Catálogo padronizado por equipa (melhor para relatórios). Em &quot;Outros&quot;, descreva o tipo de
                  despesa.
                </p>
                <Select
                  value={costCategoryId || '_none'}
                  onValueChange={(v) => {
                    setCostCategoryId(v === '_none' ? '' : v);
                    if (v !== '_none') {
                      const cat = (costCategories || []).find((c) => String(c.id) === v);
                      if (cat?.code !== 'OUTROS') setCostCategoryDetail('');
                    }
                  }}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Escolha a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Escolha a categoria</SelectItem>
                    {(costCategories || [])
                      .filter((c) => c.active)
                      .sort((a, b) => a.position - b.position || a.id - b.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCostCategory?.code === 'OUTROS' ? (
                <div>
                  <label
                    htmlFor="projectus-cost-outros-detail"
                    className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400"
                  >
                    Detalhe (obrigatório para &quot;Outros&quot;)
                  </label>
                  <input
                    id="projectus-cost-outros-detail"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Ex.: taxa de certificação pontual"
                    value={costCategoryDetail}
                    onChange={(event) => setCostCategoryDetail(event.target.value)}
                  />
                </div>
              ) : null}
              <input
                type="number"
                min={0}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Valor (R$)"
                value={costAmount}
                onChange={(event) => setCostAmount(event.target.value)}
              />
              <Select
                value={costType}
                onValueChange={(v) => setCostType(v as ProjectCostItem['type'])}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANEJADO">Planejado</SelectItem>
                  <SelectItem value="REAL">Real</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={costPhaseId ? String(costPhaseId) : '_none'}
                onValueChange={(v) =>
                  setCostPhaseId(v === '_none' ? null : Number(v))
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Fase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem fase</SelectItem>
                  {(phases || []).map((phase) => (
                    <SelectItem key={phase.id} value={String(phase.id)}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={costTaskId ? String(costTaskId) : '_none'}
                onValueChange={(v) =>
                  setCostTaskId(v === '_none' ? null : Number(v))
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Tarefa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem tarefa</SelectItem>
                  {(tasks || []).map((task) => (
                    <SelectItem key={task.id} value={String(task.id)}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="date"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={costIncurredAt}
                onChange={(event) => setCostIncurredAt(event.target.value)}
              />
              <input
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Notas"
                value={costNotes}
                onChange={(event) => setCostNotes(event.target.value)}
              />
              <button
                className="rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                disabled={
                  !selectedProjectId ||
                  !costCategoryId ||
                  !costAmount ||
                  (selectedCostCategory?.code === 'OUTROS' && !costCategoryDetail.trim())
                }
                onClick={async () => {
                  if (!selectedProjectId || !costCategoryId) return;
                  const amountCents = Math.round(Number(costAmount) * 100);
                  await fetch('/api/projectus/costs', {
                    method: editingCostId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ...(editingCostId ? { id: editingCostId } : {}),
                      projectId: selectedProjectId,
                      phaseId: costPhaseId,
                      taskId: costTaskId,
                      type: costType,
                      categoryId: Number(costCategoryId),
                      categoryDetail:
                        selectedCostCategory?.code === 'OUTROS' ? costCategoryDetail.trim() : null,
                      amountCents,
                      incurredAt: costIncurredAt || null,
                      notes: costNotes.trim() || null,
                    }),
                  });
                  resetCostForm();
                  await mutate(`/api/projectus/costs?projectId=${selectedProjectId}`);
                }}
              >
                {editingCostId ? 'Salvar custo' : 'Adicionar custo'}
              </button>
              {editingCostId ? (
                <Button type="button" size="sm" variant="outline" onClick={resetCostForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
            </>
          )}
        </>
      )}

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Use o Projectus para acompanhar cada etapa com clareza."
          tips={helpTips}
        />
      </div>
      </div>
    </section>
  );
}
