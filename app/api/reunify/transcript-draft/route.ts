import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teams } from '@/lib/db/schema';
import { runReunifyTranscriptPipeline } from '@/lib/ai/pipeline/reunify-transcript-pipeline';
import { TRANSCRIPT_DRAFT_MAX_CHARS } from '@/lib/reunify/transcript-draft-heuristic';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * E8.2 — propõe títulos de acções a partir de texto (heurística local; sem LLM).
 * E8.13 — resposta inclui `pipeline` (trâmites) para revisão humana / extensão futura.
 * Requer `teams.reunify_transcript_draft_enabled` e permissão `reunify.view`.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!hasPermission(normalizeRole(user.role), 'reunify.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const [row] = await db
    .select({ enabled: teams.reunifyTranscriptDraftEnabled })
    .from(teams)
    .where(eq(teams.id, team.id))
    .limit(1);

  if (!row?.enabled) {
    return NextResponse.json(
      { error: 'Função não activada para este time (opt-in em configurações).' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const transcript =
    typeof (body as { transcript?: unknown })?.transcript === 'string'
      ? (body as { transcript: string }).transcript
      : '';

  if (!transcript.trim()) {
    return NextResponse.json({ error: 'transcript é obrigatório' }, { status: 400 });
  }

  if (transcript.length > TRANSCRIPT_DRAFT_MAX_CHARS) {
    return NextResponse.json(
      { error: `Texto demasiado longo (máx. ${TRANSCRIPT_DRAFT_MAX_CHARS} caracteres).` },
      { status: 400 },
    );
  }

  const result = runReunifyTranscriptPipeline(transcript);

  return NextResponse.json({
    engine: result.engineLabel,
    disclaimer: result.disclaimer,
    proposals: result.proposals,
    pipeline: result.pipeline,
  });
}
