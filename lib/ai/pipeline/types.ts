/** E8.13 — trâmites de pipeline (revisão humana / auditoria). */

export type PipelineStepStatus = 'ok' | 'skipped' | 'error';

export type PipelineStepTrace = {
  id: string;
  label: string;
  status: PipelineStepStatus;
  /** Texto curto para operador (sem dados sensíveis longos). */
  detail?: string;
  durationMs?: number;
};

export type PipelineEnvelope = {
  /** Versão do contrato de serialização do pipeline. */
  version: string;
  steps: PipelineStepTrace[];
};
