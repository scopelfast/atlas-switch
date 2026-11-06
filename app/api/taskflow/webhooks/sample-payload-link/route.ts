import { NextResponse } from 'next/server';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { signWebhookSamplePayloadToken } from '@/lib/taskflow/webhook-sample-payload-token';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

function baseUrl(): string {
  return (process.env.BASE_URL || 'http://localhost:3003').replace(/\/$/, '');
}

/**
 * E8.14 — gera URL assinada (24 h) para obter JSON de exemplo de webhook (Zapier / Make).
 */
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

  try {
    const token = await signWebhookSamplePayloadToken(team.id);
    const url = `${baseUrl()}/api/taskflow/webhooks/sample-payload?token=${encodeURIComponent(token)}`;
    return NextResponse.json({
      url,
      expiresInHours: 24,
      hint: 'Use em Zapier/Make com pedido GET server-side; não exponha em páginas públicas.',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao gerar token';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
