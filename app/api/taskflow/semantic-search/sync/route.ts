import { NextResponse } from 'next/server';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import {
  deleteEmbeddingsForTeam,
  syncTeamTaskEmbeddings,
} from '@/lib/db/taskflow-semantic-search';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { canStartSemanticSync } from '@/lib/taskflow/semantic-search-sync-cooldown';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/** E8.15 — reconstrói índice vectorial das tarefas do time (até 400 tarefas por execução). */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
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

  if (!team.taskflowSemanticSearchEnabled) {
    return NextResponse.json({ error: 'Ative a busca semântica antes de sincronizar.' }, { status: 400 });
  }

  if ((await getPlatformSetting('integrations.openai_api')) !== 'true' || !process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ error: 'OpenAI não está configurado nesta instância.' }, { status: 503 });
  }

  if (!canStartSemanticSync(team.id)) {
    return NextResponse.json(
      { error: 'Aguarde cerca de 90 segundos entre sincronizações completas.' },
      { status: 429 },
    );
  }

  try {
    await deleteEmbeddingsForTeam(team.id);
    const { indexed, skipped } = await syncTeamTaskEmbeddings(team.id);
    return NextResponse.json({
      indexed,
      skipped,
      note: 'No máximo 400 tarefas por execução; execute de novo se o quadro for maior.',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao sincronizar.';
    console.error('[POST /api/taskflow/semantic-search/sync]', e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
