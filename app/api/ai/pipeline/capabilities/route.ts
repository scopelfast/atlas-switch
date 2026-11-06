import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';

/**
 * E8.13 — capacidades declaradas do pipeline interno (sem segredos).
 * Útil para UI ou integrações; não substitui toggles por equipa (E8.2/E8.3).
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  return NextResponse.json({
    version: '2026-04-17',
    pipelines: {
      reunify_transcript: {
        description: 'Texto / transcrição → propostas de acções (heurística local).',
        steps: ['normalize_input', 'heuristic_extract', 'human_review_gate'],
        optionalCloudRefine: 'Equipa com E8.11 pode usar modelo na nuvem noutro fluxo (chat).',
      },
      taskflow_assist: {
        description: 'Quadro → sugestões de prioridade e carga (heurísticas locais).',
        steps: ['load_team_context', 'heuristic_assist', 'human_review_gate'],
        traceQuery: 'GET /api/taskflow/assist-suggestions?trace=1',
      },
    },
    engines: ['heuristic_v1', 'cloud_optional_e8_11'],
    note: 'LangChain / LlamaIndex ficam como evolução documentada em ADR-0005.',
  });
}
