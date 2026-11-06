import type { PipelineEnvelope, PipelineStepTrace } from '@/lib/ai/pipeline/types';
import {
  TRANSCRIPT_DRAFT_MAX_CHARS,
  transcriptToDraftProposals,
  type TranscriptDraftProposal,
} from '@/lib/reunify/transcript-draft-heuristic';

export type ReunifyTranscriptPipelineResult = {
  proposals: TranscriptDraftProposal[];
  engineLabel: string;
  disclaimer: string;
  pipeline: PipelineEnvelope;
};

function pushStep(steps: PipelineStepTrace[], step: PipelineStepTrace) {
  steps.push(step);
}

/**
 * Pipeline E8.2 → E8.13: normalização → heurística local (sem LLM).
 * Mesmo resultado que `transcriptToDraftProposals` após normalizar, com trâmites explícitos.
 */
export function runReunifyTranscriptPipeline(transcript: string): ReunifyTranscriptPipelineResult {
  const steps: PipelineStepTrace[] = [];
  const t0 = Date.now();

  const rawLen = typeof transcript === 'string' ? transcript.length : 0;
  const normalized = typeof transcript === 'string' ? transcript : '';
  pushStep(steps, {
    id: 'normalize_input',
    label: 'Normalizar entrada',
    status: 'ok',
    detail: `${rawLen} caracteres recebidos (limite ${TRANSCRIPT_DRAFT_MAX_CHARS}).`,
    durationMs: Date.now() - t0,
  });

  const t1 = Date.now();
  const proposals = transcriptToDraftProposals(normalized);
  pushStep(steps, {
    id: 'heuristic_extract',
    label: 'Extracção heurística (regras locais)',
    status: 'ok',
    detail: `${proposals.length} proposta(s) após filtros de linha.`,
    durationMs: Date.now() - t1,
  });

  pushStep(steps, {
    id: 'human_review_gate',
    label: 'Revisão humana obrigatória',
    status: 'ok',
    detail: 'Nenhuma gravação automática — o cliente Reunify continua a exigir confirmação.',
    durationMs: 0,
  });

  return {
    proposals,
    engineLabel: 'heuristic_v1',
    disclaimer:
      'Rascunho gerado por pipeline interno (heurística local, sem modelo de IA externo neste percurso). Revise antes de gravar.',
    pipeline: { version: '2026-04-17', steps },
  };
}

/** Garante idempotência da parte heurística (mesma entrada → mesma saída). */
export function assertReunifyTranscriptPipelineIdempotent(sample: string): void {
  const a = runReunifyTranscriptPipeline(sample);
  const b = runReunifyTranscriptPipeline(sample);
  if (JSON.stringify(a.proposals) !== JSON.stringify(b.proposals)) {
    throw new Error('Pipeline Reunify não é idempotente para o texto de teste.');
  }
  if (a.pipeline.steps.length !== b.pipeline.steps.length) {
    throw new Error('Trâmites do pipeline divergem entre execuções.');
  }
}
