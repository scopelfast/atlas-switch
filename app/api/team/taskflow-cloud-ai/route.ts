import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teams } from '@/lib/db/schema';
import type { TaskflowCloudAiProviderId } from '@/lib/taskflow/cloud-llm';

function clampCap(n: number): number {
  if (!Number.isFinite(n)) return 100;
  return Math.min(10_000, Math.max(10, Math.floor(n)));
}

function isProvider(v: unknown): v is TaskflowCloudAiProviderId {
  return v === 'openai' || v === 'gemini';
}

/** E8.11 — opt-in, fornecedor e tecto mensal de pedidos (owner / admin / gestor). */
export async function PATCH(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  }

  const b = body as {
    enabled?: unknown;
    provider?: unknown;
    monthlyRequestCap?: unknown;
  };

  if (
    b.enabled === undefined &&
    b.provider === undefined &&
    b.monthlyRequestCap === undefined
  ) {
    return NextResponse.json(
      { error: 'Indique enabled, provider e/ou monthlyRequestCap.' },
      { status: 400 },
    );
  }

  const [current] = await db
    .select({
      enabled: teams.taskflowCloudAiEnabled,
      provider: teams.taskflowCloudAiProvider,
      cap: teams.taskflowCloudAiMonthlyRequestCap,
    })
    .from(teams)
    .where(eq(teams.id, team.id))
    .limit(1);

  let nextEnabled = current?.enabled ?? false;
  let nextProvider = (current?.provider ?? null) as TaskflowCloudAiProviderId | string | null;
  let nextCap = current?.cap ?? 100;

  if (typeof b.enabled === 'boolean') {
    nextEnabled = b.enabled;
    if (!b.enabled) {
      nextProvider = null;
    }
  }

  if (b.provider !== undefined) {
    if (b.provider === null) {
      nextProvider = null;
    } else if (isProvider(b.provider)) {
      nextProvider = b.provider;
    } else {
      return NextResponse.json(
        { error: 'Fornecedor inválido (use "openai" ou "gemini").' },
        { status: 400 },
      );
    }
  }

  if (typeof b.monthlyRequestCap === 'number') {
    nextCap = clampCap(b.monthlyRequestCap);
  }

  if (nextEnabled && !isProvider(nextProvider)) {
    return NextResponse.json(
      { error: 'Com a função ativa, indique um fornecedor: "openai" ou "gemini".' },
      { status: 400 },
    );
  }

  if (nextEnabled && isProvider(nextProvider)) {
    const platformOpenai = (await getPlatformSetting('integrations.openai_api')) === 'true';
    const platformGemini = (await getPlatformSetting('integrations.google_gemini')) === 'true';
    const envOpenai = Boolean(process.env.OPENAI_API_KEY?.trim());
    const envGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
    if (nextProvider === 'openai' && (!platformOpenai || !envOpenai)) {
      return NextResponse.json(
        {
          error:
            'OpenAI não está disponível: ative o toggle na página de integrações globais e defina OPENAI_API_KEY.',
        },
        { status: 400 },
      );
    }
    if (nextProvider === 'gemini' && (!platformGemini || !envGemini)) {
      return NextResponse.json(
        {
          error:
            'Gemini não está disponível: ative o toggle na página de integrações globais e defina GEMINI_API_KEY.',
        },
        { status: 400 },
      );
    }
  }

  await db
    .update(teams)
    .set({
      taskflowCloudAiEnabled: nextEnabled,
      taskflowCloudAiProvider: nextEnabled && isProvider(nextProvider) ? nextProvider : null,
      taskflowCloudAiMonthlyRequestCap: nextCap,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, team.id));

  const [out] = await db
    .select({
      taskflowCloudAiEnabled: teams.taskflowCloudAiEnabled,
      taskflowCloudAiProvider: teams.taskflowCloudAiProvider,
      taskflowCloudAiMonthlyRequestCap: teams.taskflowCloudAiMonthlyRequestCap,
    })
    .from(teams)
    .where(eq(teams.id, team.id))
    .limit(1);

  return NextResponse.json(out ?? {});
}
