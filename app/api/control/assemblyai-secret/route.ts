import { NextResponse } from 'next/server';
import { ASSEMBLYAI_PLATFORM_SECRET_KEY, deletePlatformSecret, setPlatformSecret } from '@/lib/db/platform-secrets';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { getUser } from '@/lib/db/queries';
import {
  assemblyAiKeyStoredInDatabase,
  resolveAssemblyAiApiKey,
  sanitizeAssemblyAiApiKeyInput,
} from '@/lib/reunify/assemblyai-api-key';

async function ensureControl() {
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  }
  if (!canAccessControlPlane(user)) {
    return { error: NextResponse.json({ error: 'Acesso restrito' }, { status: 403 }) };
  }
  return { user };
}

/**
 * Estado da chave AssemblyAI (Reunify): nunca devolve o segredo completo.
 */
export async function GET() {
  const auth = await ensureControl();
  if (auth.error) return auth.error;

  const inDb = await assemblyAiKeyStoredInDatabase();
  const hasEnv = Boolean(process.env.ASSEMBLYAI_API_KEY?.trim());
  const usable = Boolean(await resolveAssemblyAiApiKey());

  return NextResponse.json({
    storedInDatabase: inDb,
    hasEnvFallback: hasEnv,
    transcriptionReady: usable,
  });
}

/**
 * Grava ou remove a chave AssemblyAI na tabela `platform_settings` (chave reservada `secrets.*`).
 */
export async function PATCH(request: Request) {
  const auth = await ensureControl();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const clear = (body as { clear?: unknown }).clear === true;
  if (clear) {
    await deletePlatformSecret(ASSEMBLYAI_PLATFORM_SECRET_KEY);
    return NextResponse.json({ ok: true, storedInDatabase: false });
  }

  const rawKey =
    typeof (body as { apiKey?: unknown }).apiKey === 'string' ? (body as { apiKey: string }).apiKey : '';
  const apiKey = sanitizeAssemblyAiApiKeyInput(rawKey);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Indique { "apiKey": "…" } ou { "clear": true } para remover o cadastro na base.' },
      { status: 400 },
    );
  }

  try {
    await setPlatformSecret(ASSEMBLYAI_PLATFORM_SECRET_KEY, apiKey);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao gravar';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true, storedInDatabase: true });
}
