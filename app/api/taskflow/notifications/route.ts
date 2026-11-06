import { NextResponse } from 'next/server';
import { and, desc, eq, like, ne, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { ActivityType, activityLogs } from '@/lib/db/schema';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * Retorna notificações recentes do Taskflow.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const logs = await db
    .select()
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.teamId, team.id),
        like(activityLogs.action, 'TASKFLOW_%'),
        or(
          and(
            eq(activityLogs.action, ActivityType.TASKFLOW_ASSIGNED),
            eq(activityLogs.userId, user.id),
          ),
          ne(activityLogs.action, ActivityType.TASKFLOW_ASSIGNED),
        ),
      ),
    )
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);

  return NextResponse.json(logs);
}
