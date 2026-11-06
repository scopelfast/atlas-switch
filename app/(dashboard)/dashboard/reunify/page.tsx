'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import {
  AlertOctagon,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Mic,
} from 'lucide-react';
import { ScriptumStatCard } from '@/components/scriptum/scriptum-stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpPanel } from '@/components/ui/help-panel';
import { useFloatingFeedback } from '@/components/ui/floating-feedback';
import { ModuleHeader } from '@/components/ui/module-header';
import {
  ModuleWorkspaceHub,
  moduleWorkspaceHubLinkClassName,
} from '@/components/ui/module-workspace-hub';
import {
  ModuleSegmentedTabs,
  type ModuleSegmentedTabsItem,
} from '@/components/ui/module-segmented-tabs';
import {
  canConfigureTaskflowBoard,
  hasPermission,
  isOwnerLike,
  normalizeRole,
  type Role,
} from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import { IntegrationImpactBanner } from '@/components/ui/integration-impact-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DEFAULT_REUNIFY_REASON_CATALOG } from '@/lib/reunify/reason-catalog';
import { ACTION_COPY, actionDeleteOutlineClassName } from '@/lib/ui/action-copy';

type Reuniao = {
  id: number;
  date: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  titulo: string;
  status: 'AGENDADA' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';
  cancelReason?: string | null;
  canceledAt?: string | null;
  canceledByUserId?: number | null;
  rescheduledFromMeetingId?: number | null;
  location?: string | null;
  summary?: string | null;
  participantUserIds?: number[];
  participantCount?: number;
};

type AgendaItem = {
  id: number;
  meetingId: number;
  title: string;
  owner?: string | null;
  durationMinutes?: number | null;
  status: 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO';
  position: number;
};

type Decision = {
  id: number;
  meetingId: number;
  title: string;
  owner?: string | null;
  decidedAt?: string | null;
};

type ActionItem = {
  id: number;
  meetingId: number;
  title: string;
  ownerId?: number | null;
  dueDate?: string | null;
  status: 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO';
  notes?: string | null;
  /** M6.11 — tarefa Taskflow associada (export idempotente). */
  taskflowTaskId?: number | null;
};

type MeetingHistoryEntry = {
  id: number;
  meetingId: number;
  actionType: string;
  payload: string | null;
  performedByUserId: number | null;
  createdAt: string;
};

function composeLifecycleReason(category: string, detail: string) {
  const safeCategory = category.trim();
  const safeDetail = detail.trim();
  if (!safeDetail) return safeCategory;
  return `${safeCategory} - ${safeDetail}`;
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

const MEETINGS_TEAM_KEY = '/api/reunify/meetings?scope=team';
type ReunifyMainTab = 'agenda' | 'reuniao' | 'integracoes';

type ReunifyAgendaViewMode = 'day' | 'week' | 'list';

const REUNIFY_MAIN_TAB_ITEMS: readonly ModuleSegmentedTabsItem<ReunifyMainTab>[] = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'integracoes', label: 'Integrações' },
];

const REUNIFY_AGENDA_VIEW_ITEMS: readonly ModuleSegmentedTabsItem<ReunifyAgendaViewMode>[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'list', label: 'Lista' },
];

/** YYYY-MM-DD no fuso local (evita desvio de `toISOString()` em fusos positivos). */
const formatDateInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateInputLocal = (dateStr: string) => {
  const [y, mo, da] = dateStr.split('-').map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) {
    return new Date(NaN);
  }
  return new Date(y, mo - 1, da);
};

const addDaysToDateInput = (dateStr: string, deltaDays: number) => {
  const base = parseDateInputLocal(dateStr);
  if (Number.isNaN(base.getTime())) return dateStr;
  base.setDate(base.getDate() + deltaDays);
  return formatDateInput(base);
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDateInputLocal(value).toLocaleDateString('pt-BR');
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('pt-BR');
};

const getWeekRange = (dateStr: string) => {
  const base = parseDateInputLocal(dateStr);
  const day = base.getDay();
  const diff = -day;
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

const shortWeekdayLabel = (dateStr: string) => {
  const d = parseDateInputLocal(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const labels = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  return labels[d.getDay()] || '';
};

const getMeetingStatusMeta = (status: Reuniao['status']) => {
  switch (status) {
    case 'FINALIZADA':
      return {
        label: 'Finalizada',
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        markerClass: 'bg-emerald-500',
      };
    case 'CANCELADA':
      return {
        label: 'Cancelada',
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
        markerClass: 'bg-rose-500',
      };
    case 'EM_ANDAMENTO':
      return {
        label: 'Em andamento',
        badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
        markerClass: 'bg-sky-500',
      };
    case 'AGENDADA':
    default:
      return {
        label: 'Agendada',
        badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
        markerClass: 'bg-slate-500',
      };
  }
};

function extensionForAudioMime(mime: string): string {
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('mp4')) return '.m4a';
  if (mime.includes('webm')) return '.webm';
  return '.webm';
}

function pickAudioMimeTypeForRecorder(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'audio/webm';
}

/**
 * Pagina avancada do modulo Reunify (reunioes inteligentes).
 */
export default function ReunifyPage() {
  const toast = useFloatingFeedback();
  const { data: user } = useSWR<{ id?: number; role?: Role }>('/api/user', fetcher);
  const { data: team } = useSWR<{
    teamMembers?: { user: { id: number; name: string | null } }[];
    reunifyTranscriptDraftEnabled?: boolean;
    reunifyAsrProvider?: 'none' | 'assemblyai' | 'vosk';
  }>('/api/team', fetcher);
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'reunify.view');
  const canExportToTaskflow = hasPermission(role, 'taskflow.view');
  const canCreateChronosFromReunify = hasPermission(role, 'chronos.view');
  const canTeamReunifyDraftOptIn = canConfigureTaskflowBoard(normalizeRole(role));
  const transcriptDraftEnabled = Boolean(team?.reunifyTranscriptDraftEnabled);
  const [taskflowExportMessage, setTaskflowExportMessage] = useState<string | null>(null);
  const [reunifyChronosFeedback, setReunifyChronosFeedback] = useState<string | null>(null);
  const [reunifyChronosBusy, setReunifyChronosBusy] = useState(false);

  const [mainTab, setMainTab] = useState<ReunifyMainTab>('agenda');

  const [viewMode, setViewMode] = useState<ReunifyAgendaViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const dateRange =
    viewMode === 'week' || viewMode === 'list'
      ? weekRange
      : { from: selectedDate, to: selectedDate, days: [selectedDate] };

  const { data: allMeetings, isLoading } = useSWR<Reuniao[]>(MEETINGS_TEAM_KEY, fetcher);

  const meetingsInRange = useMemo(() => {
    const list = allMeetings || [];
    return list.filter((m) => m.date >= dateRange.from && m.date <= dateRange.to);
  }, [allMeetings, dateRange.from, dateRange.to]);

  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);

  useEffect(() => {
    const list = allMeetings || [];
    if (!list.length) {
      if (selectedMeetingId != null) setSelectedMeetingId(null);
      return;
    }
    if (selectedMeetingId == null) {
      return;
    }
    if (selectedMeetingId != null && list.some((m) => m.id === selectedMeetingId)) {
      return;
    }
    setSelectedMeetingId(null);
  }, [allMeetings, selectedMeetingId]);

  const { data: agendaItems } = useSWR<AgendaItem[]>(
    selectedMeetingId ? `/api/reunify/agenda-items?meetingId=${selectedMeetingId}` : null,
    fetcher,
  );
  const { data: decisions } = useSWR<Decision[]>(
    selectedMeetingId ? `/api/reunify/decisions?meetingId=${selectedMeetingId}` : null,
    fetcher,
  );
  const { data: actionItems } = useSWR<ActionItem[]>(
    selectedMeetingId ? `/api/reunify/action-items?meetingId=${selectedMeetingId}` : null,
    fetcher,
  );
  const { data: reasonCatalog } = useSWR<{
    CANCEL: { code: string; label: string }[];
    RESCHEDULE: { code: string; label: string }[];
  }>('/api/reunify/reason-catalog', fetcher);
  const { data: meetingHistory, mutate: mutateMeetingHistory } = useSWR<MeetingHistoryEntry[]>(
    selectedMeetingId ? `/api/reunify/meetings/history?meetingId=${selectedMeetingId}` : null,
    fetcher,
  );

  type MeetingCapture = {
    id: number;
    kind: string;
    externalUrl: string | null;
    originalName: string;
    mimeType: string | null;
    sizeBytes: number;
    createdById: number | null;
    createdAt: string;
  };
  const capturesKey =
    canView && selectedMeetingId ? `/api/reunify/meetings/${selectedMeetingId}/captures` : null;
  const { data: capturesPayload, mutate: mutateCaptures } = useSWR<{ captures: MeetingCapture[] }>(
    capturesKey,
    fetcher,
  );

  const meetingByDate = useMemo(() => {
    const map = new Map<string, Reuniao[]>();
    meetingsInRange.forEach((meeting) => {
      if (!map.has(meeting.date)) {
        map.set(meeting.date, []);
      }
      map.get(meeting.date)?.push(meeting);
    });
    map.forEach((items) => items.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [meetingsInRange]);

  const selectedMeeting = allMeetings?.find((meeting) => meeting.id === selectedMeetingId);
  const meetingsOnSelectedDate = meetingByDate.get(selectedDate) || [];
  const nextMeetingsForSelectedDate = useMemo(() => {
    return (allMeetings || [])
      .filter((meeting) => meeting.date > selectedDate)
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
      })
      .slice(0, 3);
  }, [allMeetings, selectedDate]);

  const metrics = useMemo(() => {
    const total = meetingsInRange.length;
    const concluded = meetingsInRange.filter((meeting) => meeting.status === 'FINALIZADA').length;
    const actions = actionItems?.length || 0;
    const actionsOpen = (actionItems || []).filter((action) => action.status !== 'CONCLUIDO')
      .length;
    return { total, concluded, actions, actionsOpen };
  }, [meetingsInRange, actionItems]);

  const teamMeetingCount = allMeetings?.length ?? 0;
  const REUNIFY_SELECT_NONE = '__reunify_none__';
  const stickyMeetingSelectValue = useMemo(() => {
    if (isLoading || !teamMeetingCount) return REUNIFY_SELECT_NONE;
    if (selectedMeetingId != null && (allMeetings || []).some((m) => m.id === selectedMeetingId)) {
      return String(selectedMeetingId);
    }
    return REUNIFY_SELECT_NONE;
  }, [isLoading, teamMeetingCount, allMeetings, selectedMeetingId]);

  const helpTips =
    isOwnerLike(role)
      ? [
          'Estruture a pauta antes de iniciar a reunião.',
          'Transforme decisões em ações e acompanhe prazos.',
        ]
      : [
          'Registre responsáveis e prazos nas ações.',
          'Finalize a ata logo após o encontro.',
        ];

  const [meetingDate, setMeetingDate] = useState(selectedDate);
  const [meetingStartTime, setMeetingStartTime] = useState('09:00');
  const [meetingEndTime, setMeetingEndTime] = useState('10:00');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStatus, setMeetingStatus] = useState<Reuniao['status']>('AGENDADA');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingSummary, setMeetingSummary] = useState('');
  const [meetingParticipantUserIds, setMeetingParticipantUserIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaOwner, setAgendaOwner] = useState('');
  const [agendaMinutes, setAgendaMinutes] = useState('');
  const [agendaStatus, setAgendaStatus] = useState<AgendaItem['status']>('ABERTO');

  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionOwner, setDecisionOwner] = useState('');

  const [actionTitle, setActionTitle] = useState('');
  const [actionOwnerId, setActionOwnerId] = useState<number | null>(null);
  const [actionDueDate, setActionDueDate] = useState('');
  const [actionStatus, setActionStatus] = useState<ActionItem['status']>('ABERTO');
  const [actionNotes, setActionNotes] = useState('');

  const [draftTranscript, setDraftTranscript] = useState('');
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftProposals, setDraftProposals] = useState<{ title: string }[] | null>(null);
  const [draftPick, setDraftPick] = useState<Record<number, boolean>>({});
  const [draftOptInBusy, setDraftOptInBusy] = useState(false);

  const [captureLinkUrl, setCaptureLinkUrl] = useState('');
  const [captureLinkBusy, setCaptureLinkBusy] = useState(false);
  const [captureUploadBusy, setCaptureUploadBusy] = useState(false);
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);
  const [capturePendingDelete, setCapturePendingDelete] = useState<{
    id: number;
    fileName: string;
  } | null>(null);
  const [asrProviderBusy, setAsrProviderBusy] = useState(false);
  const [asrConfigMessage, setAsrConfigMessage] = useState<string | null>(null);
  const [transcribingCaptureId, setTranscribingCaptureId] = useState<number | null>(null);
  const [editMeetingSummary, setEditMeetingSummary] = useState('');
  const [meetingMetaSaving, setMeetingMetaSaving] = useState(false);
  const [meetingMetaMsg, setMeetingMetaMsg] = useState<string | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [cancelReasonCategory, setCancelReasonCategory] = useState('');
  const [cancelReasonDetail, setCancelReasonDetail] = useState('');
  const [rescheduleReasonCategory, setRescheduleReasonCategory] = useState('');
  const [rescheduleReasonDetail, setRescheduleReasonDetail] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [rescheduleTitle, setRescheduleTitle] = useState('');
  const [rescheduleLocation, setRescheduleLocation] = useState('');
  const [meetingPendingDelete, setMeetingPendingDelete] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const canDeleteMeeting = normalizeRole(role) === 'owner';
  const cancelReasonOptions = reasonCatalog?.CANCEL ?? DEFAULT_REUNIFY_REASON_CATALOG.CANCEL;
  const rescheduleReasonOptions = reasonCatalog?.RESCHEDULE ?? DEFAULT_REUNIFY_REASON_CATALOG.RESCHEDULE;

  const reunifyAsrProvider = team?.reunifyAsrProvider ?? 'none';

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveMimeTypeRef = useRef('audio/webm');

  const [liveRecording, setLiveRecording] = useState(false);
  const [liveRecordingSec, setLiveRecordingSec] = useState(0);
  const [browserRecordSupported, setBrowserRecordSupported] = useState<boolean | null>(null);

  const uploadCaptureFile = useCallback(
    async (file: File): Promise<number | null> => {
      if (!selectedMeetingId) return null;
      setCaptureUploadBusy(true);
      setCaptureMsg(null);
      try {
        const fd = new FormData();
        fd.set('file', file);
        const res = await fetch(`/api/reunify/meetings/${selectedMeetingId}/captures`, {
          method: 'POST',
          body: fd,
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string; id?: number };
        if (!res.ok) {
          throw new Error(j.error || 'Erro ao enviar');
        }
        setCaptureMsg('Arquivo enviado.');
        await mutateCaptures();
        return typeof j.id === 'number' ? j.id : null;
      } catch (err) {
        setCaptureMsg(err instanceof Error ? err.message : 'Erro ao enviar');
        return null;
      } finally {
        setCaptureUploadBusy(false);
      }
    },
    [selectedMeetingId, mutateCaptures],
  );

  const runTranscribeCapture = useCallback(
    async (meetingId: number, captureId: number) => {
      setTranscribingCaptureId(captureId);
      setCaptureMsg(null);
      try {
        const res = await fetch(
          `/api/reunify/meetings/${meetingId}/captures/${captureId}/transcribe`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applyHeuristic: true }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          hint?: string;
          code?: string;
          transcript?: string;
          proposals?: { title: string }[];
          pipeline?: { steps?: { detail?: string; status?: string; label?: string }[] };
        };
        if (!res.ok) {
          const base = data.error || 'Falha na transcrição';
          const steps = data.pipeline?.steps;
          const lastFail =
            Array.isArray(steps) && steps.length
              ? [...steps].reverse().find((s) => s?.status === 'error' && s?.detail)
              : undefined;
          const detail =
            lastFail?.detail && lastFail.detail !== base ? ` (${lastFail.detail})` : '';
          const msg = [base + detail, data.hint].filter(Boolean).join(' — ');
          throw new Error(msg || 'Falha na transcrição');
        }
        if (typeof data.transcript === 'string') {
          setDraftTranscript(data.transcript);
        }
        if (transcriptDraftEnabled && Array.isArray(data.proposals)) {
          setDraftProposals(data.proposals);
          const pick: Record<number, boolean> = {};
          data.proposals.forEach((_, i) => {
            pick[i] = true;
          });
          setDraftPick(pick);
          setDraftError(null);
          setCaptureMsg('Transcrição concluída — texto e rascunhos na seção «Ações e follow-up».');
        } else {
          setCaptureMsg(
            'Transcrição concluída. Ative «Rascunho a partir de texto» para o time para rever o texto e extrair ações na seção de follow-up.',
          );
        }
      } catch (err) {
        setCaptureMsg(err instanceof Error ? err.message : 'Erro na transcrição');
      } finally {
        setTranscribingCaptureId(null);
      }
    },
    [transcriptDraftEnabled],
  );

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      (window.isSecureContext ||
        location.protocol === 'https:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1' ||
        location.hostname === '[::1]') &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';
    setBrowserRecordSupported(ok);
  }, []);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      mediaRecorderRef.current = null;
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    };
  }, []);

  const stopBrowserRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startBrowserRecording = useCallback(async () => {
    if (!selectedMeetingId || mediaRecorderRef.current) return;
    if (browserRecordSupported === false) {
      setCaptureMsg(
        'Gravação no navegador requer HTTPS ou localhost, microfone e MediaRecorder (Chrome, Edge ou Firefox recente).',
      );
      return;
    }
    setCaptureMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = pickAudioMimeTypeForRecorder();
      liveMimeTypeRef.current = mimeType;
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setCaptureMsg('Erro durante a gravação.');
        setLiveRecording(false);
        setLiveRecordingSec(0);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
      };

      mediaRecorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setLiveRecording(false);
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        const blob = new Blob(chunks, { type: liveMimeTypeRef.current });
        stream.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        setLiveRecordingSec(0);
        try {
          const ext = extensionForAudioMime(liveMimeTypeRef.current);
          const fname = `reuniao-${selectedMeetingId}-navegador-${Date.now()}${ext}`;
          const file = new File([blob], fname, { type: liveMimeTypeRef.current });
          const captureId = await uploadCaptureFile(file);
          if (captureId != null && reunifyAsrProvider === 'assemblyai') {
            window.setTimeout(() => {
              void runTranscribeCapture(selectedMeetingId, captureId);
            }, 600);
            setCaptureMsg(
              'Gravação enviada. A transcrição (AssemblyAI) vai iniciar em breve — aguarde ou use o botão na lista se preferir.',
            );
          } else if (captureId != null) {
            setCaptureMsg(
              'Gravação enviada. Com ASR «AssemblyAI» activo para o time, pode transcrever pelo botão na lista de registos.',
            );
          }
        } catch (e) {
          setCaptureMsg(e instanceof Error ? e.message : 'Erro ao concluir o envio da gravação');
        }
      };

      mediaRecorder.start(1000);
      setLiveRecording(true);
      setLiveRecordingSec(0);
      recordingTimerRef.current = setInterval(() => {
        setLiveRecordingSec((s) => s + 1);
      }, 1000);
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCaptureMsg('Permissão de microfone negada. Permita o acesso nas definições do navegador.');
      } else {
        setCaptureMsg(
          err?.message ||
            'Não foi possível iniciar a gravação. Use HTTPS ou localhost e um microfone disponível.',
        );
      }
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
    }
  }, [selectedMeetingId, browserRecordSupported, uploadCaptureFile, reunifyAsrProvider, runTranscribeCapture]);

  const teamMemberMap = useMemo(() => {
    const map = new Map<number, string>();
    (team?.teamMembers || []).forEach((member) => {
      if (member.user.id) {
        map.set(member.user.id, member.user.name || 'Sem nome');
      }
    });
    return map;
  }, [team]);

  useEffect(() => {
    setMeetingDate(selectedMeeting?.date || selectedDate);
    setMeetingStartTime(selectedMeeting?.startTime || '09:00');
    setMeetingEndTime(selectedMeeting?.endTime || '10:00');
    setMeetingTitle(selectedMeeting?.titulo || '');
    setMeetingStatus((selectedMeeting?.status as Reuniao['status']) || 'AGENDADA');
    setMeetingLocation(selectedMeeting?.location || '');
    setMeetingSummary(selectedMeeting?.summary?.trim() ? selectedMeeting.summary! : '');
    setMeetingParticipantUserIds(
      Array.isArray(selectedMeeting?.participantUserIds) ? selectedMeeting!.participantUserIds! : [],
    );
    setEditMeetingSummary(selectedMeeting?.summary?.trim() ? selectedMeeting.summary! : '');
    setMeetingMetaMsg(null);
    toast.dismiss();
    setCancelReasonCategory('');
    setCancelReasonDetail('');
    setRescheduleReasonCategory('');
    setRescheduleReasonDetail('');
    setRescheduleDate(selectedMeeting?.date || '');
    setRescheduleStartTime(selectedMeeting?.startTime || '09:00');
    setRescheduleEndTime(selectedMeeting?.endTime || '10:00');
    setRescheduleTitle(selectedMeeting?.titulo ? `${selectedMeeting.titulo} (reagendada)` : '');
    setRescheduleLocation(selectedMeeting?.location || '');
  }, [selectedMeetingId, selectedMeeting, selectedDate, toast]);

  const toggleUserIdInList = useCallback((userId: number) => {
    setMeetingParticipantUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }, []);

  const handleMarkMeetingAsCompleted = useCallback(async () => {
    if (!selectedMeetingId) return;
    setLifecycleBusy(true);
    toast.dismiss();
    try {
      const res = await fetch('/api/reunify/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedMeetingId,
          status: 'FINALIZADA',
          cancelReason: null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error || 'Falha ao dar baixa na reunião.');
      }
      toast.showSuccess('Reunião dada como finalizada com sucesso.');
      await mutate(MEETINGS_TEAM_KEY);
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : 'Falha ao dar baixa na reunião.');
    } finally {
      setLifecycleBusy(false);
    }
  }, [selectedMeetingId, toast]);

  const handleCancelMeeting = useCallback(async () => {
    if (!selectedMeetingId) return false;
    if (!cancelReasonCategory) {
      toast.showError('Selecione o motivo do cancelamento.');
      return false;
    }
    const reason = composeLifecycleReason(cancelReasonCategory, cancelReasonDetail);
    setLifecycleBusy(true);
    toast.dismiss();
    try {
      const res = await fetch('/api/reunify/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedMeetingId,
          status: 'CANCELADA',
          cancelReason: reason,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error || 'Falha ao cancelar reunião.');
      }
      toast.showSuccess('Reunião cancelada com motivo registrado.');
      await mutate(MEETINGS_TEAM_KEY);
      await mutateMeetingHistory();
      return true;
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : 'Falha ao cancelar reunião.');
      return false;
    } finally {
      setLifecycleBusy(false);
    }
  }, [selectedMeetingId, cancelReasonCategory, cancelReasonDetail, mutateMeetingHistory, toast]);

  const handleRescheduleMeeting = useCallback(async () => {
    if (!selectedMeetingId || !selectedMeeting) return false;
    if (!rescheduleDate || !rescheduleStartTime || !rescheduleTitle.trim()) {
      toast.showError('Preencha data, hora inicial e título da reunião reagendada.');
      return false;
    }
    if (!rescheduleReasonCategory) {
      toast.showError('Selecione o motivo da reagenda.');
      return false;
    }
    const reason = composeLifecycleReason(rescheduleReasonCategory, rescheduleReasonDetail);
    setLifecycleBusy(true);
    toast.dismiss();
    try {
      const createRes = await fetch('/api/reunify/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: rescheduleDate,
          startTime: rescheduleStartTime,
          endTime: rescheduleEndTime || null,
          title: rescheduleTitle.trim(),
          status: 'AGENDADA',
          location: rescheduleLocation.trim() || null,
          summary: selectedMeeting.summary || null,
          participantUserIds: selectedMeeting.participantUserIds || [],
          rescheduledFromMeetingId: selectedMeeting.id,
        }),
      });
      const created = (await createRes.json().catch(() => ({}))) as { error?: string; id?: number };
      if (!createRes.ok || !created.id) {
        throw new Error(created.error || 'Falha ao criar reunião reagendada.');
      }

      const cancelRes = await fetch('/api/reunify/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedMeeting.id,
          status: 'CANCELADA',
          cancelReason: `${reason} (reagendada para ${formatDate(rescheduleDate)} ${rescheduleStartTime})`,
        }),
      });
      const cancelPayload = (await cancelRes.json().catch(() => ({}))) as { error?: string };
      if (!cancelRes.ok) {
        throw new Error(cancelPayload.error || 'Nova reunião criada, mas houve falha ao cancelar a anterior.');
      }
      setSelectedMeetingId(created.id);
      toast.showSuccess('Reagendamento concluído. Reunião antiga cancelada e nova reunião criada.');
      await mutate(MEETINGS_TEAM_KEY);
      await mutateMeetingHistory();
      return true;
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : 'Falha ao reagendar reunião.');
      return false;
    } finally {
      setLifecycleBusy(false);
    }
  }, [
    selectedMeetingId,
    selectedMeeting,
    rescheduleDate,
    rescheduleStartTime,
    rescheduleEndTime,
    rescheduleTitle,
    rescheduleLocation,
    rescheduleReasonCategory,
    rescheduleReasonDetail,
    mutateMeetingHistory,
    toast,
  ]);

  const handleDeleteMeeting = useCallback(async () => {
    if (!meetingPendingDelete) return;
    setLifecycleBusy(true);
    toast.dismiss();
    try {
      const res = await fetch(`/api/reunify/meetings?id=${meetingPendingDelete.id}`, {
        method: 'DELETE',
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error || 'Erro ao excluir reunião.');
      }
      setMeetingPendingDelete(null);
      setSelectedMeetingId(null);
      toast.showSuccess('Reunião excluída com sucesso.');
      await mutate(MEETINGS_TEAM_KEY);
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : 'Erro ao excluir reunião.');
    } finally {
      setLifecycleBusy(false);
    }
  }, [meetingPendingDelete, toast]);

  if (user && !canView) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você não tem permissão para acessar o Reunify.
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
              title="Reunify"
              description="Planeje e documente reuniões do time: cadastro na base AtlasSwitch, pauta, decisões, ações com prazo e captação (link ou arquivo de áudio/vídeo). Integra com Taskflow (ação vira tarefa), Chronos (bloco na agenda) e, por configuração da equipa, rascunho de ações a partir de texto e transcrição (AssemblyAI). O Projectus não liga reunião a projeto automaticamente — use-o à parte para portfólio executivo."
              className="w-full"
            />
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <Button
              asChild
              variant="outline"
              className="w-full border-violet-200/80 bg-white/90 text-violet-800 shadow-sm backdrop-blur-sm hover:bg-violet-50 dark:border-violet-500/25 dark:bg-slate-900/70 dark:text-violet-200 dark:hover:bg-violet-950/40 sm:w-auto"
            >
              <Link href="/manual/reunify">Manual</Link>
            </Button>
          </div>
        </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScriptumStatCard
          variant="violet"
          icon={CalendarDays}
          title="Reuniões no período"
          description="Filtradas pela data base (dia, semana ou lista) sobre a lista do time"
          value={isLoading ? '—' : metrics.total}
          footnote={
            isLoading
              ? `Carregando ${MEETINGS_TEAM_KEY}`
              : teamMeetingCount > 0 && metrics.total === 0
                ? `${teamMeetingCount} no time — nenhuma neste intervalo; ajuste a data ou a vista`
                : `${teamMeetingCount} carregada(s) do time · ${formatDate(dateRange.from)}–${formatDate(dateRange.to)}`
          }
        />
        <ScriptumStatCard
          variant="emerald"
          icon={CheckCircle2}
          title="Finalizadas"
          description="Reuniões com status finalizado no intervalo"
          value={isLoading ? '—' : metrics.concluded}
          footnote="Contagem no cliente sobre a lista carregada"
        />
        <ScriptumStatCard
          variant="indigo"
          icon={ClipboardList}
          title="Ações (reunião ativa)"
          description="Itens de follow-up da reunião selecionada"
          value={isLoading ? '—' : metrics.actions}
          footnote={selectedMeetingId ? `Reunião #${selectedMeetingId}` : 'Selecione uma reunião'}
        />
        <ScriptumStatCard
          variant="sky"
          icon={AlertOctagon}
          title="Ações abertas"
          description="Pendentes ou em andamento na reunião ativa"
          value={isLoading ? '—' : metrics.actionsOpen}
          footnote="Exclui status concluído"
        />
      </div>

      <div className="mt-6">
        <ModuleWorkspaceHub
          description={
            mainTab === 'agenda' ? (
              <>
                Agenda: calendário ou lista de reuniões do time, data base e criação de novos agendamentos.
              </>
            ) : mainTab === 'reuniao' ? (
              <>
                Reunião: detalhe da reunião selecionada, captações, transcrição (se activa) e acções de follow-up.
              </>
            ) : (
              <>
                Integrações: ligações com Taskflow, Chronos e opções de processamento de reunião para o time.
              </>
            )
          }
          links={
            <Link href="/manual/reunify" className={moduleWorkspaceHubLinkClassName}>
              Manual do Reunify
            </Link>
          }
          tabs={
            <ModuleSegmentedTabs<ReunifyMainTab>
              aria-label="Área principal do Reunify"
              tone="accent"
              tabListClassName="max-w-full"
              items={REUNIFY_MAIN_TAB_ITEMS}
              value={mainTab}
              onValueChange={setMainTab}
            />
          }
        />
      </div>

      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200/90 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-700/90 dark:bg-slate-950/90 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Reunião selecionada</p>
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {selectedMeeting?.titulo ?? '—'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {selectedMeeting
                ? `${formatDate(selectedMeeting.date)} · ${selectedMeeting.startTime}${selectedMeeting.endTime ? `–${selectedMeeting.endTime}` : ''} · ${selectedMeeting.status.replace('_', ' ')}`
                : 'Escolha uma reunião na lista ou no menu abaixo, ou cadastre uma nova na aba Agenda.'}
            </p>
            {selectedMeeting ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Participantes: {selectedMeeting.participantCount ?? selectedMeeting.participantUserIds?.length ?? 0}
              </p>
            ) : null}
          </div>
          <div className="w-full max-w-xs shrink-0">
            <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Trocar reunião</p>
            <Select
              value={stickyMeetingSelectValue}
              onValueChange={(v) => {
                if (v === REUNIFY_SELECT_NONE) return;
                setSelectedMeetingId(Number(v));
              }}
              disabled={isLoading || !teamMeetingCount}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Carregando…' : 'Reunião'} />
              </SelectTrigger>
              <SelectContent>
                {stickyMeetingSelectValue === REUNIFY_SELECT_NONE ? (
                  <SelectItem value={REUNIFY_SELECT_NONE} disabled className="opacity-70">
                    {isLoading ? 'Carregando…' : 'Sem reuniões'}
                  </SelectItem>
                ) : null}
                {(allMeetings || [])
                  .slice()
                  .sort((a, b) => {
                    const d = b.date.localeCompare(a.date);
                    return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
                  })
                  .map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {formatDate(m.date)} · {m.startTime} — {m.titulo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-w-md shrink-0 text-xs leading-relaxed text-slate-500 dark:text-slate-400 lg:max-w-xs">
            <p>
              <strong className="text-slate-700 dark:text-slate-300">Onde gravar:</strong> planear nova reunião → aba
              Agenda (cartão à direita). Já planeadas → lista à esquerda na mesma aba. <strong>Resumo</strong> da
              reunião escolhida → aba Reunião (cartão no topo). Áudio / transcrição → mesma aba, captações e depois{' '}
              <strong>Ações e follow-up</strong>. Integrações → aba Integrações.
            </p>
          </div>
        </div>
      </div>

      {mainTab === 'agenda' && (
      <>
      <Card className="atlas-surface atlas-hover">
        <CardHeader className="gap-1 pb-2">
          <CardTitle>Filtros da agenda</CardTitle>
          <CardDescription>Ajuste vista e período antes de navegar pelas reuniões.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ModuleSegmentedTabs<ReunifyAgendaViewMode>
            aria-label="Vista da agenda"
            tabListClassName="w-fit"
            items={REUNIFY_AGENDA_VIEW_ITEMS}
            value={viewMode}
            onValueChange={setViewMode}
          />
          <div className="flex min-w-0 flex-col gap-1.5 sm:w-auto sm:max-w-lg">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-500" aria-hidden />
              Data base da agenda
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label={viewMode === 'day' ? 'Dia anterior' : 'Semana anterior'}
                  onClick={() =>
                    setSelectedDate((d) => addDaysToDateInput(d, viewMode === 'day' ? -1 : -7))
                  }
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <Input
                  type="date"
                  className="h-10 w-full min-w-[10.5rem] sm:w-44"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setMeetingDate(event.target.value);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label={viewMode === 'day' ? 'Dia seguinte' : 'Semana seguinte'}
                  onClick={() =>
                    setSelectedDate((d) => addDaysToDateInput(d, viewMode === 'day' ? 1 : 7))
                  }
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-10 shrink-0 px-3"
                onClick={() => {
                  const today = formatDateInput(new Date());
                  setSelectedDate(today);
                  setMeetingDate(today);
                }}
              >
                Hoje
              </Button>
            </div>
            <p className="max-w-xl text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {viewMode === 'day' ? (
                <>
                  Vista <strong className="font-medium text-slate-600 dark:text-slate-300">Dia</strong>:{' '}
                  {formatDate(selectedDate)}.
                </>
              ) : (
                <>
                  Vista <strong className="font-medium text-slate-600 dark:text-slate-300">Semana ou Lista</strong>: só
                  aparecem reuniões entre <strong className="font-medium text-slate-600 dark:text-slate-300">
                    {formatDate(dateRange.from)}
                  </strong>{' '}
                  e{' '}
                  <strong className="font-medium text-slate-600 dark:text-slate-300">
                    {formatDate(dateRange.to)}
                  </strong>{' '}
                  (semana de segunda a domingo que contém a data base).
                </>
              )}{' '}
              Reuniões fora deste intervalo continuam no time: use as setas, «Hoje» ou o calendário, ou «Trocar reunião»
              na barra fixa.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader className="gap-1">
            <CardTitle>Reuniões já planeadas (neste período)</CardTitle>
            <CardDescription>
              Só aparecem reuniões que <strong className="font-medium text-slate-700 dark:text-slate-200">já estão na
              base</strong> (criadas antes ou com «Salvar reunião»). Clique para seleccionar. Para <em>criar</em> outra,
              use o cartão à direita «Nova reunião».
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading && (
              <div className="atlas-item text-sm text-slate-500 dark:text-slate-300">
                Carregando reuniões...
              </div>
            )}
            {!isLoading && meetingsInRange.length === 0 && (
              <div className="atlas-item text-sm text-slate-500 dark:text-slate-300">
                {teamMeetingCount === 0
                  ? 'Nenhuma reunião cadastrada para o seu time.'
                  : 'Nenhuma reunião neste período. O time tem reuniões fora deste intervalo — retroceda/avançe a semana com as setas, use «Hoje», escolha outra data no campo ou «Trocar reunião» na barra fixa.'}
              </div>
            )}

            {viewMode === 'day' && (
              <div className="flex flex-col gap-3">
                {meetingsOnSelectedDate.length === 0 ? (
                  <div className="atlas-item text-sm text-slate-500 dark:text-slate-300">
                    <p>Nenhuma reunião no dia selecionado ({formatDate(selectedDate)}).</p>
                    {nextMeetingsForSelectedDate.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {nextMeetingsForSelectedDate.map((meeting) => (
                          <Button
                            key={meeting.id}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDate(meeting.date);
                              setSelectedMeetingId(meeting.id);
                            }}
                          >
                            {formatDate(meeting.date)} · {meeting.startTime}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {meetingsOnSelectedDate.map((meeting) => {
                  const statusMeta = getMeetingStatusMeta(meeting.status);
                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => setSelectedMeetingId(meeting.id)}
                      className={`atlas-item flex flex-col gap-2 text-left ${
                        selectedMeetingId === meeting.id
                          ? 'border-sky-200 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/10'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="atlas-item-meta">
                            {meeting.startTime} {meeting.endTime ? `- ${meeting.endTime}` : ''}
                          </p>
                          <p className="atlas-item-title">{meeting.titulo}</p>
                          {meeting.location && (
                            <p className="text-xs text-slate-400">Local: {meeting.location}</p>
                          )}
                        </div>
                        <span className={cn('atlas-badge', statusMeta.badgeClass)}>{statusMeta.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {viewMode === 'week' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Finalizada
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Cancelada
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Em andamento
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-500" />
                    Agendada
                  </span>
                </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {weekRange.days.map((day) => (
                  <div
                    key={day}
                    className={cn(
                      'rounded-2xl border border-dashed border-slate-200 p-2',
                      day === selectedDate ? 'border-sky-300 bg-sky-50/30 dark:border-sky-600/50 dark:bg-sky-950/20' : '',
                    )}
                  >
                    <button
                      type="button"
                      className="flex flex-col items-start text-xs hover:text-slate-700 dark:hover:text-slate-300"
                      onClick={() => {
                        setSelectedDate(day);
                        setViewMode('day');
                        const dayMeetings = meetingByDate.get(day) || [];
                        if (dayMeetings.length > 0) {
                          setSelectedMeetingId(dayMeetings[0].id);
                        }
                      }}
                    >
                      <span className="font-semibold text-slate-500">{shortWeekdayLabel(day)}</span>
                      <span className="font-semibold text-slate-500">{day}</span>
                    </button>
                    <div className="mt-2 flex flex-col gap-2">
                      {(meetingByDate.get(day) || []).map((meeting) => (
                        <button
                          key={meeting.id}
                          type="button"
                          className={cn(
                            'flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-2 py-1 text-left text-xs dark:border-slate-700 dark:bg-slate-900/50',
                            selectedMeetingId === meeting.id
                              ? 'border-sky-300 bg-sky-50 dark:border-sky-600/50 dark:bg-sky-900/30'
                              : '',
                          )}
                          onClick={() => {
                            setSelectedDate(day);
                            setSelectedMeetingId(meeting.id);
                          }}
                          title={`${meeting.startTime} · ${meeting.titulo}`}
                        >
                          <span className={cn('h-2.5 w-2.5 rounded-full', getMeetingStatusMeta(meeting.status).markerClass)} />
                          <span className="font-medium text-slate-700 dark:text-slate-200">{meeting.startTime}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            )}

            {viewMode === 'list' && (
              <div className="flex flex-col gap-4">
                {weekRange.days.map((day) => (
                  <div key={day}>
                    <p className="text-xs font-semibold text-slate-500">{day}</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {(meetingByDate.get(day) || []).map((meeting) => (
                        (() => {
                          const statusMeta = getMeetingStatusMeta(meeting.status);
                          return (
                        <button
                          key={meeting.id}
                          type="button"
                          className="atlas-item text-left"
                          onClick={() => setSelectedMeetingId(meeting.id)}
                        >
                          <p className="atlas-item-meta">
                            {meeting.startTime} {meeting.endTime ? `- ${meeting.endTime}` : ''}
                          </p>
                          <p className="atlas-item-title">{meeting.titulo}</p>
                          <span className={cn('mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium', statusMeta.badgeClass)}>
                            {statusMeta.label}
                          </span>
                        </button>
                          );
                        })()
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover border-dashed border-sky-200/80 dark:border-sky-900/50">
          <CardHeader className="gap-1">
            <CardTitle>{selectedMeetingId ? 'Reunião selecionada' : 'Nova reunião'}</CardTitle>
            <CardDescription>
              Use este mesmo formulário para criar ou editar reunião selecionada sem trocar de área.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            {selectedMeetingId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setSelectedMeetingId(null);
                  setMeetingDate(selectedDate);
                  setMeetingStartTime('09:00');
                  setMeetingEndTime('10:00');
                  setMeetingTitle('');
                  setMeetingStatus('AGENDADA');
                  setMeetingLocation('');
                  setMeetingSummary('');
                  setMeetingParticipantUserIds([]);
                  setMeetingMetaMsg(null);
                  toast.dismiss();
                }}
              >
                Nova reunião em branco
              </Button>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                  Data da reunião
                </label>
                <Input
                  type="date"
                  className="h-10 w-full"
                  value={meetingDate}
                  onChange={(event) => setMeetingDate(event.target.value)}
                />
              </div>
              <input
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Título da reunião"
                value={meetingTitle}
                onChange={(event) => setMeetingTitle(event.target.value)}
              />
              <input
                type="time"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={meetingStartTime}
                onChange={(event) => setMeetingStartTime(event.target.value)}
              />
              <input
                type="time"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                value={meetingEndTime}
                onChange={(event) => setMeetingEndTime(event.target.value)}
              />
            </div>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
              placeholder="Local"
              value={meetingLocation}
              onChange={(event) => setMeetingLocation(event.target.value)}
            />
            <Select
              value={meetingStatus}
              onValueChange={(v) => setMeetingStatus(v as Reuniao['status'])}
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AGENDADA">Agendada</SelectItem>
                <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                <SelectItem value="FINALIZADA">Finalizada</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60">
              <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                Participantes da reunião (equipe)
              </p>
              {(team?.teamMembers || []).length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum membro encontrado no time.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(team?.teamMembers || []).map((member) => {
                    const uid = member.user.id;
                    const checked = meetingParticipantUserIds.includes(uid);
                    return (
                      <label
                        key={`meeting-create-participant-${uid}`}
                        className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50/60 px-2 py-1.5 text-xs dark:border-slate-700/70 dark:bg-slate-900/40"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => toggleUserIdInList(uid)}
                        />
                        <span>{member.user.name || `Utilizador #${uid}`}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <textarea
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
              rows={3}
              placeholder="Resumo/objetivo"
              value={meetingSummary}
              onChange={(event) => setMeetingSummary(event.target.value)}
            />
            {formError && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {formError}
              </p>
            )}
            {meetingMetaMsg ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                {meetingMetaMsg}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={isSaving || !meetingTitle.trim() || !meetingDate}
                onClick={async () => {
                  if (!meetingTitle.trim()) {
                    setFormError('Informe o título da reunião.');
                    return;
                  }
                  setFormError(null);
                  setIsSaving(true);
                  setMeetingMetaMsg(null);
                  try {
                    const response = await fetch('/api/reunify/meetings', {
                      method: selectedMeetingId ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: selectedMeetingId || undefined,
                        date: meetingDate,
                        startTime: meetingStartTime,
                        endTime: meetingEndTime,
                        titulo: meetingTitle.trim(),
                        status: meetingStatus,
                        location: meetingLocation.trim() || null,
                        summary: meetingSummary.trim() || null,
                        participantUserIds: meetingParticipantUserIds,
                      }),
                    });
                    const payload = (await response.json().catch(() => ({}))) as {
                      id?: number;
                      error?: string;
                    };
                    if (!response.ok) {
                      throw new Error(payload?.error || 'Erro ao salvar reunião');
                    }
                    await mutate(MEETINGS_TEAM_KEY);
                    if (!selectedMeetingId && payload.id) {
                      setSelectedMeetingId(payload.id);
                    }
                    setMeetingMetaMsg(selectedMeetingId ? 'Reunião atualizada.' : 'Reunião criada.');
                  } catch (error: any) {
                    setFormError(error?.message || 'Erro ao salvar reunião');
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                {isSaving ? ACTION_COPY.saving : ACTION_COPY.saveMeeting}
              </Button>
              {selectedMeetingId ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={lifecycleBusy}
                    onClick={handleMarkMeetingAsCompleted}
                  >
                    Concluir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={lifecycleBusy}
                    onClick={() => setCancelModalOpen(true)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={lifecycleBusy}
                    onClick={() => setRescheduleModalOpen(true)}
                  >
                    Reagendar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={actionDeleteOutlineClassName}
                    disabled={lifecycleBusy || !canDeleteMeeting}
                    onClick={() =>
                      canDeleteMeeting && selectedMeeting
                        ? setMeetingPendingDelete({ id: selectedMeeting.id, title: selectedMeeting.titulo })
                        : null
                    }
                  >
                    {ACTION_COPY.delete}
                  </Button>
                </>
              ) : null}
            </div>
            {selectedMeetingId && !canDeleteMeeting ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Apenas o proprietário pode excluir reunião.
              </p>
            ) : null}
            {selectedMeetingId ? (
              <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Histórico da reunião</p>
                {(meetingHistory || []).length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sem histórico registrado.</p>
                ) : (
                  <div className="space-y-1">
                    {(meetingHistory || []).slice(0, 8).map((entry) => (
                      <p key={entry.id} className="text-xs text-slate-600 dark:text-slate-300">
                        {new Date(entry.createdAt).toLocaleString('pt-BR')} · {entry.actionType}
                        {entry.payload ? ` · ${entry.payload}` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <ConfirmActionBanner
          open={Boolean(meetingPendingDelete)}
          title="Confirmar exclusão de reunião"
          message={
            meetingPendingDelete
              ? `Excluir a reunião "${meetingPendingDelete.title}"? Esta ação remove também agenda, decisões, ações e captações vinculadas.`
              : ''
          }
          confirmLabel="Excluir reunião"
          cancelLabel="Cancelar"
          onCancel={() => setMeetingPendingDelete(null)}
          onConfirm={handleDeleteMeeting}
        />
        {cancelModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cancelar reunião</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Selecione o motivo para registrar histórico consistente.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Precisa ajustar motivos?{' '}
                <Link href="/dashboard/control-integrations" className="text-sky-600 hover:underline dark:text-sky-300">
                  Cadastrar motivos
                </Link>
              </p>
              <div className="mt-3 space-y-2">
                <Select value={cancelReasonCategory} onValueChange={setCancelReasonCategory}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Motivo do cancelamento (obrigatório)" />
                  </SelectTrigger>
                  <SelectContent>
                    {cancelReasonOptions.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={cancelReasonDetail}
                  onChange={(event) => setCancelReasonDetail(event.target.value)}
                  placeholder="Complemento do motivo (opcional)"
                />
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setCancelModalOpen(false)}>
                  {ACTION_COPY.cancel}
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={lifecycleBusy}
                  onClick={async () => {
                    const ok = await handleCancelMeeting();
                    if (ok) setCancelModalOpen(false);
                  }}
                >
                  Confirmar cancelamento
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {rescheduleModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reagendar reunião</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Defina motivo e novos dados de data/hora.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Precisa ajustar motivos?{' '}
                <Link href="/dashboard/control-integrations" className="text-sky-600 hover:underline dark:text-sky-300">
                  Cadastrar motivos
                </Link>
              </p>
              <div className="mt-3 space-y-2">
                <Select value={rescheduleReasonCategory} onValueChange={setRescheduleReasonCategory}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Motivo da reagenda (obrigatório)" />
                  </SelectTrigger>
                  <SelectContent>
                    {rescheduleReasonOptions.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={rescheduleReasonDetail}
                  onChange={(event) => setRescheduleReasonDetail(event.target.value)}
                  placeholder="Complemento do motivo (opcional)"
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} />
                  <Input
                    type="time"
                    value={rescheduleStartTime}
                    onChange={(event) => setRescheduleStartTime(event.target.value)}
                  />
                  <Input type="time" value={rescheduleEndTime} onChange={(event) => setRescheduleEndTime(event.target.value)} />
                </div>
                <Input
                  value={rescheduleTitle}
                  onChange={(event) => setRescheduleTitle(event.target.value)}
                  placeholder="Título da nova reunião"
                />
                <Input
                  value={rescheduleLocation}
                  onChange={(event) => setRescheduleLocation(event.target.value)}
                  placeholder="Local da nova reunião (opcional)"
                />
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setRescheduleModalOpen(false)}>
                  {ACTION_COPY.cancel}
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={lifecycleBusy}
                  onClick={async () => {
                    const ok = await handleRescheduleMeeting();
                    if (ok) setRescheduleModalOpen(false);
                  }}
                >
                  Confirmar reagendamento
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      </>
      )}

      {mainTab === 'reuniao' && (
      <>
      {!selectedMeetingId ? (
        <Card className="atlas-surface atlas-hover mt-6">
          <CardContent className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">
            {isLoading
              ? 'A carregar reuniões…'
              : teamMeetingCount === 0
                ? 'Não há reuniões do time. Crie uma na aba Agenda.'
                : 'Selecione uma reunião na barra fixa (Trocar reunião) ou na aba Agenda.'}
          </CardContent>
        </Card>
      ) : null}
      {canView && selectedMeetingId ? (
        <>
        <Card className="atlas-surface atlas-hover mt-6">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-base">Resumo da reunião (objetivo / ata curta)</CardTitle>
            <CardDescription>
              Texto guardado na própria reunião na base (<code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">PATCH /api/reunify/meetings</code>
              ). Isto é independente da <strong className="font-medium text-slate-700 dark:text-slate-200">transcrição
              do áudio</strong>, que fica na secção «Ações e follow-up» mais abaixo, depois de usar «Transcrever» na
              lista de ficheiros.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            {selectedMeeting ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(selectedMeeting.date)} · {selectedMeeting.startTime}
                {selectedMeeting.endTime ? `–${selectedMeeting.endTime}` : ''} · {selectedMeeting.titulo}
              </p>
            ) : null}
            {meetingMetaMsg ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                {meetingMetaMsg}
              </p>
            ) : null}
            <textarea
              className="min-h-[100px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
              placeholder="Objectivo, contexto ou resumo executivo da reunião…"
              value={editMeetingSummary}
              onChange={(e) => setEditMeetingSummary(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={meetingMetaSaving || !selectedMeetingId}
              onClick={async () => {
                if (!selectedMeetingId) return;
                setMeetingMetaSaving(true);
                setMeetingMetaMsg(null);
                try {
                  const res = await fetch('/api/reunify/meetings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: selectedMeetingId,
                      summary: editMeetingSummary.trim() || '',
                    }),
                  });
                  const j = (await res.json().catch(() => ({}))) as { error?: string };
                  if (!res.ok) {
                    throw new Error(j.error || 'Erro ao guardar resumo');
                  }
                  setMeetingMetaMsg('Resumo guardado.');
                  await mutate(MEETINGS_TEAM_KEY);
                } catch (e) {
                  setMeetingMetaMsg(e instanceof Error ? e.message : 'Erro ao guardar');
                } finally {
                  setMeetingMetaSaving(false);
                }
              }}
            >
              {meetingMetaSaving ? 'A guardar…' : 'Guardar resumo'}
            </Button>
          </CardContent>
        </Card>
        <Card className="atlas-surface atlas-hover mt-6 border-slate-200/90 dark:border-slate-700/80">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-base">Gravação e arquivos da reunião</CardTitle>
            <CardDescription>
              Grava na base metadados do link ou do arquivo enviado (<code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">POST …/captures</code>
              ). Pode <strong className="font-medium text-slate-700 dark:text-slate-200">gravar áudio no próprio
              navegador</strong> (microfone), enviar ficheiro ou registar um link externo. Em cada <strong className="font-medium text-slate-700 dark:text-slate-200">ficheiro</strong> na lista «Registos» abaixo há a zona <strong className="font-medium text-slate-700 dark:text-slate-200">Transcrição deste áudio</strong> (botão se o time tiver AssemblyAI). O texto gerado abre na secção <strong className="font-medium text-slate-700 dark:text-slate-200">Ações e follow-up</strong> (desça nesta mesma aba). Só quem enviou ou um administrador pode apagar o registo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
            {selectedMeeting ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reunião selecionada: <span className="font-medium text-slate-800 dark:text-slate-100">{selectedMeeting.titulo}</span>
              </p>
            ) : null}
            {captureMsg ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                {captureMsg}
              </p>
            ) : null}
            {reunifyAsrProvider === 'vosk' ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Fornecedor ASR «Vosk» selecionado: a transcrição offline ainda não está integrada neste servidor.
              </p>
            ) : null}
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Ligação externa (https)</p>
              <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                Guarda só o endereço na base (rastreio / conveniência): link para gravação no Zoom, Drive, OneDrive,
                etc. O AtlasSwitch <strong className="font-medium text-slate-600 dark:text-slate-300">não</strong>{' '}
                descarrega nem transcreve este URL — para AssemblyAI use envio de arquivo ou gravação no navegador.
              </p>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950/60"
                placeholder="https://…"
                value={captureLinkUrl}
                onChange={(e) => {
                  setCaptureLinkUrl(e.target.value);
                  setCaptureMsg(null);
                }}
              />
              <Button
                type="button"
                size="sm"
                className="rounded-lg"
                disabled={captureLinkBusy || liveRecording || !captureLinkUrl.trim()}
                onClick={async () => {
                  setCaptureLinkBusy(true);
                  setCaptureMsg(null);
                  try {
                    const res = await fetch(`/api/reunify/meetings/${selectedMeetingId}/captures`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: captureLinkUrl.trim() }),
                    });
                    const j = (await res.json().catch(() => ({}))) as { error?: string };
                    if (!res.ok) {
                      throw new Error(j.error || 'Erro ao gravar');
                    }
                    setCaptureLinkUrl('');
                    setCaptureMsg('Ligação guardada.');
                    await mutateCaptures();
                  } catch (e) {
                    setCaptureMsg(e instanceof Error ? e.message : 'Erro');
                  } finally {
                    setCaptureLinkBusy(false);
                  }
                }}
              >
                {captureLinkBusy ? 'A gravar…' : 'Guardar ligação'}
              </Button>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Gravar no navegador (microfone)
              </p>
              {browserRecordSupported === false ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  Este contexto não permite gravação (use HTTPS ou localhost, e um navegador com MediaRecorder).
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mesmo destino que o envio de ficheiro: o áudio é guardado no servidor após «Parar e enviar». Com
                  AssemblyAI activo, a transcrição inicia automaticamente após o envio.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
                  disabled={
                    !selectedMeetingId ||
                    liveRecording ||
                    captureUploadBusy ||
                    browserRecordSupported === false
                  }
                  onClick={() => void startBrowserRecording()}
                >
                  <Mic className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
                  Iniciar gravação
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-lg"
                  disabled={!liveRecording}
                  onClick={() => stopBrowserRecording()}
                >
                  Parar e enviar
                </Button>
                {liveRecording ? (
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    {String(Math.floor(liveRecordingSec / 60)).padStart(2, '0')}:
                    {String(liveRecordingSec % 60).padStart(2, '0')}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Envio de arquivo (áudio ou vídeo)</p>
              <input
                type="file"
                accept="audio/*,video/*,.mp3,.m4a,.wav,.webm,.mp4,.mov,.mkv"
                className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-white"
                disabled={captureUploadBusy || liveRecording}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file || !selectedMeetingId) return;
                  await uploadCaptureFile(file);
                }}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tamanho máximo 80 MiB. Formatos comuns: mp3, m4a, wav, webm, mp4, mov…
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Registos</p>
              <div className="mt-2 rounded-xl border border-sky-200/70 bg-sky-50/50 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-slate-300">
                <strong className="text-slate-800 dark:text-slate-100">Onde transcrever:</strong> em cada linha de{' '}
                <strong>Arquivo</strong>, na caixa «Transcrição deste áudio». Se não vir botão, o time ainda tem ASR em
                «Nenhum» — um gestor deve escolher <strong>AssemblyAI</strong> na secção «Transcrição de uploads» em{' '}
                <a
                  href="#reunify-acoes-followup"
                  className="font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  Ações e follow-up
                </a>
                . O texto da transcrição aparece nessa secção («Colar texto da reunião»).
              </div>
              {!capturesPayload?.captures?.length ? (
                <p className="mt-1 text-xs text-slate-500">Nenhum link ou arquivo ainda.</p>
              ) : (
                <ul className="mt-2 max-h-[min(75dvh,42rem)] space-y-2 overflow-y-auto overscroll-y-contain pr-1 text-xs [scrollbar-gutter:stable]">
                  {(capturesPayload.captures || []).map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200/80 bg-white/90 px-2 py-2 dark:border-slate-700 dark:bg-slate-950/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{c.originalName}</p>
                        <p className="text-[11px] text-slate-500">
                          {c.kind === 'LINK' ? 'Link externo' : 'Arquivo'} ·{' '}
                          {new Date(c.createdAt).toLocaleString('pt-BR')}
                          {c.sizeBytes > 0
                            ? ` · ${(c.sizeBytes / (1024 * 1024)).toFixed(1)} MiB`
                            : null}
                        </p>
                        {c.kind === 'LINK' && c.externalUrl ? (
                          <a
                            href={c.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block truncate text-sky-600 underline dark:text-sky-400"
                          >
                            Abrir ligação
                          </a>
                        ) : c.kind === 'UPLOAD' ? (
                          <a
                            href={`/api/reunify/meetings/${selectedMeetingId}/captures/${c.id}/file`}
                            className="mt-1 inline-block text-sky-600 underline dark:text-sky-400"
                          >
                            Descarregar
                          </a>
                        ) : null}
                        {c.kind === 'UPLOAD' ? (
                          <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200/90 bg-slate-50/90 px-2 py-2 dark:border-slate-600 dark:bg-slate-900/50">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Transcrição deste áudio
                            </p>
                            {reunifyAsrProvider === 'assemblyai' ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="rounded-lg text-xs"
                                  disabled={transcribingCaptureId === c.id}
                                  onClick={() => {
                                    if (selectedMeetingId) {
                                      void runTranscribeCapture(selectedMeetingId, c.id);
                                    }
                                  }}
                                >
                                  {transcribingCaptureId === c.id ? 'A transcrever…' : 'Transcrever (AssemblyAI)'}
                                </Button>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Depois, desça até <strong className="text-slate-700 dark:text-slate-200">Ações e
                                  follow-up</strong> para ver o texto e rascunhos de acções.
                                </p>
                              </>
                            ) : (
                              <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                                Para aparecer o botão de transcrição automática, um gestor deve definir{' '}
                                <strong>AssemblyAI</strong> em «Transcrição de uploads» na secção{' '}
                                <strong>Ações e follow-up</strong> (abaixo nesta página). Pode também colar texto
                                transcrito manualmente nessa secção.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {user?.id != null &&
                      (c.createdById === user.id || isOwnerLike(normalizeRole(role))) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 rounded-lg text-xs"
                          onClick={() =>
                            setCapturePendingDelete({ id: c.id, fileName: c.originalName })
                          }
                        >
                          Apagar
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ConfirmActionBanner
              open={Boolean(capturePendingDelete)}
              title="Confirmar remoção de registo"
              message={
                capturePendingDelete
                  ? `Remover o registo "${capturePendingDelete.fileName}"?`
                  : ''
              }
              confirmLabel="Remover registo"
              cancelLabel="Cancelar"
              onCancel={() => setCapturePendingDelete(null)}
              onConfirm={async () => {
                if (!selectedMeetingId || !capturePendingDelete) return;
                try {
                  const res = await fetch(
                    `/api/reunify/meetings/${selectedMeetingId}/captures/${capturePendingDelete.id}`,
                    { method: 'DELETE' },
                  );
                  const j = (await res.json().catch(() => ({}))) as { error?: string };
                  if (!res.ok) {
                    throw new Error(j.error || 'Erro');
                  }
                  setCaptureMsg('Removido.');
                  setCapturePendingDelete(null);
                  await mutateCaptures();
                } catch (err) {
                  setCaptureMsg(err instanceof Error ? err.message : 'Erro');
                }
              }}
            />
          </CardContent>
        </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Pauta e decisões</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
            <div>
              <p className="text-xs font-semibold text-slate-500">Pauta</p>
              {(agendaItems || []).length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhum tópico cadastrado.
                </div>
              ) : (
                (agendaItems || []).map((item) => (
                  <div key={item.id} className="atlas-item">
                    <p className="atlas-item-title">{item.title}</p>
                    <p className="atlas-item-meta">
                      {item.owner || '—'} · {item.durationMinutes || 0} min
                    </p>
                  </div>
                ))
              )}
              <div className="mt-2 flex flex-col gap-2">
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  placeholder="Novo tópico"
                  value={agendaTitle}
                  onChange={(event) => setAgendaTitle(event.target.value)}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Responsável"
                    value={agendaOwner}
                    onChange={(event) => setAgendaOwner(event.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                    placeholder="Minutos"
                    value={agendaMinutes}
                    onChange={(event) => setAgendaMinutes(event.target.value)}
                  />
                </div>
                <Select
                  value={agendaStatus}
                  onValueChange={(v) => setAgendaStatus(v as AgendaItem['status'])}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABERTO">Aberto</SelectItem>
                    <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  className="rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white"
                  disabled={!selectedMeetingId || !agendaTitle.trim()}
                  onClick={async () => {
                    if (!selectedMeetingId) return;
                    await fetch('/api/reunify/agenda-items', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        meetingId: selectedMeetingId,
                        title: agendaTitle.trim(),
                        owner: agendaOwner.trim() || null,
                        durationMinutes: agendaMinutes ? Number(agendaMinutes) : null,
                        status: agendaStatus,
                        position: (agendaItems?.length || 0) + 1,
                      }),
                    });
                    setAgendaTitle('');
                    setAgendaOwner('');
                    setAgendaMinutes('');
                    await mutate(`/api/reunify/agenda-items?meetingId=${selectedMeetingId}`);
                  }}
                >
                  Adicionar tópico
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500">Decisões</p>
              {(decisions || []).length === 0 ? (
                <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                  Nenhuma decisão registrada.
                </div>
              ) : (
                (decisions || []).map((decision) => (
                  <div key={decision.id} className="atlas-item">
                    <p className="atlas-item-title">{decision.title}</p>
                    <p className="atlas-item-meta">{decision.owner || '—'}</p>
                  </div>
                ))
              )}
              <div className="mt-2 flex flex-col gap-2">
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  placeholder="Nova decisão"
                  value={decisionTitle}
                  onChange={(event) => setDecisionTitle(event.target.value)}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  placeholder="Responsável"
                  value={decisionOwner}
                  onChange={(event) => setDecisionOwner(event.target.value)}
                />
                <button
                  className="rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white"
                  disabled={!selectedMeetingId || !decisionTitle.trim()}
                  onClick={async () => {
                    if (!selectedMeetingId) return;
                    await fetch('/api/reunify/decisions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        meetingId: selectedMeetingId,
                        title: decisionTitle.trim(),
                        owner: decisionOwner.trim() || null,
                      }),
                    });
                    setDecisionTitle('');
                    setDecisionOwner('');
                    await mutate(`/api/reunify/decisions?meetingId=${selectedMeetingId}`);
                  }}
                >
                  Adicionar decisão
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="reunify-acoes-followup" className="atlas-surface atlas-hover scroll-mt-28">
          <CardHeader>
            <CardTitle>Ações e follow-up</CardTitle>
            <CardDescription>
              A <strong className="font-medium text-slate-700 dark:text-slate-200">transcrição automática</strong> do
              áudio (quando disponível) preenche a caixa de texto aqui em baixo; o <strong className="font-medium text-slate-700 dark:text-slate-200">resumo</strong> da reunião (objectivo curto) fica no <strong className="font-medium text-slate-700 dark:text-slate-200">cartão «Resumo da reunião»</strong> no topo desta aba.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
            {canTeamReunifyDraftOptIn && (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">Rascunho a partir de texto</p>
                <p className="mt-1 opacity-90">
                  Ativa para o time a extração de rascunhos de ações a partir de notas ou transcrição (regras locais,
                  sem IA na nuvem). Cada item deve ser confirmado antes de gravar.
                </p>
                <label className="mt-2 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-amber-400"
                    checked={transcriptDraftEnabled}
                    disabled={draftOptInBusy}
                    onChange={async (e) => {
                      setDraftOptInBusy(true);
                      try {
                        const res = await fetch('/api/team/reunify-transcript-draft', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enabled: e.target.checked }),
                        });
                        if (!res.ok) {
                          const data = (await res.json().catch(() => ({}))) as { error?: string };
                          throw new Error(data.error || 'Não foi possível atualizar');
                        }
                        await mutate('/api/team');
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setDraftOptInBusy(false);
                      }
                    }}
                  />
                  <span>Ativar rascunhos a partir de texto para este time</span>
                </label>
                <div className="mt-3 border-t border-amber-200/60 pt-3 dark:border-amber-800/40">
                  <p className="font-semibold">Transcrição de uploads (ASR)</p>
                  <p className="mt-1 opacity-90">
                    Opt-in explícito: «Nenhum» mantém só fluxo manual. AssemblyAI envia o arquivo de áudio a um
                    fornecedor externo (contrato DPA do fornecedor). Vosk = offline (ainda não ligado neste build).
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Select
                      value={reunifyAsrProvider}
                      disabled={asrProviderBusy}
                      onValueChange={async (v) => {
                        setAsrProviderBusy(true);
                        setAsrConfigMessage(null);
                        try {
                          const res = await fetch('/api/team/reunify-asr-provider', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ provider: v }),
                          });
                          const data = (await res.json().catch(() => ({}))) as {
                            error?: string;
                            warnings?: string[];
                          };
                          if (!res.ok) {
                            throw new Error(data.error || 'Não foi possível atualizar');
                          }
                          await mutate('/api/team');
                          if (data.warnings?.length) {
                            setAsrConfigMessage(data.warnings.join(' '));
                          }
                        } catch (err) {
                          setAsrConfigMessage(err instanceof Error ? err.message : 'Erro');
                        } finally {
                          setAsrProviderBusy(false);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 w-[220px] rounded-lg text-xs">
                        <SelectValue placeholder="Fornecedor ASR" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (manual)</SelectItem>
                        <SelectItem value="assemblyai">AssemblyAI (nuvem)</SelectItem>
                        <SelectItem value="vosk">Vosk (offline — em evolução)</SelectItem>
                      </SelectContent>
                    </Select>
                    {asrProviderBusy ? (
                      <span className="text-[11px] text-amber-900/80 dark:text-amber-100/80">A gravar…</span>
                    ) : null}
                  </div>
                  {asrConfigMessage ? (
                    <p className="mt-2 text-[11px] text-amber-950 dark:text-amber-50">{asrConfigMessage}</p>
                  ) : null}
                </div>
              </div>
            )}
            {!transcriptDraftEnabled && !canTeamReunifyDraftOptIn ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rascunhos a partir de texto/transcrição: peça a um administrador ou gestor para ativar a
                função no time.
              </p>
            ) : null}
            {transcriptDraftEnabled && (
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Colar texto da reunião (listas numeradas, traços, [ ] ou «Ação: …»)
                </p>
                <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  O áudio transcrito aparece aqui como texto corrido: <strong className="font-medium text-slate-600 dark:text-slate-300">não</strong> há resumo automático nem plano de acção gerado por IA neste módulo. Para criar rascunhos de acções, edite o texto (uma ideia por linha com traço ou «Ação: …») e use «Extrair rascunhos» — ou crie acções à mão na lista abaixo («Nova ação»). O resumo curto da reunião fica no cartão «Resumo da reunião» no topo desta aba.
                </p>
                <textarea
                  className="min-h-[100px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950/60"
                  placeholder="Cole aqui trechos da ata ou export da transcrição…"
                  value={draftTranscript}
                  onChange={(ev) => {
                    setDraftTranscript(ev.target.value);
                    setDraftError(null);
                  }}
                />
                {draftError ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{draftError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={draftBusy || !draftTranscript.trim()}
                    className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
                    onClick={async () => {
                      setDraftBusy(true);
                      setDraftError(null);
                      try {
                        const res = await fetch('/api/reunify/transcript-draft', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ transcript: draftTranscript }),
                        });
                        const data = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          proposals?: { title: string }[];
                        };
                        if (!res.ok) {
                          setDraftError(data.error || 'Falha ao extrair rascunhos');
                          setDraftProposals(null);
                          return;
                        }
                        const list = data.proposals || [];
                        setDraftProposals(list);
                        const pick: Record<number, boolean> = {};
                        list.forEach((_, i) => {
                          pick[i] = true;
                        });
                        setDraftPick(pick);
                      } finally {
                        setDraftBusy(false);
                      }
                    }}
                  >
                    {draftBusy ? 'A analisar…' : 'Extrair rascunhos'}
                  </button>
                  {draftProposals && draftProposals.length > 0 ? (
                    <button
                      type="button"
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => {
                        setDraftProposals(null);
                        setDraftPick({});
                      }}
                    >
                      Limpar resultado
                    </button>
                  ) : null}
                </div>
                {draftProposals && draftProposals.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nenhuma linha reconhecida. Use listas (1. …, - …), checkboxes [ ] ou prefixos Ação:/TODO:.
                  </p>
                ) : null}
                {draftProposals && draftProposals.length > 0 ? (
                  <div className="mt-1 flex flex-col gap-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Selecione o que deseja gravar como ações desta reunião (revisão humana). Depois pode usar «Criar
                      no Taskflow» em cada ação.
                    </p>
                    <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                      {draftProposals.map((p, i) => (
                        <li key={`${i}-${p.title}`} className="flex gap-2 rounded-lg bg-white/80 px-2 py-1 dark:bg-slate-950/50">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0"
                            checked={Boolean(draftPick[i])}
                            onChange={(ev) =>
                              setDraftPick((prev) => ({ ...prev, [i]: ev.target.checked }))
                            }
                          />
                          <span className="text-slate-800 dark:text-slate-100">{p.title}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={draftBusy || !selectedMeetingId}
                      className="self-start rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                      onClick={async () => {
                        if (!selectedMeetingId || !draftProposals) return;
                        const titles = draftProposals
                          .filter((_, i) => draftPick[i])
                          .map((p) => p.title);
                        if (titles.length === 0) {
                          setDraftError('Selecione pelo menos um rascunho.');
                          return;
                        }
                        setDraftBusy(true);
                        setDraftError(null);
                        try {
                          const res = await fetch('/api/reunify/transcript-draft/apply', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ meetingId: selectedMeetingId, titles }),
                          });
                          const data = (await res.json().catch(() => ({}))) as { error?: string };
                          if (!res.ok) {
                            setDraftError(data.error || 'Não foi possível gravar');
                            return;
                          }
                          setTaskflowExportMessage(
                            `${titles.length} acção(ões) adicionada(s) a partir do rascunho.`,
                          );
                          setDraftProposals(null);
                          setDraftPick({});
                          setDraftTranscript('');
                          await mutate(`/api/reunify/action-items?meetingId=${selectedMeetingId}`);
                        } finally {
                          setDraftBusy(false);
                        }
                      }}
                    >
                      Gravar selecionadas como ações
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            {taskflowExportMessage ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
                {taskflowExportMessage}
              </p>
            ) : null}
            {(actionItems || []).length === 0 ? (
              <div className="atlas-item border-dashed text-center text-xs text-slate-500 dark:text-slate-300">
                Nenhuma ação registrada.
              </div>
            ) : (
              (actionItems || []).map((action) => (
                <div key={action.id} className="atlas-item">
                  <p className="atlas-item-title">{action.title}</p>
                  <p className="atlas-item-meta">
                    {action.ownerId ? teamMemberMap.get(action.ownerId) : 'Sem responsável'} ·{' '}
                    {action.dueDate ? formatDate(action.dueDate) : 'Sem prazo'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {action.taskflowTaskId ? (
                      <>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          No Taskflow
                        </span>
                        <Link
                          href="/dashboard/taskflow"
                          className="text-[11px] font-semibold text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                        >
                          Abrir quadro
                        </Link>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={!canExportToTaskflow}
                        title={
                          canExportToTaskflow
                            ? 'Cria uma tarefa no quadro Taskflow (repetir não duplica).'
                            : 'Sem permissão para criar tarefas no Taskflow.'
                        }
                        className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-500 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:enabled:hover:bg-slate-900/40"
                        onClick={async () => {
                          if (!selectedMeetingId || !canExportToTaskflow) return;
                          const res = await fetch('/api/reunify/action-items/taskflow', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ actionItemId: action.id }),
                          });
                          const data = (await res.json().catch(() => ({}))) as {
                            error?: string;
                            message?: string;
                            idempotent?: boolean;
                          };
                          if (!res.ok) {
                            setTaskflowExportMessage(data.error || 'Não foi possível criar a tarefa.');
                            return;
                          }
                          setTaskflowExportMessage(
                            data.message ||
                              (data.idempotent
                                ? 'Esta ação já estava ligada ao Taskflow.'
                                : 'Tarefa criada no Taskflow.'),
                          );
                          await mutate(`/api/reunify/action-items?meetingId=${selectedMeetingId}`);
                        }}
                      >
                        Criar no Taskflow
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            <div className="flex flex-col gap-2">
              <input
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Nova ação"
                value={actionTitle}
                onChange={(event) => setActionTitle(event.target.value)}
              />
              <Select
                value={actionOwnerId ? String(actionOwnerId) : '_none'}
                onValueChange={(v) =>
                  setActionOwnerId(v === '_none' ? null : Number(v))
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Responsável</SelectItem>
                  {(team?.teamMembers || []).map((member) => (
                    <SelectItem key={member.user.id} value={String(member.user.id)}>
                      {member.user.name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                  value={actionDueDate}
                  onChange={(event) => setActionDueDate(event.target.value)}
                />
                <Select
                  value={actionStatus}
                  onValueChange={(v) => setActionStatus(v as ActionItem['status'])}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABERTO">Aberto</SelectItem>
                    <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <input
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/60"
                placeholder="Notas"
                value={actionNotes}
                onChange={(event) => setActionNotes(event.target.value)}
              />
              <button
                className="rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white"
                disabled={!selectedMeetingId || !actionTitle.trim()}
                onClick={async () => {
                  if (!selectedMeetingId) return;
                  await fetch('/api/reunify/action-items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      meetingId: selectedMeetingId,
                      title: actionTitle.trim(),
                      ownerId: actionOwnerId,
                      dueDate: actionDueDate || null,
                      status: actionStatus,
                      notes: actionNotes.trim() || null,
                    }),
                  });
                  setActionTitle('');
                  setActionOwnerId(null);
                  setActionDueDate('');
                  setActionNotes('');
                  await mutate(`/api/reunify/action-items?meetingId=${selectedMeetingId}`);
                }}
              >
                Adicionar ação
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
        </>
      ) : null}
      </>
      )}

      {mainTab === 'integracoes' && (
      <Card className="atlas-surface atlas-hover mt-6">
        <CardHeader className="gap-1">
          <CardTitle>Integrações e sistemas externos</CardTitle>
          <CardDescription>
            Como ligar reuniões feitas em <strong className="font-medium text-slate-700 dark:text-slate-200">Zoom, Google
            Meet, Microsoft Teams, Webex</strong> (e similares) ao AtlasSwitch, além dos módulos internos. O manual tem
            o detalhe sobre privacidade e limites.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-4 text-sm text-slate-700 md:col-span-2 dark:border-indigo-900/50 dark:bg-indigo-950/25 dark:text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
              Plataformas de reunião online (Zoom, Meet, Teams, Webex, Zoho…)
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              O Reunify <strong className="text-slate-800 dark:text-slate-100">não embute</strong> essas aplicações nem,
              nesta versão, sincroniza calendário ou OAuth com elas. A integração é por <strong className="text-slate-800 dark:text-slate-100">evidência e continuidade do trabalho</strong>:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <li>
                Realize a chamada na plataforma que a empresa já usa (Teams com Office 365, Meet com Workspace, Zoom
                corporativo, Webex para maior controlo, etc.).
              </li>
              <li>
                Depois, na aba <strong className="text-slate-800 dark:text-slate-100">Reunião</strong>, use{' '}
                <strong className="text-slate-800 dark:text-slate-100">Ligação externa (https)</strong> para guardar o
                URL da gravação na nuvem do fornecedor ou do <em>share</em> (Drive, OneDrive, repositório interno) — ou
                faça <strong className="text-slate-800 dark:text-slate-100">upload</strong> /{' '}
                <strong className="text-slate-800 dark:text-slate-100">gravar no navegador</strong> se exportar o áudio.
              </li>
              <li>
                <strong className="text-slate-800 dark:text-slate-100">APIs externas</strong> usadas por este fluxo:{' '}
                <strong className="text-slate-800 dark:text-slate-100">AssemblyAI</strong> (só se o gestor activar ASR
                e existir chave no servidor — áudio sai para o fornecedor); resto são{' '}
                <strong className="text-slate-800 dark:text-slate-100">APIs do próprio AtlasSwitch</strong> (ex.:{' '}
                <code className="rounded bg-white/90 px-1 text-[10px] dark:bg-slate-900/80">POST /api/reunify/meetings/…/captures</code>,{' '}
                <code className="rounded bg-white/90 px-1 text-[10px] dark:bg-slate-900/80">…/transcribe</code>, Taskflow,
                Chronos).
              </li>
              <li>
                <strong className="text-slate-800 dark:text-slate-100">Privacidade:</strong> gravações e dados pessoais
                nas plataformas acima seguem as políticas de cada fornecedor; no AtlasSwitch, trate transcrições e
                ficheiros conforme a política do seu time.
              </li>
            </ul>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href="/manual/reunify#integracoes-plataformas">Manual — plataformas, APIs e LGPD</Link>
            </Button>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-300">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Taskflow
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              Em «Ações e follow-up», cada ação pendente pode usar <strong>Criar no Taskflow</strong>. O servidor chama{' '}
              <code className="rounded bg-white px-1 text-[11px] dark:bg-slate-800">POST /api/reunify/action-items/taskflow</code>{' '}
              e associa a tarefa criada à ação (não duplica se já existir vínculo).
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/dashboard/taskflow">Abrir Taskflow</Link>
            </Button>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-300">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Chronos</p>
            <p className="mt-2 text-xs leading-relaxed">
              Cria um compromisso na agenda com data e horário da <strong>reunião selecionada</strong> na barra fixa
              acima, via{' '}
              <code className="rounded bg-white px-1 text-[11px] dark:bg-slate-800">POST /api/chronos/agenda</code>{' '}
              (tipo REUNIAO). Exige permissão <strong className="text-slate-800 dark:text-slate-100">Chronos</strong> no
              perfil; no Chronos escolha o <strong className="text-slate-800 dark:text-slate-100">mesmo dia</strong> da
              reunião (ou use o atalho abaixo após criar).
            </p>
            {!canCreateChronosFromReunify ? (
              <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
                A sua função não inclui Chronos — peça a um gestor a permissão «Chronos» para usar este botão.
              </p>
            ) : null}
            {reunifyChronosFeedback ? (
              <IntegrationImpactBanner
                className="mt-2 text-[11px]"
                tone={reunifyChronosFeedback.startsWith('Erro') ? 'error' : 'success'}
                message={
                  !reunifyChronosFeedback.startsWith('Erro') && selectedMeeting
                    ? `${reunifyChronosFeedback} `
                    : reunifyChronosFeedback
                }
              >
                {reunifyChronosFeedback}{' '}
                {!reunifyChronosFeedback.startsWith('Erro') && selectedMeeting ? (
                  <Link
                    href={`/dashboard/chronos?date=${encodeURIComponent(selectedMeeting.date)}`}
                    className="font-semibold underline underline-offset-2"
                  >
                    Abrir Chronos nesta data
                  </Link>
                ) : null}
              </IntegrationImpactBanner>
            ) : null}
            <IntegrationImpactBanner
              className="mt-2 text-[11px]"
              tone="info"
              message="Impacto desta ação: mantém o cadastro da reunião no Reunify e sincroniza o compromisso no Chronos (origem Reunify)."
            />
            <Button
              type="button"
              size="sm"
              className="mt-3 bg-indigo-600 hover:bg-indigo-500"
              disabled={!selectedMeeting || reunifyChronosBusy || !canCreateChronosFromReunify}
              onClick={async () => {
                if (!selectedMeeting) return;
                setReunifyChronosBusy(true);
                setReunifyChronosFeedback(null);
                try {
                  const res = await fetch('/api/chronos/agenda', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      date: selectedMeeting.date,
                      startTime: selectedMeeting.startTime,
                      endTime: selectedMeeting.endTime ?? null,
                      title: selectedMeeting.titulo,
                      type: 'REUNIAO',
                      description: selectedMeeting.summary?.trim() || null,
                      location: selectedMeeting.location?.trim() || null,
                      source: 'REUNIFY',
                      reunifyMeetingId: selectedMeeting.id,
                    }),
                  });
                  const data = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    id?: number;
                    idempotent?: boolean;
                  };
                  if (!res.ok) {
                    setReunifyChronosFeedback(`Erro: ${data.error || res.statusText || 'Pedido falhou'}`);
                    return;
                  }
                  if (data.idempotent) {
                    setReunifyChronosFeedback(
                      'Ação concluída: reunião já sincronizada no Chronos (sem duplicação).',
                    );
                  } else {
                    setReunifyChronosFeedback(
                      `Ação concluída: reunião enviada ao Chronos (compromisso #${
                        typeof data.id === 'number' ? data.id : '—'
                      }).`,
                    );
                  }
                  void mutate((key) => typeof key === 'string' && key.startsWith('/api/chronos/agenda'));
                } catch (e) {
                  setReunifyChronosFeedback(
                    `Erro: ${e instanceof Error ? e.message : 'Falha de rede ou servidor.'}`,
                  );
                } finally {
                  setReunifyChronosBusy(false);
                }
              }}
            >
              {reunifyChronosBusy ? 'A criar…' : 'Criar no Chronos'}
            </Button>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600 md:col-span-2 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-300">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Rascunho, ASR e Projectus
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              <strong>Rascunho / transcrição:</strong> opções de equipe na seção «Ações e follow-up» (gestor com
              permissão de configuração). <strong>Projectus:</strong> não há vínculo automático reunião → projeto; use o
              portfólio no Projectus para acompanhamento executivo separado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/manual/reunify#visao-geral">Manual completo (passo a passo)</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/projectus">Abrir Projectus</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Use o Reunify para conduzir reuniões objetivas."
          tips={helpTips}
        />
      </div>
      </div>
    </section>
  );
}
