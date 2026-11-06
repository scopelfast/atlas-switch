/**
 * Papéis no domínio Atlas Switch.
 * `owner` / `member` mantêm compatibilidade com dados existentes.
 * `admin`, `gestor`, `supervisor` alinham-se ao memorial (Fase 1 — evolução gradual).
 */
/**
 * `platform_admin` — operador da instância (Centro de Controlo, empresas globais, IA admin).
 * `owner` / `admin` no `users.role` — dono ou admin do **negócio no tenant**, sem painel global.
 */
export type Role = 'owner' | 'member' | 'admin' | 'gestor' | 'supervisor' | 'platform_admin';

export type Permission =
  | 'dashboard.view'
  | 'control.view'
  | 'ai.manage'
  | 'taskflow.view'
  | 'chronos.view'
  | 'reunify.view'
  | 'projectus.view'
  | 'bibliotheca.view'
  | 'billtrak.view'
  | 'notepad.view'
  | 'scriptum.view'
  | 'resourcehub.view'
  | 'activity.view'
  | 'general.view'
  | 'security.view'
  | 'users.manage';

/** Módulos do produto sem Centro de Controlo nem gestão global de utilizadores. */
const TENANT_PRODUCT_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'taskflow.view',
  'chronos.view',
  'reunify.view',
  'projectus.view',
  'bibliotheca.view',
  'billtrak.view',
  'notepad.view',
  'scriptum.view',
  'resourcehub.view',
  'activity.view',
  'general.view',
  'security.view',
];

const CONTROL_PLANE_PERMISSIONS: Permission[] = ['control.view', 'users.manage', 'ai.manage'];

const PLATFORM_ADMIN_PERMISSIONS: Permission[] = [
  ...TENANT_PRODUCT_PERMISSIONS,
  ...CONTROL_PLANE_PERMISSIONS,
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  /** Operador Atlas (instância multi-tenant). */
  platform_admin: PLATFORM_ADMIN_PERMISSIONS,
  /** Dono do time no produto — sem painel global de empresas/planos. */
  owner: TENANT_PRODUCT_PERMISSIONS,
  /** Administrador do time (papel global espelha convite). */
  admin: TENANT_PRODUCT_PERMISSIONS,
  /**
   * Gestor: operação completa no tenant (igual a owner em módulos no modelo actual).
   */
  gestor: TENANT_PRODUCT_PERMISSIONS,
  /**
   * Supervisor: visão operacional com mesmo filtro de tarefas que Membro (M6.8 — `taskflowListScopeForRole`).
   */
  supervisor: [
    'dashboard.view',
    'taskflow.view',
    'chronos.view',
    'reunify.view',
    'projectus.view',
    'bibliotheca.view',
    'billtrak.view',
    'notepad.view',
    'scriptum.view',
    'resourcehub.view',
    'activity.view',
    'general.view',
    'security.view',
  ],
  member: [
    'dashboard.view',
    'taskflow.view',
    'chronos.view',
    'reunify.view',
    'projectus.view',
    'bibliotheca.view',
    'billtrak.view',
    'notepad.view',
    'scriptum.view',
    'resourcehub.view',
    'activity.view',
    'general.view',
    'security.view',
  ],
};

/**
 * Normaliza o papel vindo da API/BD (valores desconhecidos caem em `member`).
 */
export function normalizeRole(role: string | undefined | null): Role {
  const r = (role || 'member').toLowerCase();
  if (
    r === 'owner' ||
    r === 'member' ||
    r === 'admin' ||
    r === 'gestor' ||
    r === 'supervisor' ||
    r === 'platform_admin'
  ) {
    return r;
  }
  return 'member';
}

/**
 * Acesso ao Centro de Controlo e APIs `/api/control/*` — apenas `platform_admin`.
 * Donos de tenant (`owner`) já não enxergam dados de outras empresas por esta porta.
 */
export function canAccessControlPlane(user: { role: string | null } | null | undefined): boolean {
  if (!user?.role) return false;
  return normalizeRole(user.role) === 'platform_admin';
}

/** Configurar fases do Kanban (colunas), SLA e cores — owner, admin ou gestor. */
export function canConfigureTaskflowBoard(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return r === 'owner' || r === 'admin' || r === 'gestor' || r === 'platform_admin';
}

/**
 * Gestão “pesada” de utilizadores (remover membro, ecrã global no Centro de Controlo).
 * Convites podem ser feitos também por gestor/supervisor — ver `canInviteToTeam`.
 */
export function canManageTeamInvites(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return r === 'owner' || r === 'admin' || r === 'platform_admin';
}

/** Papéis atribuíveis por convite (nunca `owner`: novo time nasce com o primeiro registo). */
export type TeamInviteRole = Exclude<Role, 'owner'>;

const ALL_TEAM_INVITE_ROLES: TeamInviteRole[] = ['admin', 'gestor', 'supervisor', 'member'];

/**
 * Matriz M1.7 — quem pode convidar que função no time:
 * Supervisor→Membro; Gestor→Supervisor+Membro; Admin→Gestor; Proprietário→todos estes.
 */
export function assignableTeamRolesOnInvite(
  inviterRole: string | undefined | null,
): TeamInviteRole[] {
  const r = normalizeRole(inviterRole);
  if (r === 'platform_admin') return [...ALL_TEAM_INVITE_ROLES];
  if (r === 'owner') return [...ALL_TEAM_INVITE_ROLES];
  if (r === 'admin') return ['gestor'];
  if (r === 'gestor') return ['supervisor', 'member'];
  if (r === 'supervisor') return ['member'];
  return [];
}

export function canInviteToTeam(inviterRole: string | undefined | null): boolean {
  return assignableTeamRolesOnInvite(inviterRole).length > 0;
}

export function canResendTeamInvite(inviterRole: string | undefined | null): boolean {
  return canInviteToTeam(inviterRole);
}

/** Remover membro do time: proprietário e administrador (M1.3). */
export function canRemoveTeamMemberAsAdmin(inviterRole: string | undefined | null): boolean {
  const r = normalizeRole(inviterRole);
  return r === 'owner' || r === 'admin' || r === 'platform_admin';
}

export function canInviterAssignTeamRole(
  inviterRole: string | undefined | null,
  targetTeamRole: string,
): boolean {
  const t = normalizeRole(targetTeamRole);
  return assignableTeamRolesOnInvite(inviterRole).includes(t as TeamInviteRole);
}

/** M1.4: convite para membro ou supervisor exige superior indicado. */
export function reportsToRequiredForInviteRole(invitedTeamRole: string): boolean {
  const r = normalizeRole(invitedTeamRole);
  return r === 'member' || r === 'supervisor';
}

/** Papéis no time que podem ser “reporta a” para o convidado. */
export function superiorRolesForInvitee(invitedTeamRole: string): readonly Role[] {
  const r = normalizeRole(invitedTeamRole);
  if (r === 'member') return ['supervisor', 'gestor', 'admin', 'owner'];
  if (r === 'supervisor') return ['gestor', 'admin', 'owner'];
  return [];
}

/** No aceite de convite, `users.role` espelha o papel no time (fluxo actual: um time). */
export function userRoleFromAcceptedTeamRole(teamRole: string): Role {
  return normalizeRole(teamRole);
}

/**
 * Verifica se a função possui uma permissão específica.
 */
export function hasPermission(role: Role | string | undefined | null, permission: Permission) {
  const effective = normalizeRole(role == null ? 'member' : String(role));
  return ROLE_PERMISSIONS[effective]?.includes(permission) ?? false;
}

/** Estrutura de perfis e suas permissões (para telas administrativas). */
export function getRolePermissions(): Record<Role, Permission[]> {
  return { ...ROLE_PERMISSIONS };
}

const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'Painel',
  'control.view': 'Controle',
  'ai.manage': 'IA',
  'taskflow.view': 'Tarefas',
  'chronos.view': 'Chronos',
  'reunify.view': 'Reunify',
  'projectus.view': 'Projectus',
  'bibliotheca.view': 'Bibliotheca',
  'billtrak.view': 'BillTrak',
  'notepad.view': 'Notepad',
  'scriptum.view': 'Scriptum',
  'resourcehub.view': 'ResourceHub',
  'activity.view': 'Atividade',
  'general.view': 'Configurações',
  'security.view': 'Segurança',
  'users.manage': 'Usuários',
};

export function getPermissionLabel(p: Permission): string {
  return PERMISSION_LABELS[p] ?? p;
}

export const ROLE_DISPLAY_LABELS: Record<Role, string> = {
  owner: 'Proprietário',
  member: 'Membro',
  admin: 'Administrador',
  gestor: 'Gestor',
  supervisor: 'Supervisor de equipe',
  platform_admin: 'Operador da plataforma',
};

export function getRoleDisplayLabel(role: string | undefined | null): string {
  return ROLE_DISPLAY_LABELS[normalizeRole(role)] ?? 'Membro';
}

/** Proprietário ou administrador (dicas de UI e fluxos de dono de licença). */
export function isOwnerLike(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return r === 'owner' || r === 'admin' || r === 'platform_admin';
}
