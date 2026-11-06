import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
  Settings,
  LogOut,
  UserPlus,
  Lock,
  UserCog,
  AlertCircle,
  UserMinus,
  Mail,
  CheckCircle,
  CheckSquare,
  Bell,
  Timer,
  PenLine,
  Pencil,
  Trash2,
  Globe,
  ShieldCheck,
  Ban,
  LayoutTemplate,
  Link2,
  type LucideIcon,
} from 'lucide-react';
import { ActivityType } from '@/lib/db/schema';
import { getActivityLogs, getUser } from '@/lib/db/queries';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleHeader } from '@/components/ui/module-header';
import { hasPermission, isOwnerLike, type Role } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/relative-time';

const iconMap: Record<ActivityType, LucideIcon> = {
  [ActivityType.SIGN_UP]: UserPlus,
  [ActivityType.SIGN_IN]: UserCog,
  [ActivityType.SIGN_OUT]: LogOut,
  [ActivityType.UPDATE_PASSWORD]: Lock,
  [ActivityType.DELETE_ACCOUNT]: UserMinus,
  [ActivityType.UPDATE_ACCOUNT]: Settings,
  [ActivityType.CREATE_TEAM]: UserPlus,
  [ActivityType.REMOVE_TEAM_MEMBER]: UserMinus,
  [ActivityType.INVITE_TEAM_MEMBER]: Mail,
  [ActivityType.ACCEPT_INVITATION]: CheckCircle,
  [ActivityType.TASKFLOW_CREATE]: CheckSquare,
  [ActivityType.TASKFLOW_UPDATE]: CheckSquare,
  [ActivityType.TASKFLOW_MOVE]: CheckSquare,
  [ActivityType.TASKFLOW_DELETE]: CheckSquare,
  [ActivityType.TASKFLOW_BOARD_FROM_TEMPLATE]: LayoutTemplate,
  [ActivityType.TASKFLOW_DEV_LINK_ADDED]: Link2,
  [ActivityType.TASKFLOW_ASSIGNED]: Bell,
  [ActivityType.TASKFLOW_INTERVENTION_STOP]: Timer,
  [ActivityType.TASKFLOW_INTERVENTION_MANUAL]: PenLine,
  [ActivityType.TASKFLOW_INTERVENTION_IDLE_AUTO]: AlertCircle,
  [ActivityType.TASKFLOW_INTERVENTION_EDIT]: Pencil,
  [ActivityType.TASKFLOW_INTERVENTION_DELETE]: Trash2,
  [ActivityType.TASKFLOW_PORTAL_SUBMIT]: Globe,
  [ActivityType.TASKFLOW_PORTAL_APPROVE]: ShieldCheck,
  [ActivityType.TASKFLOW_PORTAL_REJECT]: Ban,
};

function formatAction(action: string): string {
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_IDLE_AUTO)) {
    return 'Timer de intervenção pausado automaticamente por inatividade (Taskflow)';
  }
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_STOP)) {
    return 'Encerrou uma intervenção no Taskflow';
  }
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_MANUAL)) {
    return 'Registou uma intervenção manual no Taskflow';
  }
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_EDIT)) {
    return 'Corrigiu datas ou texto de uma intervenção no Taskflow';
  }
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_DELETE)) {
    return 'Removeu um registo de intervenção no Taskflow';
  }
  switch (action as ActivityType) {
    case ActivityType.SIGN_UP:
      return 'Você criou uma conta';
    case ActivityType.SIGN_IN:
      return 'Você entrou';
    case ActivityType.SIGN_OUT:
      return 'Você saiu';
    case ActivityType.UPDATE_PASSWORD:
      return 'Você alterou a senha';
    case ActivityType.DELETE_ACCOUNT:
      return 'Você excluiu a conta';
    case ActivityType.UPDATE_ACCOUNT:
      return 'Você atualizou a conta';
    case ActivityType.CREATE_TEAM:
      return 'Você criou um novo time';
    case ActivityType.REMOVE_TEAM_MEMBER:
      return 'Você removeu um membro do time';
    case ActivityType.INVITE_TEAM_MEMBER:
      return 'Você convidou um membro do time';
    case ActivityType.ACCEPT_INVITATION:
      return 'Você aceitou um convite';
    case ActivityType.TASKFLOW_CREATE:
      return 'Você criou uma tarefa no Taskflow';
    case ActivityType.TASKFLOW_UPDATE:
      return 'Você atualizou uma tarefa no Taskflow';
    case ActivityType.TASKFLOW_MOVE:
      return 'Você moveu uma tarefa no Taskflow';
    case ActivityType.TASKFLOW_DELETE:
      return 'Você removeu uma tarefa no Taskflow';
    case ActivityType.TASKFLOW_BOARD_FROM_TEMPLATE:
      return 'Criou um quadro Taskflow a partir de um modelo';
    case ActivityType.TASKFLOW_DEV_LINK_ADDED:
      return 'Adicionou uma ligação externa (dev) a uma tarefa no Taskflow';
    case ActivityType.TASKFLOW_ASSIGNED:
      return 'Foi atribuído(a) a uma tarefa no Taskflow';
    case ActivityType.TASKFLOW_PORTAL_SUBMIT:
      return 'Pedido recebido pelo portal público do Taskflow';
    case ActivityType.TASKFLOW_PORTAL_APPROVE:
      return 'Aprovou um pedido do portal público (Taskflow)';
    case ActivityType.TASKFLOW_PORTAL_REJECT:
      return 'Recusou um pedido do portal público (Taskflow)';
    case ActivityType.TASKFLOW_INTERVENTION_EDIT:
      return 'Corrigiu datas ou texto de uma intervenção no Taskflow';
    case ActivityType.TASKFLOW_INTERVENTION_DELETE:
      return 'Removeu um registo de intervenção no Taskflow';
    default:
      return 'Ação desconhecida';
  }
}

function iconForActivityAction(action: string): LucideIcon {
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_IDLE_AUTO)) {
    return iconMap[ActivityType.TASKFLOW_INTERVENTION_IDLE_AUTO];
  }
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_MANUAL)) {
    return iconMap[ActivityType.TASKFLOW_INTERVENTION_MANUAL];
  }
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_STOP)) {
    return iconMap[ActivityType.TASKFLOW_INTERVENTION_STOP];
  }
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_EDIT)) {
    return iconMap[ActivityType.TASKFLOW_INTERVENTION_EDIT];
  }
  if (action.startsWith(ActivityType.TASKFLOW_INTERVENTION_DELETE)) {
    return iconMap[ActivityType.TASKFLOW_INTERVENTION_DELETE];
  }
  const asEnum = action as ActivityType;
  return iconMap[asEnum] ?? Settings;
}

export default async function ActivityPage() {
  const user = await getUser();
  const role = ((user?.role as Role) || 'member') as Role;
  const canView = hasPermission(role, 'activity.view');

  /**
   * Dicas personalizadas conforme perfil do usuário.
   */
  const helpTips =
    isOwnerLike(role)
      ? [
          'Use este painel para auditoria do time.',
          'Atividades ajudam a identificar ações suspeitas.',
        ]
      : [
          'Consulte este painel para lembrar ações recentes.',
          'Avise o gestor se notar algo incomum.',
        ];

  if (user && !canView) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você não tem permissão para acessar o registro de atividades.
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

  const logs = await getActivityLogs();
  const totalLogs = logs.length;
  const lastLog = logs[0];
  const uniqueIps = new Set(
    logs.map((log) => log.ipAddress).filter((ip) => Boolean(ip))
  ).size;

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="Registro de atividades"
            description="Acompanhe tudo que acontece na conta."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/activity">Manual</Link>
          </Button>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length > 0 ? (
              <ul className="space-y-4">
                {logs.map((log) => {
                  const Icon = iconForActivityAction(log.action);
                  const formattedAction = formatAction(log.action);

                  return (
                    <li key={log.id} className="atlas-item flex items-center space-x-4">
                      <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-500/15">
                        <Icon className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formattedAction}
                          {log.ipAddress && ` · IP ${log.ipAddress}`}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          <RelativeTime
                          dateIso={
                            log.timestamp instanceof Date
                              ? log.timestamp.toISOString()
                              : String(log.timestamp)
                          }
                        />
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <AlertCircle className="mb-4 h-12 w-12 text-orange-500" />
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Nenhuma atividade ainda
                </h3>
                <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
                  Quando você realizar ações como entrar ou atualizar sua conta,
                  elas aparecerão aqui.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Resumo rápido</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            <p>Total de eventos: {totalLogs}</p>
            <p>IPs únicos: {uniqueIps}</p>
            <p>
              Última ação:{' '}
              {lastLog ? (
                <RelativeTime
                  dateIso={
                    lastLog.timestamp instanceof Date
                      ? lastLog.timestamp.toISOString()
                      : String(lastLog.timestamp)
                  }
                />
              ) : (
                'Sem registros'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Aqui você acompanha tudo que aconteceu na sua conta."
          tips={helpTips}
        />
      </div>
    </section>
  );
}
