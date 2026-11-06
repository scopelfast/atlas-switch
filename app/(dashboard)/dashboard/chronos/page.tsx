'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock3, Focus, Users } from 'lucide-react';
import { ScriptumStatCard } from '@/components/scriptum/scriptum-stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleDashboardPageShell } from '@/components/ui/module-dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { Button } from '@/components/ui/button';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import { IntegrationImpactBanner } from '@/components/ui/integration-impact-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { hasPermission, isOwnerLike, type Role } from '@/lib/auth/permissions';

type AgendaItem = {
  id: number;
  date: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  title: string;
  description?: string | null;
  type: 'FOCO' | 'REUNIAO' | 'PESSOAL';
  location?: string | null;
  reminderMinutes?: number | null;
  recurrence?: string | null;
  timezone?: string | null;
  source?: string | null;
  status?: 'AGENDADO' | 'CONCLUIDO' | 'CANCELADO';
  /** M6.9 — espelho de prazo Taskflow. */
  taskflowTaskId?: number | null;
  reminderOffsetsMinutes?: number[];
  /** Reunify → Chronos: idempotência (uma linha por reunião). */
  reunifyMeetingId?: number | null;
  participantUserId?: number | null;
};

type CompactAgendaItem = {
  id: number;
  compactKey: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  title: string;
  type: AgendaItem['type'];
  source?: string | null;
  participantEntries: { id: number; participantUserId: number | null }[];
};

function sourceMeta(source?: string | null) {
  const normalized = (source || 'MANUAL').toUpperCase();
  if (normalized === 'TASKFLOW') {
    return { short: 'TF', label: 'Taskflow', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' };
  }
  if (normalized === 'REUNIFY') {
    return { short: 'RE', label: 'Reunify', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' };
  }
  if (normalized === 'PROJECTUS') {
    return { short: 'PJ', label: 'Projectus', className: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' };
  }
  return { short: 'MN', label: 'Manual', className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' };
}

function sourceEditHref(source?: string | null) {
  const normalized = (source || '').toUpperCase();
  if (normalized === 'REUNIFY') return '/dashboard/reunify';
  if (normalized === 'TASKFLOW') return '/dashboard/taskflow';
  if (normalized === 'PROJECTUS') return '/dashboard/projectus';
  return null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const text = await res.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    const message =
      (payload && typeof payload.error === 'string' && payload.error) ||
      `Falha ao carregar (${res.status})`;
    throw new Error(message);
  }
  return payload;
};

type MsCalendarEvent = {
  id: string;
  subject: string;
  startIso: string;
  endIso: string;
  isAllDay: boolean;
  location?: string | null;
};

async function msEventsFetcher(url: string): Promise<{
  events: MsCalendarEvent[];
  disclaimer: string;
}> {
  const res = await fetch(url);
  const j = (await res.json()) as {
    error?: string;
    events?: MsCalendarEvent[];
    disclaimer?: string;
  };
  if (!res.ok) {
    throw new Error(j.error || 'Erro ao carregar eventos Microsoft.');
  }
  return {
    events: Array.isArray(j.events) ? j.events : [],
    disclaimer: typeof j.disclaimer === 'string' ? j.disclaimer : '',
  };
}

async function gcalEventsFetcher(url: string): Promise<{
  events: MsCalendarEvent[];
  disclaimer: string;
}> {
  const res = await fetch(url);
  const j = (await res.json()) as {
    error?: string;
    events?: MsCalendarEvent[];
    disclaimer?: string;
  };
  if (!res.ok) {
    throw new Error(j.error || 'Erro ao carregar eventos Google.');
  }
  return {
    events: Array.isArray(j.events) ? j.events : [],
    disclaimer: typeof j.disclaimer === 'string' ? j.disclaimer : '',
  };
}

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const parseTimeToMinutes = (time?: string | null) => {
  if (!time) {
    return null;
  }
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const getDurationMinutes = (item: AgendaItem) => {
  if (typeof item.durationMinutes === 'number') {
    return item.durationMinutes;
  }
  const start = parseTimeToMinutes(item.startTime);
  const end = parseTimeToMinutes(item.endTime || '');
  if (start === null || end === null) {
    return 0;
  }
  return Math.max(0, end - start);
};

const getWeekRange = (dateStr: string) => {
  const base = new Date(`${dateStr}T00:00:00`);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + diff);
  const days = Array.from({ length: 7 }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    return formatDateInput(value);
  });
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    from: formatDateInput(start),
    to: formatDateInput(end),
    days,
  };
};

/**
 * Página avançada do módulo Chronos (agenda inteligente).
 */
export default function ChronosPage() {
  const router = useRouter();
  const { data: user } = useSWR<{ id?: number; role?: Role }>('/api/user', fetcher);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'chronos.view');

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'list' | 'timeline'>('day');
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const dateRange =
    viewMode === 'week' || viewMode === 'list'
      ? weekRange
      : { from: selectedDate, to: selectedDate, days: [selectedDate] };

  const { data: agenda, isLoading, mutate } = useSWR<AgendaItem[]>(
    `/api/chronos/agenda?from=${dateRange.from}&to=${dateRange.to}`,
    fetcher,
  );

  const { data: taskflowBoard } = useSWR<{
    board: { id: number };
    columns: { id: number; name: string }[];
  }>('/api/taskflow/boards', fetcher);
  const { data: team } = useSWR<{
    teamMembers?: { user: { id: number; name: string | null } }[];
  }>('/api/team', fetcher);

  const { data: reunifyMeetings } = useSWR<
    {
      id: number;
      date: string;
      startTime: string;
      endTime?: string | null;
      titulo: string;
      summary?: string | null;
      location?: string | null;
    }[]
  >(`/api/reunify/meetings?from=${dateRange.from}&to=${dateRange.to}`, fetcher);

  const msStatusKey = canView ? '/api/chronos/microsoft-graph/status' : null;
  const { data: msStatus, mutate: mutateMsStatus } = useSWR<{
    platformEnabled: boolean;
    linked: boolean;
    graphEmail: string | null;
    envReady: boolean;
  }>(msStatusKey, fetcher);

  const msEventsKey =
    canView && msStatus?.platformEnabled && msStatus?.linked
      ? `/api/chronos/microsoft-graph/events?from=${dateRange.from}&to=${dateRange.to}`
      : null;
  const { data: msEventsPayload, mutate: mutateMsEvents } = useSWR(msEventsKey, msEventsFetcher);

  const gcalStatusKey = canView ? '/api/chronos/google-calendar/status' : null;
  const { data: gcalStatus, mutate: mutateGcalStatus } = useSWR<{
    platformEnabled: boolean;
    linked: boolean;
    googleEmail: string | null;
    envReady: boolean;
  }>(gcalStatusKey, fetcher);

  const gcalEventsKey =
    canView && gcalStatus?.platformEnabled && gcalStatus?.linked
      ? `/api/chronos/google-calendar/events?from=${dateRange.from}&to=${dateRange.to}`
      : null;
  const { data: gcalEventsPayload, mutate: mutateGcalEvents } = useSWR(gcalEventsKey, gcalEventsFetcher);

  const [chronosOAuthBanner, setChronosOAuthBanner] = useState<string | null>(null);
  const [msDisconnectBusy, setMsDisconnectBusy] = useState(false);
  const [gcalDisconnectBusy, setGcalDisconnectBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  /** Atalho vindo do Reunify (e outros): `/dashboard/chronos?date=YYYY-MM-DD` */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const d = q.get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setSelectedDate(d);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const parts: string[] = [];
    const outlook = q.get('outlook');
    if (outlook === 'ligado') {
      parts.push('Microsoft 365: conta ligada com sucesso.');
    } else if (outlook === 'sem_permissao') {
      parts.push('Microsoft 365: sem permissão para ligar o calendário.');
    } else if (outlook === 'instancia_off') {
      parts.push('Microsoft 365: integração desligada nesta instância.');
    } else if (outlook === 'env') {
      parts.push('Microsoft 365: variáveis de ambiente em falta no servidor.');
    } else if (outlook === 'erro') {
      const msg = q.get('msg');
      parts.push(
        msg
          ? `Microsoft 365: ${decodeURIComponent(msg.replace(/\+/g, ' '))}`
          : 'Microsoft 365: não foi possível concluir a ligação.',
      );
    }
    const gcal = q.get('gcal');
    if (gcal === 'ligado') {
      parts.push('Google Calendar: conta ligada com sucesso.');
    } else if (gcal === 'sem_permissao') {
      parts.push('Google Calendar: sem permissão para ligar.');
    } else if (gcal === 'instancia_off') {
      parts.push('Google Calendar: integração desligada nesta instância.');
    } else if (gcal === 'env') {
      parts.push('Google Calendar: variáveis de ambiente em falta no servidor.');
    } else if (gcal === 'erro') {
      const msg = q.get('msg');
      parts.push(
        msg
          ? `Google Calendar: ${decodeURIComponent(msg.replace(/\+/g, ' '))}`
          : 'Google Calendar: não foi possível concluir a ligação.',
      );
    }
    if (parts.length === 0) return;
    setChronosOAuthBanner(parts.join(' '));
    router.replace('/dashboard/chronos');
    void mutateMsStatus();
    void mutateMsEvents();
    void mutateGcalStatus();
    void mutateGcalEvents();
    // OAuth devolve com navegação completa; executar uma vez ao montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [date, setDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('09:30');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AgendaItem['type']>('FOCO');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState('');
  const [recurrence, setRecurrence] = useState('NONE');
  const [status, setStatus] = useState<AgendaItem['status']>('AGENDADO');
  const [reunifyChronosImportMsg, setReunifyChronosImportMsg] = useState<string | null>(null);
  const [reunifyChronosImportBusyId, setReunifyChronosImportBusyId] = useState<number | null>(null);
  const [dedupeBusy, setDedupeBusy] = useState(false);
  const [participantFilter, setParticipantFilter] = useState<string>('ALL');
  const [selectedWeekCompactKey, setSelectedWeekCompactKey] = useState<string | null>(null);

  const agendaList = Array.isArray(agenda) ? agenda : [];
  const memberNameById = useMemo(() => {
    const map = new Map<number, string>();
    (team?.teamMembers || []).forEach((member) => {
      map.set(member.user.id, member.user.name || `Utilizador #${member.user.id}`);
    });
    return map;
  }, [team]);
  const filteredAgendaList = useMemo(() => {
    if (participantFilter === 'ALL') return agendaList;
    if (participantFilter === 'UNASSIGNED') {
      return agendaList.filter((item) => item.participantUserId == null);
    }
    const userId = Number(participantFilter);
    if (!Number.isInteger(userId) || userId <= 0) return agendaList;
    return agendaList.filter((item) => item.participantUserId === userId);
  }, [agendaList, participantFilter]);
  const reunifyIdsLinkedOnAgenda = useMemo(() => {
    const s = new Set<number>();
    agendaList.forEach((item) => {
      if (typeof item.reunifyMeetingId === 'number' && item.reunifyMeetingId > 0) {
        s.add(item.reunifyMeetingId);
      }
    });
    return s;
  }, [agendaList]);

  const agendaByDate = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    filteredAgendaList.forEach((item) => {
      const key = item.date;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(item);
    });
    map.forEach((items) => {
      items.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return map;
  }, [filteredAgendaList]);
  const compactAgendaByDate = useMemo(() => {
    const map = new Map<string, CompactAgendaItem[]>();
    const grouped = new Map<string, CompactAgendaItem>();
    filteredAgendaList.forEach((item) => {
      const key = [
        item.date,
        item.startTime || '',
        item.endTime || '',
        item.title || '',
        item.type || '',
        item.source || '',
      ].join('||');
      const existing = grouped.get(key);
      if (existing) {
        existing.participantEntries.push({
          id: item.id,
          participantUserId:
            typeof item.participantUserId === 'number' && item.participantUserId > 0
              ? item.participantUserId
              : null,
        });
        return;
      }
      grouped.set(key, {
        id: item.id,
        compactKey: key,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime || null,
        title: item.title,
        type: item.type,
        source: item.source,
        participantEntries: [
          {
            id: item.id,
            participantUserId:
              typeof item.participantUserId === 'number' && item.participantUserId > 0
                ? item.participantUserId
                : null,
          },
        ],
      });
    });
    grouped.forEach((entry) => {
      const arr = map.get(entry.date) ?? [];
      arr.push(entry);
      map.set(entry.date, arr);
    });
    map.forEach((items) => items.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [filteredAgendaList]);
  const selectedWeekCompactItem = useMemo(() => {
    if (!selectedWeekCompactKey) return null;
    for (const items of compactAgendaByDate.values()) {
      const found = items.find((item) => item.compactKey === selectedWeekCompactKey);
      if (found) return found;
    }
    return null;
  }, [selectedWeekCompactKey, compactAgendaByDate]);

  const stats = useMemo(() => {
    const total = filteredAgendaList.length;
    const focus = filteredAgendaList.filter((item) => item.type === 'FOCO').length;
    const meetings = filteredAgendaList.filter((item) => item.type === 'REUNIAO').length;
    const personal = filteredAgendaList.filter((item) => item.type === 'PESSOAL').length;
    const minutes = filteredAgendaList.reduce((sum, item) => sum + getDurationMinutes(item), 0);
    return { total, focus, meetings, personal, minutes };
  }, [filteredAgendaList]);

  const alerts = useMemo(() => {
    const messages: string[] = [];
    agendaByDate.forEach((items, key) => {
      if (items.length === 0) {
        return;
      }
      const overlaps = items.filter((item, index) => {
        if (index === 0) return false;
        const prev = items[index - 1];
        const prevEnd = parseTimeToMinutes(prev.endTime);
        const currentStart = parseTimeToMinutes(item.startTime);
        if (prevEnd === null || currentStart === null) {
          return false;
        }
        return prevEnd > currentStart;
      });
      if (overlaps.length > 0) {
        messages.push(`Há sobreposição de horários em ${key}.`);
      }
      const longFocus = items.some(
        (item) => item.type === 'FOCO' && getDurationMinutes(item) >= 120,
      );
      if (longFocus) {
        messages.push(`Blocos longos de foco em ${key}. Considere pausas.`);
      }
    });
    if (messages.length === 0) {
      messages.push('Nenhum alerta crítico identificado.');
    }
    return messages;
  }, [agendaByDate]);

  const helpTips =
    isOwnerLike(role)
      ? [
          'Defina blocos de foco de 60-90 minutos com pausas curtas.',
          'Use alertas para evitar sobreposição de reuniões.',
          'Revise semanalmente seus padrões de tempo.',
        ]
      : [
          'Mantenha suas prioridades visíveis no início do dia.',
          'Ajuste blocos de foco conforme sua energia.',
        ];

  if (user && !canView) {
    return (
      <ModuleDashboardPageShell>
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você não tem permissão para acessar o Chronos.
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

  const resetForm = () => {
    setEditingId(null);
    setDate(selectedDate);
    setStartTime('08:30');
    setEndTime('09:30');
    setTitle('');
    setType('FOCO');
    setDescription('');
    setLocation('');
    setReminderMinutes('');
    setRecurrence('NONE');
    setStatus('AGENDADO');
    setFormError(null);
  };

  const isTaskflowMirror = (item: AgendaItem) =>
    item.taskflowTaskId != null || item.source === 'TASKFLOW';
  const isSourceLocked = (item: AgendaItem) =>
    (item.source || '').toUpperCase() === 'TASKFLOW' ||
    (item.source || '').toUpperCase() === 'REUNIFY' ||
    (item.source || '').toUpperCase() === 'PROJECTUS';

  const sourceLockLabel = (item: AgendaItem) => {
    const source = (item.source || '').toUpperCase();
    if (source === 'TASKFLOW') return 'Editar no Taskflow';
    if (source === 'REUNIFY') return 'Editar no Reunify';
    if (source === 'PROJECTUS') return 'Editar no Projectus';
    return 'Editar na origem';
  };
  const sourceLockLabelBySource = (source?: string | null) => {
    const normalized = (source || '').toUpperCase();
    if (normalized === 'TASKFLOW') return 'Editar no Taskflow';
    if (normalized === 'REUNIFY') return 'Editar no Reunify';
    if (normalized === 'PROJECTUS') return 'Editar no Projectus';
    return 'Editar na origem';
  };

  const handleEdit = (item: AgendaItem) => {
    if (isSourceLocked(item)) {
      const source = sourceMeta(item.source).label;
      setFormError(
        `Este compromisso vem de ${source}; altere na origem para atualizar o Chronos.`,
      );
      return;
    }
    setEditingId(item.id);
    setDate(item.date);
    setStartTime(item.startTime);
    setEndTime(item.endTime || '');
    setTitle(item.title);
    setType(item.type);
    setDescription(item.description || '');
    setLocation(item.location || '');
    setReminderMinutes(item.reminderMinutes ? String(item.reminderMinutes) : '');
    setRecurrence(item.recurrence || 'NONE');
    setStatus(item.status || 'AGENDADO');
    setFormError(null);
  };

  const handleSave = async () => {
    if (!date || !startTime || !title.trim()) {
      setFormError('Informe data, horário inicial e título.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id: editingId,
        date,
        startTime,
        endTime: endTime || null,
        title: title.trim(),
        description: description.trim() || null,
        type,
        location: location.trim() || null,
        reminderMinutes: reminderMinutes ? Number(reminderMinutes) : null,
        recurrence,
        timezone: 'America/Sao_Paulo',
        source: 'MANUAL',
        status,
      };

      const response = await fetch('/api/chronos/agenda', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Erro ao salvar compromisso');
      }

      await mutate();
      resetForm();
    } catch (error: any) {
      setFormError(error?.message || 'Erro ao salvar compromisso');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmState({
      title: 'Confirmar exclusão',
      message: 'Deseja remover este compromisso?',
      onConfirm: async () => {
        await fetch(`/api/chronos/agenda?id=${id}`, { method: 'DELETE' });
        await mutate();
        setConfirmState(null);
      },
    });
  };

  const renderAgendaItemActions = (item: AgendaItem) => (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {!isSourceLocked(item) ? (
        <button
          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300"
          onClick={() => handleEdit(item)}
        >
          Editar
        </button>
      ) : (
        <>
          {sourceEditHref(item.source) ? (
            <Link
              href={sourceEditHref(item.source)!}
              className="rounded-full border border-sky-200 px-3 py-1 text-xs text-sky-600 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-950/30"
            >
              {sourceLockLabel(item)}
            </Link>
          ) : (
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
              {sourceLockLabel(item)}
            </span>
          )}
        </>
      )}
      {taskflowBoard?.board?.id &&
      taskflowBoard?.columns?.length &&
      user?.id &&
      !isSourceLocked(item) ? (
        <button
          className="rounded-full border border-indigo-200 px-3 py-1 text-xs text-indigo-600 dark:border-indigo-500/40 dark:text-indigo-300"
          onClick={async () => {
            const progressCol = taskflowBoard.columns.find((c) => /progresso/i.test(c.name));
            const colId = progressCol?.id ?? taskflowBoard.columns[0]?.id;
            if (!colId) return;
            const dueStr = `${item.date}T${item.endTime || item.startTime}:00`;
            await fetch('/api/taskflow/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                boardId: taskflowBoard.board.id,
                columnId: colId,
                title: item.title,
                dueDate: dueStr,
                assigneeId: user.id,
                taskType: 'meeting_action',
              }),
            });
          }}
        >
          Criar no Taskflow
        </button>
      ) : null}
      <button
        className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 dark:border-rose-500/40 dark:text-rose-300"
        onClick={() => handleDelete(item.id)}
      >
        Remover do Chronos
      </button>
    </div>
  );

  return (
    <ModuleDashboardPageShell>
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="Chronos"
            description="Agenda inteligente com time-blocking, alertas e analytics de tempo."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/chronos">Manual</Link>
          </Button>
        </div>
      </div>

      {chronosOAuthBanner ? (
        <div className="mt-4 rounded-xl border border-indigo-200/80 bg-indigo-50/90 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-100">
          {chronosOAuthBanner}
        </div>
      ) : null}
      <div className="mt-4">
        <ConfirmActionBanner
          open={Boolean(confirmState)}
          title={confirmState?.title || 'Confirmar ação'}
          message={confirmState?.message || ''}
          confirmLabel="Confirmar"
          cancelLabel="Cancelar"
          onCancel={() => setConfirmState(null)}
          onConfirm={async () => {
            await confirmState?.onConfirm();
          }}
        />
      </div>

      <Card className="atlas-surface atlas-hover mt-6 border-slate-200/90 dark:border-slate-700/80">
        <CardHeader className="gap-1 pb-2">
          <CardTitle className="text-base">Microsoft 365 (Outlook)</CardTitle>
          <CardDescription>
            Pré-visualização só leitura do calendário ligado à sua conta. Não altera compromissos Chronos nem o
            espelho Taskflow e não grava eventos na agenda Atlas automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          {!msStatus ? (
            <p className="text-xs text-slate-500">A carregar estado…</p>
          ) : !msStatus.platformEnabled ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              A integração Microsoft Graph está desligada nesta instância (Centro de Controlo → Integrações
              globais).
            </p>
          ) : !msStatus.envReady ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              A equipa de infraestrutura ainda não definiu MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET /
              MICROSOFT_REDIRECT_URI no servidor.
            </p>
          ) : msStatus.linked ? (
            <div className="space-y-2">
              <p className="text-xs">
                Ligado como <span className="font-medium">{msStatus.graphEmail || 'conta Microsoft'}</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-lg">
                  <a href="/api/chronos/microsoft-graph/oauth-start">Renovar ligação</a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={msDisconnectBusy}
                  onClick={async () => {
                    setConfirmState({
                      title: 'Confirmar remoção',
                      message: 'Remover ligação Microsoft 365 deste utilizador?',
                      onConfirm: async () => {
                        setMsDisconnectBusy(true);
                        try {
                          const res = await fetch('/api/chronos/microsoft-graph/link', { method: 'DELETE' });
                          if (!res.ok) {
                            const j = (await res.json().catch(() => ({}))) as { error?: string };
                            throw new Error(j.error || 'Erro');
                          }
                          await mutateMsStatus();
                          await mutateMsEvents();
                          setConfirmState(null);
                        } catch (e) {
                          console.error(e);
                          alert(e instanceof Error ? e.message : 'Erro');
                        } finally {
                          setMsDisconnectBusy(false);
                        }
                      },
                    });
                  }}
                >
                  Desligar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Ligue a sua conta para ver eventos do Outlook na janela da agenda (abaixo), sem gravar no Chronos.
              </p>
              <Button asChild size="sm" className="rounded-lg">
                <a href="/api/chronos/microsoft-graph/oauth-start">Ligar Microsoft 365</a>
              </Button>
            </div>
          )}
          {msStatus?.platformEnabled && msStatus?.linked && msEventsPayload?.events ? (
            <div className="border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{msEventsPayload.disclaimer}</p>
              {msEventsPayload.events.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Nenhum evento Microsoft neste intervalo.</p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
                  {msEventsPayload.events.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950/50"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-100">{ev.subject}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {ev.isAllDay ? 'Dia inteiro · ' : null}
                        {new Date(ev.startIso).toLocaleString('pt-BR')} → {new Date(ev.endIso).toLocaleString('pt-BR')}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="atlas-surface atlas-hover mt-6 border-slate-200/90 dark:border-slate-700/80">
        <CardHeader className="gap-1 pb-2">
          <CardTitle className="text-base">Google Calendar</CardTitle>
          <CardDescription>
            Pré-visualização só leitura do calendário principal da conta Google ligada. Não altera compromissos
            Chronos nem o espelho Taskflow e não grava eventos na agenda Atlas automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          {!gcalStatus ? (
            <p className="text-xs text-slate-500">A carregar estado…</p>
          ) : !gcalStatus.platformEnabled ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              A integração Google Calendar está desligada nesta instância (Centro de Controlo → Integrações
              globais).
            </p>
          ) : !gcalStatus.envReady ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              A equipa de infraestrutura ainda não definiu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
              no servidor.
            </p>
          ) : gcalStatus.linked ? (
            <div className="space-y-2">
              <p className="text-xs">
                Ligado como <span className="font-medium">{gcalStatus.googleEmail || 'conta Google'}</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-lg">
                  <a href="/api/chronos/google-calendar/oauth-start">Renovar ligação</a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={gcalDisconnectBusy}
                  onClick={async () => {
                    setConfirmState({
                      title: 'Confirmar remoção',
                      message: 'Remover ligação Google Calendar deste utilizador?',
                      onConfirm: async () => {
                        setGcalDisconnectBusy(true);
                        try {
                          const res = await fetch('/api/chronos/google-calendar/link', { method: 'DELETE' });
                          if (!res.ok) {
                            const j = (await res.json().catch(() => ({}))) as { error?: string };
                            throw new Error(j.error || 'Erro');
                          }
                          await mutateGcalStatus();
                          await mutateGcalEvents();
                          setConfirmState(null);
                        } catch (e) {
                          console.error(e);
                          alert(e instanceof Error ? e.message : 'Erro');
                        } finally {
                          setGcalDisconnectBusy(false);
                        }
                      },
                    });
                  }}
                >
                  Desligar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Ligue a sua conta para ver eventos do Google Calendar na janela da agenda (abaixo), sem gravar no
                Chronos.
              </p>
              <Button asChild size="sm" className="rounded-lg">
                <a href="/api/chronos/google-calendar/oauth-start">Ligar Google Calendar</a>
              </Button>
            </div>
          )}
          {gcalStatus?.platformEnabled && gcalStatus?.linked && gcalEventsPayload?.events ? (
            <div className="border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{gcalEventsPayload.disclaimer}</p>
              {gcalEventsPayload.events.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Nenhum evento Google neste intervalo.</p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
                  {gcalEventsPayload.events.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950/50"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-100">{ev.subject}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {ev.isAllDay ? 'Dia inteiro · ' : null}
                        {new Date(ev.startIso).toLocaleString('pt-BR')} → {new Date(ev.endIso).toLocaleString('pt-BR')}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScriptumStatCard
          variant="violet"
          icon={CalendarDays}
          title="Total de compromissos"
          description="Itens na janela atual da agenda"
          value={stats.total}
          footnote="Dia / semana conforme o modo ativo"
        />
        <ScriptumStatCard
          variant="emerald"
          icon={Focus}
          title="Blocos de foco"
          description="Compromissos do tipo FOCO"
          value={stats.focus}
          footnote="Ajuda a medir tempo de execução"
        />
        <ScriptumStatCard
          variant="indigo"
          icon={Users}
          title="Reuniões"
          description="Compromissos do tipo REUNIAO"
          value={stats.meetings}
          footnote="Inclui origem manual e integrada"
        />
        <ScriptumStatCard
          variant="sky"
          icon={Clock3}
          title="Tempo alocado"
          description="Soma de duração dos itens visíveis"
          value={`${stats.minutes} min`}
          footnote="Base para alertas contextuais"
        />
      </div>

      <Card className="atlas-surface atlas-hover mt-6">
        <CardHeader className="gap-1 pb-2">
          <CardTitle>Filtros da agenda</CardTitle>
          <CardDescription>Ajuste vista, data base e alocação sem sair da área de trabalho.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center rounded-full border border-slate-200 bg-white px-1 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950/60">
            {(['day', 'week', 'list', 'timeline'] as const).map((mode) => (
              <button
                key={mode}
                className={`rounded-full px-4 py-1.5 ${
                  viewMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-300'
                }`}
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
              >
                {mode === 'day' && 'Dia'}
                {mode === 'week' && 'Semana'}
                {mode === 'list' && 'Lista'}
                {mode === 'timeline' && 'Timeline'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span>Data base</span>
              <input
                type="date"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setDate(event.target.value);
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2 lg:col-span-2">
              <span>Alocação</span>
              <Select value={participantFilter} onValueChange={setParticipantFilter}>
                <SelectTrigger className="h-10 w-full rounded-2xl">
                  <SelectValue placeholder="Filtrar por alocação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="UNASSIGNED">Sem alocação</SelectItem>
                  {(team?.teamMembers || []).map((member) => (
                    <SelectItem key={`chronos-filter-member-${member.user.id}`} value={String(member.user.id)}>
                      {member.user.name || `Utilizador #${member.user.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Agenda</CardTitle>
            <CardDescription className="text-xs">
              Itens com origem Manual editam no Chronos; itens de Reunify, Taskflow ou Projectus devem ser alterados no
              módulo de origem para manter sincronização.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <IntegrationImpactBanner
              message="Impacto desta ação: o Chronos consolida agenda, mas respeita o módulo dono do dado para edição."
              tone="info"
            />
            {isLoading && (
              <div className="atlas-item text-sm text-slate-500 dark:text-slate-300">
                Carregando agenda...
              </div>
            )}
            {!isLoading && filteredAgendaList.length === 0 && (
              <div className="atlas-item text-sm text-slate-500 dark:text-slate-300">
                Nenhum compromisso encontrado para o filtro selecionado.
              </div>
            )}

            {viewMode === 'day' && (
              <div className="flex flex-col gap-3">
                {(agendaByDate.get(selectedDate) || []).map((item) => (
                  <div key={item.id} className="atlas-item flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="atlas-item-meta">
                          {item.startTime} {item.endTime ? `- ${item.endTime}` : ''}
                        </p>
                        <p className="atlas-item-title">{item.title}</p>
                        {isTaskflowMirror(item) && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Sincronizado com Taskflow
                            {item.reminderOffsetsMinutes && item.reminderOffsetsMinutes.length > 0
                              ? ` · lembretes (min antes): ${item.reminderOffsetsMinutes.join(', ')}`
                              : ''}
                          </p>
                        )}
                        {item.location && (
                          <p className="text-xs text-slate-400">Local: {item.location}</p>
                        )}
                        {item.participantUserId ? (
                          <p className="text-xs text-slate-400">
                            Alocado: {memberNameById.get(item.participantUserId) || `Utilizador #${item.participantUserId}`}
                          </p>
                        ) : null}
                      </div>
                      <span className="atlas-badge bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                        {item.type}
                        {isTaskflowMirror(item) ? ' · TF' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                      <span>Status: {item.status}</span>
                      <span>•</span>
                      <span>Duração: {getDurationMinutes(item)} min</span>
                      <span>•</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sourceMeta(item.source).className}`}>
                        Origem: {sourceMeta(item.source).label}
                      </span>
                    </div>
                    {renderAgendaItemActions(item)}
                  </div>
                ))}
              </div>
            )}

            {viewMode === 'week' && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                  {weekRange.days.map((day) => (
                    <div key={day} className="rounded-2xl border border-dashed border-slate-200 p-2">
                      <p className="text-xs font-semibold text-slate-500">{day}</p>
                      <div className="mt-2 flex flex-col gap-2">
                        {(compactAgendaByDate.get(day) || []).map((item) => {
                          const allocatedCount = item.participantEntries.filter((e) => e.participantUserId != null).length;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className="atlas-item text-left"
                              onClick={() => setSelectedWeekCompactKey(item.compactKey)}
                            >
                              <p className="atlas-item-meta">
                                {item.startTime} {item.endTime ? `- ${item.endTime}` : ''}
                              </p>
                              <p className="atlas-item-title">{item.title}</p>
                              <p className="text-[11px] text-slate-400">
                                {allocatedCount > 0
                                  ? allocatedCount > 1
                                    ? `${allocatedCount} alocados`
                                    : '1 alocado'
                                  : 'Sem alocação'}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedWeekCompactItem ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {selectedWeekCompactItem.title} · {selectedWeekCompactItem.startTime}
                        {selectedWeekCompactItem.endTime ? `-${selectedWeekCompactItem.endTime}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Origem: {sourceMeta(selectedWeekCompactItem.source).label}
                      </p>
                    </div>
                    <div className="mt-2 space-y-2">
                      {selectedWeekCompactItem.participantEntries.map((entry) => (
                        <div
                          key={`week-entry-${entry.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white/70 px-2 py-1.5 dark:border-slate-700/70 dark:bg-slate-900/40"
                        >
                          <p className="text-xs text-slate-700 dark:text-slate-200">
                            Alocado:{' '}
                            {entry.participantUserId
                              ? memberNameById.get(entry.participantUserId) || `Utilizador #${entry.participantUserId}`
                              : 'Sem alocação'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {sourceEditHref(selectedWeekCompactItem.source) ? (
                              <Link
                                href={sourceEditHref(selectedWeekCompactItem.source)!}
                                className="rounded-full border border-sky-200 px-2 py-1 text-[11px] text-sky-600 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-950/30"
                              >
                                {sourceLockLabelBySource(selectedWeekCompactItem.source)}
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-full border border-rose-200 px-2 py-1 text-[11px] text-rose-600 dark:border-rose-500/40 dark:text-rose-300"
                              onClick={() => handleDelete(entry.id)}
                            >
                              Remover do Chronos
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {viewMode === 'list' && (
              <div className="flex flex-col gap-4">
                {weekRange.days.map((day) => (
                  <div key={day}>
                    <p className="text-xs font-semibold text-slate-500">{day}</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {(agendaByDate.get(day) || []).map((item) => (
                        <div key={item.id} className="atlas-item">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="atlas-item-meta">
                                {item.startTime} {item.endTime ? `- ${item.endTime}` : ''}
                              </p>
                              <p className="atlas-item-title">{item.title}</p>
                              {item.participantUserId ? (
                                <p className="text-[11px] text-slate-400">
                                  Alocado: {memberNameById.get(item.participantUserId) || `Utilizador #${item.participantUserId}`}
                                </p>
                              ) : null}
                            </div>
                            <span className="atlas-badge bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                              {item.type}
                            </span>
                          </div>
                          {renderAgendaItemActions(item)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewMode === 'timeline' && (
              <div className="flex flex-col gap-3">
                {(agendaByDate.get(selectedDate) || []).map((item) => (
                  <div key={item.id} className="atlas-item">
                    <p className="atlas-item-meta">
                      {item.startTime} {item.endTime ? `- ${item.endTime}` : ''}
                    </p>
                    <p className="atlas-item-title">{item.title}</p>
                    {item.participantUserId ? (
                      <p className="text-[11px] text-slate-400">
                        Alocado: {memberNameById.get(item.participantUserId) || `Utilizador #${item.participantUserId}`}
                      </p>
                    ) : null}
                    {item.description && (
                      <p className="text-xs text-slate-500">{item.description}</p>
                    )}
                    {renderAgendaItemActions(item)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>{editingId ? 'Editar compromisso' : 'Novo compromisso'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Data
                </label>
                <input
                  type="date"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Tipo
                </label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as AgendaItem['type'])}
                >
                  <SelectTrigger className="mt-2 rounded-2xl">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOCO">FOCO</SelectItem>
                    <SelectItem value="REUNIAO">REUNIAO</SelectItem>
                    <SelectItem value="PESSOAL">PESSOAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Início
                </label>
                <input
                  type="time"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Fim
                </label>
                <input
                  type="time"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Título
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Bloco de foco"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Descrição
              </label>
              <textarea
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Local
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Lembrete (min)
                </label>
                <input
                  type="number"
                  min={0}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  value={reminderMinutes}
                  onChange={(event) => setReminderMinutes(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Recorrência
                </label>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger className="mt-2 rounded-2xl">
                    <SelectValue placeholder="Recorrência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Nenhuma</SelectItem>
                    <SelectItem value="DAILY">Diária</SelectItem>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Status
                </label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as AgendaItem['status'])}
                >
                  <SelectTrigger className="mt-2 rounded-2xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AGENDADO">Agendado</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formError && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {formError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
                disabled={isSaving}
                onClick={handleSave}
              >
                {isSaving ? 'Salvando...' : editingId ? 'Salvar' : 'Adicionar'}
              </button>
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300"
                onClick={resetForm}
              >
                Limpar
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Reuniões do Reunify</CardTitle>
            <CardDescription className="text-xs">
              Cada reunião liga no máximo a <strong className="font-medium">um</strong> compromisso Chronos (evita
              duplicar ao clicar várias vezes). Linhas repetidas antigas podem ser removidas com «Excluir» na lista da
              agenda.
            </CardDescription>
            {isOwnerLike(role) ? (
              <div className="pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={dedupeBusy}
                  onClick={async () => {
                    setDedupeBusy(true);
                    setReunifyChronosImportMsg(null);
                    try {
                      const res = await fetch('/api/chronos/agenda/dedupe-reunify', { method: 'POST' });
                      const data = (await res.json().catch(() => ({}))) as {
                        error?: string;
                        removed?: number;
                        kept?: number;
                      };
                      if (!res.ok) {
                        setReunifyChronosImportMsg(`Erro ao deduplicar: ${data.error || res.statusText}`);
                        return;
                      }
                      setReunifyChronosImportMsg(
                        `Deduplicação concluída: ${data.removed ?? 0} removido(s), ${data.kept ?? 0} mantido(s).`,
                      );
                      await mutate();
                    } catch (e) {
                      setReunifyChronosImportMsg(
                        e instanceof Error ? `Erro ao deduplicar: ${e.message}` : 'Erro de rede.',
                      );
                    } finally {
                      setDedupeBusy(false);
                    }
                  }}
                >
                  {dedupeBusy ? 'Deduplicando…' : 'Deduplicar Reunify na agenda'}
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            {reunifyChronosImportMsg ? (
              <IntegrationImpactBanner
                message={reunifyChronosImportMsg}
                tone={reunifyChronosImportMsg.startsWith('Erro') ? 'error' : 'success'}
              />
            ) : null}
            {(reunifyMeetings || []).length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma reunião do Reunify no período selecionado.
              </div>
            ) : (
              (reunifyMeetings || []).map((m) => (
                <div key={m.id} className="atlas-item flex items-center justify-between gap-2">
                  <div>
                    <p className="atlas-item-meta">
                      {m.startTime} {m.endTime ? `- ${m.endTime}` : ''}
                    </p>
                    <p className="atlas-item-title">{m.titulo}</p>
                  </div>
                  <button
                    type="button"
                    disabled={reunifyIdsLinkedOnAgenda.has(m.id) || reunifyChronosImportBusyId === m.id}
                    className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={async () => {
                      setReunifyChronosImportMsg(null);
                      setReunifyChronosImportBusyId(m.id);
                      try {
                        const res = await fetch('/api/chronos/agenda', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            date: m.date,
                            startTime: m.startTime,
                            endTime: m.endTime || null,
                            title: m.titulo,
                            type: 'REUNIAO',
                            description: m.summary || null,
                            location: m.location?.trim() || null,
                            source: 'REUNIFY',
                            reunifyMeetingId: m.id,
                          }),
                        });
                        const data = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          id?: number;
                          idempotent?: boolean;
                        };
                        if (!res.ok) {
                          setReunifyChronosImportMsg(`Erro: ${data.error || res.statusText || 'Pedido falhou'}`);
                          return;
                        }
                        setReunifyChronosImportMsg(
                          data.idempotent
                            ? 'Ação concluída: reunião do Reunify já sincronizada no Chronos (sem duplicação).'
                            : `Ação concluída: reunião do Reunify enviada ao Chronos (compromisso #${
                                typeof data.id === 'number' ? data.id : '—'
                              }).`,
                        );
                        await mutate();
                      } catch (e) {
                        setReunifyChronosImportMsg(
                          e instanceof Error ? `Erro: ${e.message}` : 'Erro de rede ou servidor.',
                        );
                      } finally {
                        setReunifyChronosImportBusyId(null);
                      }
                    }}
                  >
                    {reunifyChronosImportBusyId === m.id
                      ? 'A adicionar…'
                      : reunifyIdsLinkedOnAgenda.has(m.id)
                        ? 'Já na agenda'
                        : 'Adicionar ao Chronos'}
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Alertas contextuais</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            {alerts.map((message) => (
              <div key={message} className="atlas-item">
                {message}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Resumo semanal</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span>Foco</span>
              <span className="font-semibold">{stats.focus}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Reuniões</span>
              <span className="font-semibold">{stats.meetings}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pessoal</span>
              <span className="font-semibold">{stats.personal}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Use o Chronos para planejar blocos de foco e compromissos críticos."
          tips={helpTips}
        />
      </div>
    </ModuleDashboardPageShell>
  );
}
