import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTaskflowAiInsightsPayload } from '@/lib/db/taskflow-ai-insights';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teams } from '@/lib/db/schema';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * E7.3 — agregados + texto heurístico (sem LLM externo). Só quando o time activou o opt-in.
 * Visibilidade M6.8 (mesma opção que o quadro).
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!hasPermission(normalizeRole(user.role), 'taskflow.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
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

  const [row] = await db
    .select({ enabled: teams.taskflowAiInsightsEnabled })
    .from(teams)
    .where(eq(teams.id, team.id))
    .limit(1);

  if (!row?.enabled) {
    return NextResponse.json({
      optedIn: false,
      synthesis: null,
      signals: null,
    });
  }

  try {
    const vis = taskflowBoardOptionsForUser(user.id, user.role);
    const payload = await getTaskflowAiInsightsPayload(team.id, {
      listScope: vis.listScope,
      viewerUserId: vis.viewerUserId,
    });
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao calcular insights';
    console.error('[GET /api/taskflow/ai-insights]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
