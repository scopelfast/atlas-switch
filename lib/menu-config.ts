import {
  Users,
  ShieldCheck,
  Brain,
  Settings,
  Shield,
  Activity,
  CheckSquare,
  CalendarClock,
  Video,
  Briefcase,
  Library,
  CreditCard,
  NotebookPen,
  FilePenLine,
  Boxes,
  Building2,
  Layers,
  BookOpen,
  UserCog,
  LayoutGrid,
  BarChart3,
  Plug,
} from 'lucide-react';
import type { Permission } from './auth/permissions';

export type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  permission: Permission;
  moduleKey: string;
  order: number;
};

export type MenuGroup = {
  key: string;
  label: string;
  items: NavItem[];
};

const MODULE_GROUPS: { key: string; label: string; order: number }[] = [
  { key: 'nucleo', label: 'Núcleo', order: 0 },
  { key: 'operacional', label: 'Operacional', order: 1 },
  { key: 'conteudo', label: 'Conteúdo', order: 2 },
  { key: 'negocio', label: 'Negócio', order: 3 },
  { key: 'admin', label: 'Administração', order: 4 },
  { key: 'atividade', label: 'Atividade', order: 5 },
];

const MENU_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: Users, label: 'Painel', permission: 'dashboard.view', moduleKey: 'nucleo', order: 0 },
  { href: '/dashboard/control-center', icon: ShieldCheck, label: 'Controle', permission: 'control.view', moduleKey: 'nucleo', order: 1 },
  {
    href: '/dashboard/control-integrations',
    icon: Plug,
    label: 'Integrações globais',
    permission: 'control.view',
    moduleKey: 'nucleo',
    order: 1.25,
  },
  { href: '/dashboard/ai-center', icon: Brain, label: 'IA', permission: 'ai.manage', moduleKey: 'nucleo', order: 2 },
  { href: '/dashboard/taskflow', icon: CheckSquare, label: 'Taskflow', permission: 'taskflow.view', moduleKey: 'operacional', order: 0 },
  {
    href: '/dashboard/taskflow/reports',
    icon: BarChart3,
    label: 'Taskflow · Relatórios',
    permission: 'taskflow.view',
    moduleKey: 'operacional',
    order: 0.5,
  },
  { href: '/dashboard/chronos', icon: CalendarClock, label: 'Chronos', permission: 'chronos.view', moduleKey: 'operacional', order: 1 },
  { href: '/dashboard/reunify', icon: Video, label: 'Reunify', permission: 'reunify.view', moduleKey: 'operacional', order: 2 },
  { href: '/dashboard/projectus', icon: Briefcase, label: 'Projectus', permission: 'projectus.view', moduleKey: 'operacional', order: 3 },
  { href: '/dashboard/bibliotheca', icon: Library, label: 'Bibliotheca', permission: 'bibliotheca.view', moduleKey: 'conteudo', order: 0 },
  { href: '/dashboard/billtrak', icon: CreditCard, label: 'BillTrak', permission: 'billtrak.view', moduleKey: 'negocio', order: 0 },
  { href: '/dashboard/notepad', icon: NotebookPen, label: 'Notepad Pro', permission: 'notepad.view', moduleKey: 'conteudo', order: 1 },
  { href: '/dashboard/scriptum', icon: FilePenLine, label: 'Scriptum', permission: 'scriptum.view', moduleKey: 'conteudo', order: 2 },
  { href: '/dashboard/resourcehub', icon: Boxes, label: 'ResourceHub', permission: 'resourcehub.view', moduleKey: 'negocio', order: 1 },
  { href: '/dashboard/activity', icon: Activity, label: 'Atividade', permission: 'activity.view', moduleKey: 'atividade', order: 0 },
  { href: '/dashboard/empresas', icon: Building2, label: 'Empresas', permission: 'control.view', moduleKey: 'admin', order: 0 },
  { href: '/dashboard/planos', icon: Layers, label: 'Planos', permission: 'control.view', moduleKey: 'admin', order: 1 },
  { href: '/dashboard/catalogo', icon: BookOpen, label: 'Catálogo', permission: 'control.view', moduleKey: 'admin', order: 2 },
  { href: '/dashboard/perfis', icon: UserCog, label: 'Perfis', permission: 'control.view', moduleKey: 'admin', order: 3 },
  { href: '/dashboard/usuarios', icon: Users, label: 'Usuários', permission: 'users.manage', moduleKey: 'admin', order: 4 },
  { href: '/dashboard/menu-config', icon: LayoutGrid, label: 'Config. Menu', permission: 'control.view', moduleKey: 'admin', order: 5 },
  { href: '/dashboard/general', icon: Settings, label: 'Configurações', permission: 'general.view', moduleKey: 'admin', order: 6 },
  { href: '/dashboard/security', icon: Shield, label: 'Segurança', permission: 'security.view', moduleKey: 'admin', order: 7 },
];

export function getMenuGroups(
  hasPermissionFn: (permission: Permission) => boolean,
  opts?: { showUsuariosNav?: boolean },
): MenuGroup[] {
  const allowed = MENU_ITEMS.filter((item) => {
    if (item.href === '/dashboard/usuarios' && opts?.showUsuariosNav) return true;
    return hasPermissionFn(item.permission);
  });
  const byModule = new Map<string, NavItem[]>();

  for (const item of allowed) {
    const list = byModule.get(item.moduleKey) ?? [];
    list.push(item);
    byModule.set(item.moduleKey, list);
  }

  for (const list of byModule.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  return MODULE_GROUPS
    .filter((g) => (byModule.get(g.key)?.length ?? 0) > 0)
    .map((g) => ({
      key: g.key,
      label: g.label,
      items: byModule.get(g.key) ?? [],
    }));
}

export { MENU_ITEMS, MODULE_GROUPS };
