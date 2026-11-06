import type { PipelineEnvelope, PipelineStepTrace } from '@/lib/ai/pipeline/types';
import type { TaskflowAssistSuggestionsPayload } from '@/lib/db/taskflow-assist-suggestions';

/**
 * E8.3 → E8.13 — envolve o payload existente com trâmites lógicos (sem alterar cálculos).
 */
export function wrapTaskflowAssistWithPipeline(
  payload: TaskflowAssistSuggestionsPayload,
  opts?: { loadMs?: number; computeMs?: number },
): TaskflowAssistSuggestionsPayload & { pipeline: PipelineEnvelope } {
  const steps: PipelineStepTrace[] = [];
  const tLoad = opts?.loadMs ?? 0;
  steps.push({
    id: 'load_team_context',
    label: 'Carregar contexto do quadro (visibilidade M6.8)',
    status: 'ok',
    detail: 'Dados agregados para o utilizador e o time.',
    durationMs: tLoad,
  });
  const tCompute = opts?.computeMs ?? 0;
  steps.push({
    id: 'heuristic_assist',
    label: 'Heurísticas de prioridade e carga',
    status: 'ok',
    detail: `${payload.prioritySuggestions.length} sugestão(ões) de prioridade; ${payload.reassignSuggestions.length} de redistribuição.`,
    durationMs: tCompute,
  });
  steps.push({
    id: 'human_review_gate',
    label: 'Aplicação manual no quadro',
    status: 'ok',
    detail: 'O utilizador decide se altera tarefas no Taskflow.',
    durationMs: 0,
  });

  return {
    ...payload,
    pipeline: { version: '2026-04-17', steps },
  };
}
