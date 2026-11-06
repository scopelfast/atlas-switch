import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { platformSettings } from '@/lib/db/schema';
import { PLATFORM_SECRET_KEY_PREFIX } from '@/lib/db/platform-secrets';
import {
  isPlatformBooleanKey,
  PLATFORM_BOOLEAN_KEYS,
} from '@/lib/platform/platform-settings-constants';

export {
  isPlatformBooleanKey,
  PLATFORM_BOOLEAN_KEYS,
  PLATFORM_SETTING_LABELS,
  type PlatformBooleanKey,
} from '@/lib/platform/platform-settings-constants';

export async function ensurePlatformSettingsDefaults(): Promise<void> {
  for (const key of PLATFORM_BOOLEAN_KEYS) {
    const [row] = await db
      .select({ key: platformSettings.key })
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);
    if (!row) {
      await db.insert(platformSettings).values({ key, value: 'false' });
    }
  }
}

export async function listPlatformSettingsRows() {
  await ensurePlatformSettingsDefaults();
  const rows = await db.select().from(platformSettings).orderBy(asc(platformSettings.key));
  /** Chaves `secrets.*` não entram na resposta genérica (evita expor API keys no JSON). */
  return rows.filter((r) => !r.key.startsWith(PLATFORM_SECRET_KEY_PREFIX));
}

export async function setPlatformSetting(key: string, value: string): Promise<void> {
  if (!isPlatformBooleanKey(key)) {
    throw new Error('Chave de configuração inválida');
  }
  if (value !== 'true' && value !== 'false') {
    throw new Error('Valor deve ser "true" ou "false"');
  }
  await ensurePlatformSettingsDefaults();
  await db
    .update(platformSettings)
    .set({ value, updatedAt: new Date() })
    .where(eq(platformSettings.key, key));
}

export async function getPlatformSetting(key: string): Promise<string | null> {
  await ensurePlatformSettingsDefaults();
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}
