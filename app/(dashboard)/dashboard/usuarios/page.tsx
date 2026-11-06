'use client';

import { useActionState, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import useSWR, { mutate as swrMutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmActionBanner } from '@/components/ui/confirm-action-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleHeader } from '@/components/ui/module-header';
import { DataFilters, type FilterField } from '@/components/ui/data-filters';
import {
  removeTeamMember,
  inviteTeamMember,
  resendTeamInvitation,
} from '@/app/(login)/actions';
import {
  assignableTeamRolesOnInvite,
  canInviteToTeam,
  canRemoveTeamMemberAsAdmin,
  getRoleDisplayLabel,
  hasPermission,
  isOwnerLike,
  normalizeRole,
  reportsToRequiredForInviteRole,
  superiorRolesForInvitee,
  type Role,
  type TeamInviteRole,
} from '@/lib/auth/permissions';
import { ACTION_COPY } from '@/lib/ui/action-copy';

type ActionState = {
  error?: string;
  success?: string;
  inviteUrl?: string;
};

type TeamMember = {
  id: number;
  role: string;
  user: {
    id: number;
    name: string | null;
    email: string;
  };
};

type Team = {
  id: number;
  name: string;
  teamMembers: TeamMember[];
  seatLimit?: number | null;
  seatsUsed?: number;
  taskflowAdminSlotsMax?: number;
  taskflowAdminSlotsUsed?: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CONTROL_TEAM_ROLES = ['owner', 'admin', 'gestor', 'supervisor', 'member'] as const;

type AuditEventRow = {
  id: number;
  teamId: number | null;
  actorUserId: number | null;
  module: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

/**
 * Tela de gestão de usuários do time (owner).
 */
export default function UsuariosPage() {
  const { data: user } = useSWR<{ id?: number; role?: Role }>('/api/user', fetcher);
  const { data: team } = useSWR<Team>('/api/team', fetcher);
  const role = (user?.role || 'member') as Role;
  const hasUsersManage = hasPermission(role, 'users.manage');
  const canSeeUsuarios = canInviteToTeam(role) || hasUsersManage;
  const assignableRoles = useMemo(() => assignableTeamRolesOnInvite(role), [role]);
  const [inviteRole, setInviteRole] = useState<TeamInviteRole>('member');
  const [reportsToUserId, setReportsToUserId] = useState('');

  useEffect(() => {
    if (assignableRoles.length === 0) return;
    if (!assignableRoles.includes(inviteRole)) {
      setInviteRole(assignableRoles[0]);
    }
  }, [assignableRoles, inviteRole]);

  useEffect(() => {
    setReportsToUserId('');
  }, [inviteRole]);

  const reportsCandidates = useMemo(() => {
    if (!team?.teamMembers || !reportsToRequiredForInviteRole(inviteRole)) return [];
    const allowed = [...superiorRolesForInvitee(inviteRole)] as Role[];
    return team.teamMembers.filter((m) => allowed.includes(normalizeRole(m.role)));
  }, [team, inviteRole]);

  const [inviteState, inviteAction, isInvitePending] = useActionState<
    ActionState,
    FormData
  >(inviteTeamMember, {});
  const [resendState, resendAction, isResendPending] = useActionState<
    ActionState,
    FormData
  >(resendTeamInvitation, {});
  const [copied, setCopied] = useState(false);
  const [copiedResend, setCopiedResend] = useState(false);
  const [removeState, removeAction, isRemovePending] = useActionState<
    ActionState,
    FormData
  >(removeTeamMember, {});

  /**
   * Dicas personalizadas conforme perfil do usuário.
   */
  const helpTips = isOwnerLike(role)
    ? [
        'Convide membros com e-mail válido.',
        'Membro e Supervisor exigem “reporta a”. Matriz: Supervisor→Membro; Gestor→Supervisor+Membro; Admin→Gestor.',
        'Segundo administrador no time depende do plano SaaS (limite definido nos planos comerciais pelo operador da plataforma).',
      ]
    : canInviteToTeam(role)
      ? [
          'Convide apenas as funções permitidas para o seu perfil.',
          'Membro e Supervisor exigem escolher o superior no time.',
        ]
      : [
          'Você pode visualizar membros, mas não pode gerenciar.',
          'Peça ao gestor para ajustar acessos.',
        ];

  if (user && !canSeeUsuarios) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Apenas perfis com permissão de convite ou gestão de utilizadores podem aceder a esta página.
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
    <section className="flex-1 p-4 lg:p-8">
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="Usuários"
            description="Gerencie membros, funções e convites. Um usuário pode estar ligado a uma ou mais empresas (times)."
            className="w-full"
          />
          {team?.seatLimit != null && typeof team.seatsUsed === 'number' && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Licenças: {team.seatsUsed} / {team.seatLimit} lugares (membros + convites pendentes).
            </p>
          )}
          {typeof team?.taskflowAdminSlotsMax === 'number' &&
            typeof team?.taskflowAdminSlotsUsed === 'number' &&
            assignableRoles.includes('admin') && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Vagas de Administrador (plano): {team.taskflowAdminSlotsUsed} / {team.taskflowAdminSlotsMax} em
                uso (membros com papel Administrador + convites em curso).
              </p>
            )}
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/usuarios">Manual</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Membros do time</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {team?.teamMembers?.length ? (
              team.teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="atlas-item flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="atlas-item-title">
                      {member.user.name || member.user.email}
                    </p>
                    <p className="atlas-item-meta">{member.user.email}</p>
                    <span className="atlas-badge mt-2 inline-flex bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                      {getRoleDisplayLabel(member.role)}
                    </span>
                  </div>
                  {member.user.id !== user?.id && canRemoveTeamMemberAsAdmin(role) ? (
                    <form action={removeAction}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        className="rounded-full"
                        disabled={isRemovePending}
                      >
                        {isRemovePending ? 'Removendo...' : 'Remover'}
                      </Button>
                    </form>
                  ) : member.user.id === user?.id ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      Você
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      —
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum membro encontrado.
              </p>
            )}
            {removeState?.error && (
              <p className="text-sm text-red-500">{removeState.error}</p>
            )}
            {removeState?.success && (
              <p className="text-sm text-green-600">{removeState.success}</p>
            )}
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Convidar usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={inviteAction} className="space-y-4">
              <input type="hidden" name="role" value={inviteRole} />
              {reportsToRequiredForInviteRole(inviteRole) ? (
                <input type="hidden" name="reportsToUserId" value={reportsToUserId} />
              ) : null}
              <div>
                <Label htmlFor="email" className="mb-2">
                  E-mail
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="invite-name" className="mb-2">
                  Nome do convidado
                </Label>
                <Input
                  id="invite-name"
                  name="name"
                  type="text"
                  placeholder="Nome para registos e e-mail de convite"
                  required
                  minLength={1}
                  maxLength={100}
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="role" className="mb-2">
                  Função no time
                </Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as TeamInviteRole)}
                >
                  <SelectTrigger id="role" className="rounded-xl">
                    <SelectValue placeholder="Função" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {getRoleDisplayLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reportsToRequiredForInviteRole(inviteRole) && (
                <div>
                  <Label htmlFor="reports-to" className="mb-2">
                    Reporta a (obrigatório)
                  </Label>
                  {reportsCandidates.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Não há superior elegível neste time. Convide primeiro um Supervisor ou Gestor, ou peça ao
                      proprietário.
                    </p>
                  ) : (
                    <Select value={reportsToUserId} onValueChange={setReportsToUserId} required>
                      <SelectTrigger id="reports-to" className="rounded-xl">
                        <SelectValue placeholder="Escolha o superior no time" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportsCandidates.map((m) => (
                          <SelectItem key={m.user.id} value={String(m.user.id)}>
                            {m.user.name || m.user.email} ({getRoleDisplayLabel(m.role)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {inviteState?.error && (
                <p className="text-sm text-red-500 dark:text-red-400">
                  {inviteState.error}
                </p>
              )}
              {inviteState?.success && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  {inviteState.success}
                </p>
              )}
              {inviteState?.inviteUrl && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                    Link do convite (compartilhe com o convidado):
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteState.inviteUrl}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteState.inviteUrl!);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? 'Copiado!' : 'Copiar'}
                    </Button>
                  </div>
                </div>
              )}
              <Button
                type="submit"
                className="rounded-full bg-indigo-600 hover:bg-indigo-700"
                disabled={
                  isInvitePending ||
                  assignableRoles.length === 0 ||
                  (reportsToRequiredForInviteRole(inviteRole) &&
                    (!reportsToUserId || reportsCandidates.length === 0))
                }
              >
                {isInvitePending ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
              <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Reenviar convite pendente
              </h3>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Se o e-mail não chegou ou o convidado perdeu o link, reenvie para o mesmo e-mail
                do convite pendente.
              </p>
              <form action={resendAction} className="space-y-4">
                <div>
                  <Label htmlFor="resend-email" className="mb-2">
                    E-mail do convite pendente
                  </Label>
                  <Input
                    id="resend-email"
                    name="email"
                    type="email"
                    placeholder="mesmo@email.do.convite"
                    required
                  />
                </div>
                {resendState?.error && (
                  <p className="text-sm text-red-500 dark:text-red-400">{resendState.error}</p>
                )}
                {resendState?.success && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {resendState.success}
                  </p>
                )}
                {resendState?.inviteUrl && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                    <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                      Link do convite:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={resendState.inviteUrl}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(resendState.inviteUrl!);
                          setCopiedResend(true);
                          setTimeout(() => setCopiedResend(false), 2000);
                        }}
                      >
                        {copiedResend ? 'Copiado!' : 'Copiar'}
                      </Button>
                    </div>
                  </div>
                )}
                <Button
                  type="submit"
                  variant="outline"
                  className="rounded-full"
                  disabled={isResendPending}
                >
                  {isResendPending ? 'Reenviando...' : 'Reenviar convite'}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      {hasUsersManage && hasPermission(role, 'control.view') && (
        <UsuariosEmpresasSection />
      )}

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Controle acessos e mantenha o time alinhado."
          tips={helpTips}
        />
      </div>
    </section>
  );
}

type UserWithTeams = {
  id: number;
  name: string | null;
  email: string;
  blockedAt: string | null;
  teams: { teamId: number; teamName: string; role: string }[];
};

type EmpresaOption = {
  id: number;
  name: string;
};

const usuariosFilterFields: FilterField[] = [
  { key: 'q', label: 'Nome / E-mail / Empresa', type: 'text', placeholder: 'Buscar' },
];

function UsuariosEmpresasSection() {
  const [filterQ, setFilterQ] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);
  const params = filterQ ? `?q=${encodeURIComponent(filterQ)}` : '';
  const query = `/api/control/usuarios${params ? `${params}&` : '?'}includeInactive=${showBlocked ? '1' : '0'}`;
  const { data: usuarios = [], mutate: mutateUsuarios } = useSWR<UserWithTeams[]>(
    query,
    fetcher
  );
  const { data: empresas = [] } = useSWR<EmpresaOption[]>('/api/control/empresas', fetcher);
  const { data: auditEvents = [] } = useSWR<AuditEventRow[]>('/api/control/events', fetcher);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [linkTeamId, setLinkTeamId] = useState('');
  const [linkRole, setLinkRole] = useState('member');
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserWithTeams | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editingUserRow = useMemo(
    () => (editingUserId != null ? usuarios.find((u) => u.id === editingUserId) ?? null : null),
    [editingUserId, usuarios],
  );

  const empresasParaVincular = useMemo(() => {
    if (!editingUserRow) return empresas;
    const linkedIds = new Set(editingUserRow.teams.map((t) => t.teamId));
    return empresas.filter((e) => !linkedIds.has(e.id));
  }, [editingUserRow, empresas]);

  /** Evita `Select` com valor órfão se os dados refrescarem e o vínculo já existir. */
  useEffect(() => {
    if (!editingUserRow || !linkTeamId) return;
    const tid = Number(linkTeamId);
    if (!Number.isFinite(tid) || editingUserRow.teams.some((t) => t.teamId === tid)) {
      setLinkTeamId('');
    }
  }, [editingUserRow, linkTeamId]);

  const startEdit = (u: UserWithTeams) => {
    setOperationMessage(null);
    setEditingUserId(u.id);
    setEditingName(u.name || '');
    setEditingEmail(u.email || '');
    setLinkTeamId('');
    setLinkRole('member');
  };

  const cancelEdit = useCallback(() => {
    setEditingUserId(null);
    setEditingName('');
    setEditingEmail('');
    setLinkTeamId('');
    setLinkRole('member');
  }, []);

  useEffect(() => {
    if (editingUserId == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingUserId, cancelEdit]);

  const saveEdit = async () => {
    if (!editingUserId || !editingName.trim() || !editingEmail.trim()) return;
    setBusy(true);
    setOperationMessage(null);
    try {
      const res = await fetch('/api/control/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUserId,
          name: editingName.trim(),
          email: editingEmail.trim().toLowerCase(),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'Falha ao atualizar usuário.');
      }
      setOperationMessage('Usuário atualizado com sucesso.');
      cancelEdit();
      await mutateUsuarios();
      await swrMutate('/api/control/events');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Falha ao atualizar usuário.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteUser) return;
    setBusy(true);
    setOperationMessage(null);
    try {
      const res = await fetch(`/api/control/usuarios?id=${pendingDeleteUser.id}`, {
        method: 'DELETE',
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'Falha ao excluir usuário.');
      }
      setPendingDeleteUser(null);
      if (editingUserId === pendingDeleteUser.id) {
        cancelEdit();
      }
      setOperationMessage('Usuário excluído com sucesso.');
      await mutateUsuarios();
      await swrMutate('/api/control/events');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Falha ao excluir usuário.');
    } finally {
      setBusy(false);
    }
  };

  const assignUserToEmpresa = async (userId: number) => {
    if (!linkTeamId) return;
    setBusy(true);
    setOperationMessage(null);
    try {
      const res = await fetch('/api/control/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_team',
          userId,
          teamId: Number(linkTeamId),
          role: linkRole.trim().toLowerCase(),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Falha ao vincular usuário à empresa.');
      setOperationMessage('Usuário vinculado à empresa com sucesso.');
      setLinkTeamId('');
      await mutateUsuarios();
      await swrMutate('/api/control/events');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Falha ao vincular usuário.');
    } finally {
      setBusy(false);
    }
  };

  const updateTeamRole = async (userId: number, teamId: number, role: string) => {
    setBusy(true);
    setOperationMessage(null);
    try {
      const res = await fetch('/api/control/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_team_role',
          userId,
          teamId,
          role,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Falha ao atualizar papel do usuário.');
      setOperationMessage('Papel atualizado com sucesso.');
      await mutateUsuarios();
      await swrMutate('/api/control/events');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Falha ao atualizar papel.');
    } finally {
      setBusy(false);
    }
  };

  const removeUserFromEmpresa = async (userId: number, teamId: number) => {
    setBusy(true);
    setOperationMessage(null);
    try {
      const res = await fetch('/api/control/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_team',
          userId,
          teamId,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Falha ao remover vínculo do usuário.');
      setOperationMessage('Vínculo com empresa removido com sucesso.');
      await mutateUsuarios();
      await swrMutate('/api/control/events');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Falha ao remover vínculo.');
    } finally {
      setBusy(false);
    }
  };

  const toggleBlockUser = async (userId: number, blocked: boolean) => {
    setBusy(true);
    setOperationMessage(null);
    try {
      const res = await fetch('/api/control/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_block',
          userId,
          blocked,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Falha ao atualizar bloqueio do usuário.');
      setOperationMessage(blocked ? 'Usuário bloqueado com sucesso.' : 'Usuário desbloqueado com sucesso.');
      await mutateUsuarios();
      await swrMutate('/api/control/events');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Falha ao atualizar bloqueio.');
    } finally {
      setBusy(false);
    }
  };

  const controlUserModalFieldClass =
    'rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/60';

  return (
    <>
    <Card className="mt-6 atlas-surface atlas-hover">
      <CardHeader>
        <CardTitle>Usuários e empresas</CardTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Visão global: usuários ligados a uma ou mais empresas (times).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ConfirmActionBanner
          open={Boolean(pendingDeleteUser)}
          title="Confirmar exclusão de usuário"
          message={
            pendingDeleteUser
              ? `Excluir "${pendingDeleteUser.name || pendingDeleteUser.email}"? O usuário será desativado.`
              : ''
          }
          confirmLabel="Excluir usuário"
          cancelLabel="Cancelar"
          onCancel={() => setPendingDeleteUser(null)}
          onConfirm={confirmDelete}
        />
        {operationMessage ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
            {operationMessage}
          </p>
        ) : null}
        <DataFilters
          fields={usuariosFilterFields}
          onFilter={(v) => setFilterQ(v.q ?? '')}
          onClear={() => setFilterQ('')}
        />
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showBlocked}
            onChange={(e) => setShowBlocked(e.target.checked)}
          />
          Incluir usuários bloqueados
        </label>
        <ul className="space-y-3">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="atlas-item flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{u.name || u.email}</p>
                  {u.blockedAt ? (
                    <span className="atlas-badge bg-rose-500/15 text-rose-700 dark:text-rose-200">
                      Bloqueado
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-500">{u.email}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {u.teams.map((t) => (
                    <div
                      key={t.teamId}
                      className="flex items-center gap-1 rounded-md bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700"
                    >
                      <span>{t.teamName}</span>
                      <Select
                        value={t.role}
                        onValueChange={(nextRole) => {
                          void updateTeamRole(u.id, t.teamId, nextRole);
                        }}
                        disabled={busy || u.blockedAt != null}
                      >
                        <SelectTrigger className="h-6 w-[120px] rounded-md border-0 bg-transparent px-1.5 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTROL_TEAM_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {getRoleDisplayLabel(r)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[10px]"
                        disabled={busy}
                        onClick={() => {
                          void removeUserFromEmpresa(u.id, t.teamId);
                        }}
                      >
                        remover
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="text-xs text-slate-500 sm:text-right">{u.teams.length} empresa(s)</span>
                <Button type="button" size="sm" variant="outline" onClick={() => startEdit(u)}>
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void toggleBlockUser(u.id, !u.blockedAt);
                  }}
                >
                  {u.blockedAt ? 'Desbloquear' : 'Bloquear'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOperationMessage(null);
                    setPendingDeleteUser(u);
                  }}
                >
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {usuarios.length === 0 && (
          <p className="text-sm text-slate-500">Nenhum usuário encontrado.</p>
        )}

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Trilha de auditoria (últimos eventos)
          </h3>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Registos do plano de controlo (inclui alterações de usuários e empresas quando gravadas).
          </p>
          <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
            {auditEvents.length === 0 ? (
              <li className="text-slate-500">Nenhum evento carregado.</li>
            ) : (
              auditEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-lg border border-slate-200/70 bg-white/80 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-950/40"
                >
                  <span className="font-mono text-[10px] text-slate-400">
                    {new Date(ev.createdAt).toLocaleString('pt-BR')}
                  </span>{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{ev.module}</span>
                  <span className="text-slate-500"> · </span>
                  <span>{ev.action}</span>
                  {ev.detail ? (
                    <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">{ev.detail}</p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </CardContent>
    </Card>

    {editingUserId != null &&
      editingUserRow &&
      typeof document !== 'undefined' &&
      createPortal(
        <div
          className="fixed inset-0 z-[380] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="control-usuario-edit-modal-title"
          onClick={cancelEdit}
        >
          <div
            className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-violet-200/80 bg-white p-5 shadow-xl dark:border-violet-900/50 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3
                  id="control-usuario-edit-modal-title"
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                >
                  Editar utilizador
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Ajuste os dados e as ligações a empresas — o mesmo fluxo visual do Taskflow (modal com overlay).
                </p>
              </div>
            </div>

            {editingUserRow.blockedAt ? (
              <p className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-100">
                Utilizador bloqueado: não é possível vincular a novas empresas até desbloquear. Pode ainda
                atualizar nome e e-mail se a API permitir.
              </p>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Nome
                </Label>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="Nome do utilizador"
                  className={controlUserModalFieldClass}
                  disabled={busy}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={editingEmail}
                  onChange={(e) => setEditingEmail(e.target.value)}
                  placeholder="E-mail do utilizador"
                  className={controlUserModalFieldClass}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Vincular a empresa
              </p>
              {empresas.length === 0 ? (
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma empresa registada no painel de controlo.
                </p>
              ) : empresasParaVincular.length === 0 ? (
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Este utilizador já está associado a todas as empresas disponíveis. Para alterar o papel, use o
                  menu ao lado do nome da empresa na lista.
                </p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Empresa
                  </Label>
                  <Select
                    value={linkTeamId}
                    onValueChange={setLinkTeamId}
                    disabled={
                      busy || Boolean(editingUserRow.blockedAt) || empresasParaVincular.length === 0
                    }
                  >
                    <SelectTrigger className={`w-full ${controlUserModalFieldClass}`}>
                      <SelectValue placeholder="Escolher empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresasParaVincular.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-[200px]">
                  <Label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Papel
                  </Label>
                  <Select
                    value={linkRole}
                    onValueChange={setLinkRole}
                    disabled={busy || Boolean(editingUserRow.blockedAt)}
                  >
                    <SelectTrigger className={`w-full ${controlUserModalFieldClass}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTROL_TEAM_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {getRoleDisplayLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  className="rounded-full sm:shrink-0"
                  disabled={
                    busy ||
                    !linkTeamId ||
                    Boolean(editingUserRow.blockedAt) ||
                    empresasParaVincular.length === 0
                  }
                  onClick={() => {
                    void assignUserToEmpresa(editingUserId);
                  }}
                >
                  Vincular
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={cancelEdit}>
                {ACTION_COPY.cancel}
              </Button>
              <Button
                type="button"
                className="rounded-full"
                disabled={busy || !editingName.trim() || !editingEmail.trim()}
                onClick={() => {
                  void saveEdit();
                }}
              >
                {busy ? ACTION_COPY.saving : ACTION_COPY.save}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
