import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import {
  ensurePlatformSettingsDefaults,
  isPlatformBooleanKey,
  listPlatformSettingsRows,
  PLATFORM_SETTING_LABELS,
  setPlatformSetting,
} from '@/lib/db/platform-settings';

const ensureControl = async () => {
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  }
  if (!canAccessControlPlane(user)) {
    return { error: NextResponse.json({ error: 'Acesso restrito' }, { status: 403 }) };
  }
  return { user };
};

/**
 * I8.4 — parâmetros globais da instância (toggles não secretos). Segredos: apenas `.env`.
 */
export async function GET() {
  const auth = await ensureControl();
  if (auth.error) return auth.error;

  try {
    await ensurePlatformSettingsDefaults();
    const rows = await listPlatformSettingsRows();
    const hints = Object.fromEntries(
      Object.entries(PLATFORM_SETTING_LABELS).map(([k, v]) => [k, v.envVars]),
    );
    return NextResponse.json({ settings: rows, envVarHints: hints });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao carregar configurações';
    console.error('[GET /api/control/platform-settings]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await ensureControl();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const key = typeof (body as { key?: unknown }).key === 'string' ? (body as { key: string }).key.trim() : '';
  const value =
    typeof (body as { value?: unknown }).value === 'string' ? (body as { value: string }).value.trim() : '';

  if (!key || !isPlatformBooleanKey(key)) {
    return NextResponse.json({ error: 'Chave inválida' }, { status: 400 });
  }

  try {
    await setPlatformSetting(key, value);
    const rows = await listPlatformSettingsRows();
    return NextResponse.json({ ok: true, settings: rows });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao gravar';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
