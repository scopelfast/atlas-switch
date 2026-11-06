/** Códigos estáveis para o cliente mostrar UI específica (sem depender do texto da mensagem). */
export const InterventionErrorCode = {
  OVERLAP_CLOSED: 'INTERVENTION_OVERLAP_CLOSED',
  OVERLAP_TIMER: 'INTERVENTION_OVERLAP_TIMER',
} as const;

export type InterventionErrorCode =
  (typeof InterventionErrorCode)[keyof typeof InterventionErrorCode];

export class InterventionBusinessError extends Error {
  readonly code: InterventionErrorCode;

  constructor(code: InterventionErrorCode, message: string) {
    super(message);
    this.name = 'InterventionBusinessError';
    this.code = code;
  }
}

export function isInterventionBusinessError(e: unknown): e is InterventionBusinessError {
  return e instanceof InterventionBusinessError;
}

/** Texto amigável para o painel (título + corpo); não expor o raw técnico nos casos de conflito. */
export function interventionPanelErrorFeedbackFromApiJson(j: {
  error?: unknown;
  code?: unknown;
}): { title?: string; message: string } {
  const code = typeof j.code === 'string' ? j.code : '';
  const errText = typeof j.error === 'string' ? j.error : '';

  if (code === InterventionErrorCode.OVERLAP_TIMER || errText.includes('timer em curso')) {
    return {
      title: 'Conflito com o timer',
      message:
        'Há uma sessão de timer em curso que cruza com este período. Encerre a intervenção no bloco «Intervenção com timer» acima ou defina início e fim fora dessa sessão.',
    };
  }
  if (code === InterventionErrorCode.OVERLAP_CLOSED || errText.includes('Já existe um apontamento')) {
    return {
      title: 'Horário em conflito',
      message:
        'Neste intervalo já existe um registo seu (intervenção manual ou timer já encerrado). Ajuste as datas ou edite o registo em «Histórico recente» abaixo.',
    };
  }
  return { message: errText || 'Não foi possível concluir a operação.' };
}
