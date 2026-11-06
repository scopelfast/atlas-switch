import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { semanticSearchTasks } from '@/lib/db/taskflow-semantic-search';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { openaiEmbedTexts } from '@/lib/taskflow/openai-embeddings';
import { checkSemanticSearchUserRateLimit } from '@/lib/taskflow/semantic-search-user-rate-limit';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/** E8.15 — busca por similaridade (cosine) nas tarefas indexadas; M6.8 na filtragem. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!hasPermission(normalizeRole(user.role), 'taskflow.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  if (!checkSemanticSearchUserRateLimit(user.id)) {
    return NextResponse.json({ error: 'Muitas pesquisas nesta hora.' }, { status: 429 });
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

  if (!team.taskflowSemanticSearchEnabled) {
    return NextResponse.json({ error: 'Busca semântica desligada para esta equipe.' }, { status: 403 });
  }

  if ((await getPlatformSetting('integrations.openai_api')) !== 'true' || !process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ error: 'OpenAI não está configurado nesta instância.' }, { status: 503 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ error: 'Indique q com pelo menos 2 caracteres.' }, { status: 400 });
  }
  if (q.length > 2000) {
    return NextResponse.json({ error: 'Consulta demasiado longa.' }, { status: 400 });
  }

  const limitRaw = Number(url.searchParams.get('limit') || '12');
  const limit = Number.isFinite(limitRaw) ? limitRaw : 12;

  const opts = taskflowBoardOptionsForUser(user.id, user.role);
  const listScopeTeam = opts.listScope === 'team';

  try {
    const [qVec] = await openaiEmbedTexts([q]);
    const hits = await semanticSearchTasks({
      teamId: team.id,
      listScopeTeam,
      viewerUserId: user.id,
      queryEmbedding: qVec,
      limit,
    });
    return NextResponse.json({
      query: q,
      results: hits.map((h) => ({
        taskId: h.taskId,
        title: h.title,
        distance: h.distance,
      })),
      disclaimer:
        'Resultados por similaridade de texto (embeddings). Documentos Bibliotheca não entram neste MVP.',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro na busca.';
    console.error('[GET /api/taskflow/semantic-search]', e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
