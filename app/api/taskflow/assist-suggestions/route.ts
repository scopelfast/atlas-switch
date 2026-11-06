import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTaskflowAssistSuggestionsPayload } from '@/lib/db/taskflow-assist-suggestions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teams } from '@/lib/db/schema';
import { wrapTaskflowAssistWithPipeline } from '@/lib/ai/pipeline/taskflow-assist-pipeline';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * E8.3 — sugestões heurísticas (prioridade, carga) sem LLM externo. Opt-in por equipa.
 * E8.13 — `?trace=1` acrescenta `pipeline` com trâmites lógicos (sem alterar o cálculo).
 */
export async function GET(request: Request) {
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
    .select({ enabled: teams.taskflowAssistSuggestionsEnabled })
    .from(teams)
    .where(eq(teams.id, team.id))
    .limit(1);

  if (!row?.enabled) {
    return NextResponse.json({
      optedIn: false,
      disclaimer: null,
      prioritySuggestions: null,
      reassignSuggestions: null,
    });
  }

  const url = new URL(request.url);
  const trace = url.searchParams.get('trace') === '1';

  try {
    const vis = taskflowBoardOptionsForUser(user.id, user.role);
    const t0 = Date.now();
    const payload = await getTaskflowAssistSuggestionsPayload(team.id, {
      listScope: vis.listScope,
      viewerUserId: vis.viewerUserId,
    });
    const computeMs = Date.now() - t0;
    if (trace) {
      return NextResponse.json(
        wrapTaskflowAssistWithPipeline(payload, { loadMs: 0, computeMs }),
      );
    }
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao calcular sugestões';
    console.error('[GET /api/taskflow/assist-suggestions]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
