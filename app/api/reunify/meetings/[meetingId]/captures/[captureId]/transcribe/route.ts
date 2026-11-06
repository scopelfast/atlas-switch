import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { runReunifyTranscriptPipeline } from '@/lib/ai/pipeline/reunify-transcript-pipeline';
import { getReunifyMeetingCapture } from '@/lib/db/reunify-meeting-captures';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { resolveAssemblyAiApiKey } from '@/lib/reunify/assemblyai-api-key';
import { transcribeBufferWithAssemblyAi } from '@/lib/reunify/asr/assemblyai-transcribe';
import { checkReunifyAsrTranscribeRateLimit } from '@/lib/reunify/asr-transcribe-rate-limit';
import { REUNIFY_CAPTURE_UPLOAD_DIR } from '@/lib/reunify/capture-upload';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ meetingId: string; captureId: string }> };

/**
 * E8.18 — transcreve um upload de captação (UPLOAD) conforme `teams.reunify_asr_provider`.
 * Opcionalmente aplica a heurística E8.2 (`applyHeuristic` predef.: true).
 */
export async function POST(request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!hasPermission(normalizeRole(user.role), 'reunify.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  if (!checkReunifyAsrTranscribeRateLimit(user.id)) {
    return NextResponse.json({ error: 'Limite de transcrições por hora atingido.' }, { status: 429 });
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

  const provider = team.reunifyAsrProvider || 'none';
  if (provider === 'none') {
    return NextResponse.json(
      { error: 'O administrador ainda não activou um fornecedor ASR para este time.' },
      { status: 403 },
    );
  }
  if (provider === 'vosk') {
    return NextResponse.json(
      {
        error:
          'Vosk offline não está disponível nesta instância. Use AssemblyAI ou configure um worker Vosk (ver Projeto/E8.18-asr-lgpd.md).',
      },
      { status: 501 },
    );
  }

  if (provider === 'assemblyai' && !(await resolveAssemblyAiApiKey())) {
    return NextResponse.json(
      {
        error: 'Chave AssemblyAI não configurada.',
        code: 'ASSEMBLYAI_KEY_MISSING',
        hint:
          'Cadastre a chave em Controle → Integrações globais (AssemblyAI). O valor na base aplica-se de imediato, sem reiniciar o servidor. Só se usar ASSEMBLYAI_API_KEY no ambiente é que precisa de reiniciar o processo Node após alterar essa variável.',
      },
      { status: 503 },
    );
  }

  const meetingId = Number((await context.params).meetingId);
  const captureId = Number((await context.params).captureId);
  if (!meetingId || !captureId) {
    return NextResponse.json({ error: 'Identificadores inválidos' }, { status: 400 });
  }

  const cap = await getReunifyMeetingCapture(team.id, captureId);
  if (!cap || cap.meetingId !== meetingId || cap.kind !== 'UPLOAD' || !cap.storedPath) {
    return NextResponse.json({ error: 'Só é possível transcrever ficheiros carregados (upload).' }, { status: 400 });
  }

  let applyHeuristic = true;
  try {
    const j = await request.json().catch(() => ({}));
    if (typeof (j as { applyHeuristic?: unknown }).applyHeuristic === 'boolean') {
      applyHeuristic = (j as { applyHeuristic: boolean }).applyHeuristic;
    }
  } catch {
    /* corpo vazio → predefinição */
  }

  const diskPath = path.join(REUNIFY_CAPTURE_UPLOAD_DIR, cap.storedPath.split('/').join(path.sep));
  let buffer: Buffer;
  try {
    buffer = await readFile(diskPath);
  } catch {
    return NextResponse.json({ error: 'Ficheiro em falta no servidor' }, { status: 404 });
  }

  const asrSteps: { id: string; label: string; status: 'ok' | 'error'; detail: string; durationMs: number }[] = [];
  const t0 = Date.now();
  let text: string;
  try {
    if (provider === 'assemblyai') {
      const r = await transcribeBufferWithAssemblyAi(buffer);
      text = r.text;
      asrSteps.push({
        id: 'assemblyai_transcribe',
        label: 'AssemblyAI — transcrição',
        status: 'ok',
        detail: `${text.length} caracteres`,
        durationMs: Date.now() - t0,
      });
    } else {
      return NextResponse.json({ error: 'Fornecedor ASR não suportado.' }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro na transcrição';
    asrSteps.push({
      id: 'assemblyai_transcribe',
      label: 'AssemblyAI — transcrição',
      status: 'error',
      detail: msg,
      durationMs: Date.now() - t0,
    });
    return NextResponse.json(
      {
        error: msg,
        code: 'ASSEMBLYAI_TRANSCRIBE_FAILED',
        hint:
          'Isto não é falta de reinício: a chave na base é lida em cada pedido. Verifique a mensagem acima (chave inválida, quota, formato de áudio ou rede/firewall).',
        pipeline: { version: 'e8.18', steps: asrSteps },
      },
      { status: 502 },
    );
  }

  if (!applyHeuristic) {
    return NextResponse.json({
      transcript: text,
      engine: 'assemblyai_raw',
      disclaimer:
        'Texto bruto da AssemblyAI. Revise antes de usar; pode colar em «Rascunho a partir de texto» para extrair acções.',
      pipeline: { version: 'e8.18', steps: asrSteps },
    });
  }

  let heur: ReturnType<typeof runReunifyTranscriptPipeline>;
  try {
    heur = runReunifyTranscriptPipeline(text);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro no pipeline local após transcrição';
    return NextResponse.json(
      {
        error: msg,
        code: 'REUNIFY_HEURISTIC_FAILED',
        hint: 'A AssemblyAI já devolveu texto; falhou a heurística local. Tente transcrever com «apenas texto bruto» (applyHeuristic: false) se a opção estiver disponível.',
        transcript: text,
        pipeline: { version: 'e8.18', steps: asrSteps },
      },
      { status: 500 },
    );
  }
  const mergedSteps = [...asrSteps, ...heur.pipeline.steps];

  return NextResponse.json({
    transcript: text,
    engine: `${heur.engineLabel}+assemblyai`,
    disclaimer: `${heur.disclaimer} Transcrição via AssemblyAI (áudio enviado a terceiros conforme política do time).`,
    proposals: heur.proposals,
    pipeline: { version: 'e8.18+heuristic', steps: mergedSteps },
  });
}
