import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import {
  addTaskflowCloudAiUsage,
  getTaskflowCloudAiUsageRow,
  utcYearMonth,
} from '@/lib/db/taskflow-cloud-ai-usage';
import { teams } from '@/lib/db/schema';
import { checkTaskflowCloudAiUserRateLimit } from '@/lib/taskflow/cloud-ai-user-rate-limit';
import { runTaskflowCloudAiChat, type TaskflowCloudAiProviderId } from '@/lib/taskflow/cloud-llm';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

function isProvider(v: unknown): v is TaskflowCloudAiProviderId {
  return v === 'openai' || v === 'gemini';
}

/**
 * E8.11 — um turno de chat (texto → modelo). Respeita opt-in da equipa, toggles I8.4, quota mensal e rate limit por utilizador.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!hasPermission(normalizeRole(user.role), 'taskflow.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  if (!checkTaskflowCloudAiUserRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Muitos pedidos nesta hora. Tente novamente mais tarde.' },
      { status: 429 },
    );
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || typeof (body as { prompt?: unknown }).prompt !== 'string') {
    return NextResponse.json({ error: 'Indique { "prompt": "..." }.' }, { status: 400 });
  }

  const prompt = (body as { prompt: string }).prompt;

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
  const cap = teamRow?.cap ?? 100;

  if (!teamRow?.enabled) {
    return NextResponse.json({ error: 'A função está desligada para esta equipe.' }, { status: 400 });
  }

  if (!isProvider(teamRow.provider)) {
    return NextResponse.json({ error: 'Fornecedor não configurado para esta equipe.' }, { status: 400 });
  }

  const prov = teamRow.provider;

  const platformOpenai = (await getPlatformSetting('integrations.openai_api')) === 'true';
  const platformGemini = (await getPlatformSetting('integrations.google_gemini')) === 'true';
  const envOpenai = Boolean(process.env.OPENAI_API_KEY?.trim());
  const envGemini = Boolean(process.env.GEMINI_API_KEY?.trim());

  if (prov === 'openai' && (!platformOpenai || !envOpenai)) {
    return NextResponse.json({ error: 'OpenAI não está disponível nesta instância.' }, { status: 503 });
  }
  if (prov === 'gemini' && (!platformGemini || !envGemini)) {
    return NextResponse.json({ error: 'Gemini não está disponível nesta instância.' }, { status: 503 });
  }

  if (usage.requestCount >= cap) {
    return NextResponse.json({ error: 'Quota mensal de pedidos atingida.' }, { status: 429 });
  }

  try {
    const result = await runTaskflowCloudAiChat(prov, prompt);
    await addTaskflowCloudAiUsage(team.id, periodYm, {
      requests: 1,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    return NextResponse.json({
      text: result.text,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        periodYm,
        requestsAfter: usage.requestCount + 1,
        cap,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao contactar o modelo.';
    console.error('[POST /api/taskflow/cloud-ai/chat]', e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
