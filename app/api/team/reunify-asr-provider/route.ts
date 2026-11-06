import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { isReunifyAsrProvider } from '@/lib/reunify/asr/reunify-asr-constants';
import { resolveAssemblyAiApiKey } from '@/lib/reunify/assemblyai-api-key';
import { teams } from '@/lib/db/schema';

/** E8.18 — define fornecedor ASR opcional para o time (none | assemblyai | vosk). */
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
  const raw =
    typeof body === 'object' && body !== null && typeof (body as { provider?: unknown }).provider === 'string'
      ? (body as { provider: string }).provider.trim()
      : '';
  if (!isReunifyAsrProvider(raw)) {
    return NextResponse.json(
      { error: 'Indique { "provider": "none" | "assemblyai" | "vosk" }' },
      { status: 400 },
    );
  }

  await db
    .update(teams)
    .set({ reunifyAsrProvider: raw, updatedAt: new Date() })
    .where(eq(teams.id, team.id));

  const warnings: string[] = [];
  if (raw === 'assemblyai' && !(await resolveAssemblyAiApiKey())) {
    warnings.push(
      'Chave AssemblyAI em falta: cadastre em Controle → Integrações globais (AssemblyAI). Valor na base aplica-se na hora; ASSEMBLYAI_API_KEY no servidor só após reiniciar o processo Node.',
    );
  }
  if (raw === 'vosk') {
    warnings.push(
      'Vosk offline não está integrado neste build — use worker próprio ou aguarde evolução (ver documentação E8.18).',
    );
  }

  return NextResponse.json({ reunifyAsrProvider: raw, warnings });
}
