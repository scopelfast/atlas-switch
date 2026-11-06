import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { deleteEmbeddingsForTeam } from '@/lib/db/taskflow-semantic-search';
import { db } from '@/lib/db/drizzle';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teams } from '@/lib/db/schema';

/** E8.15 — opt-in por equipa para busca semântica (pgvector + OpenAI embeddings). */
export async function PATCH(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || typeof (body as { enabled?: unknown }).enabled !== 'boolean') {
    return NextResponse.json({ error: 'Indique { "enabled": true|false }' }, { status: 400 });
  }
  const enabled = (body as { enabled: boolean }).enabled;

  if (enabled) {
    const platformOpenai = (await getPlatformSetting('integrations.openai_api')) === 'true';
    const envKey = Boolean(process.env.OPENAI_API_KEY?.trim());
    if (!platformOpenai || !envKey) {
      return NextResponse.json(
        {
          error:
            'OpenAI não está disponível: ative o toggle na página de integrações globais e defina OPENAI_API_KEY (embeddings usam a mesma chave).',
        },
        { status: 400 },
      );
    }
  } else {
    await deleteEmbeddingsForTeam(team.id);
  }

  await db
    .update(teams)
    .set({ taskflowSemanticSearchEnabled: enabled, updatedAt: new Date() })
    .where(eq(teams.id, team.id));

  return NextResponse.json({ taskflowSemanticSearchEnabled: enabled });
}
