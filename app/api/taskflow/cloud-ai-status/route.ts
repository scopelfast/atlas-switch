import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowCloudAiUsageRow, utcYearMonth } from '@/lib/db/taskflow-cloud-ai-usage';
import { teams } from '@/lib/db/schema';
import type { TaskflowCloudAiProviderId } from '@/lib/taskflow/cloud-llm';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * E8.11 — estado agregado (sem segredos): opt-in da equipa, quota, toggles da instância, chaves só como booleanos.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!hasPermission(normalizeRole(user.role), 'taskflow.view')) {
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

  const [teamRow] = await db
    .select({
      enabled: teams.taskflowCloudAiEnabled,
      provider: teams.taskflowCloudAiProvider,
      cap: teams.taskflowCloudAiMonthlyRequestCap,
    })
    .from(teams)
    .where(eq(teams.id, team.id))
    .limit(1);

  const periodYm = utcYearMonth();
  const usage = await getTaskflowCloudAiUsageRow(team.id, periodYm);

  const platformOpenai = (await getPlatformSetting('integrations.openai_api')) === 'true';
  const platformGemini = (await getPlatformSetting('integrations.google_gemini')) === 'true';
  const envOpenai = Boolean(process.env.OPENAI_API_KEY?.trim());
  const envGemini = Boolean(process.env.GEMINI_API_KEY?.trim());

  const prov = (teamRow?.provider ?? null) as TaskflowCloudAiProviderId | null;
  const enabled = teamRow?.enabled ?? false;
  const cap = teamRow?.cap ?? 100;

  let ready = false;
  let blockReason: string | null = null;
  if (!enabled) {
    blockReason = 'A função está desligada para esta equipe.';
  } else if (prov !== 'openai' && prov !== 'gemini') {
    blockReason = 'Escolha um fornecedor (OpenAI ou Gemini) nas definições do quadro.';
  } else if (prov === 'openai' && (!platformOpenai || !envOpenai)) {
    blockReason =
      'OpenAI não está autorizado nesta instância ou falta configurar OPENAI_API_KEY no servidor.';
  } else if (prov === 'gemini' && (!platformGemini || !envGemini)) {
    blockReason =
      'Gemini não está autorizado nesta instância ou falta configurar GEMINI_API_KEY no servidor.';
  } else if (usage.requestCount >= cap) {
    blockReason = 'Atingiu o limite mensal de pedidos definido para a equipe.';
  } else {
    ready = true;
  }

  return NextResponse.json({
    periodYm,
    teamEnabled: enabled,
    provider: prov,
    monthlyRequestCap: cap,
    usage: {
      requests: usage.requestCount,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    },
    platform: { openai: platformOpenai, gemini: platformGemini },
    envConfigured: { openai: envOpenai, gemini: envGemini },
    ready,
    blockReason,
  });
}
