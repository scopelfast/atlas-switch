import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { platformSettings } from '@/lib/db/schema';

/** Prefixo reservado: nunca incluir em `listPlatformSettingsRows` (evita vazar no GET genérico). */
export const PLATFORM_SECRET_KEY_PREFIX = 'secrets.' as const;

export const ASSEMBLYAI_PLATFORM_SECRET_KEY = `${PLATFORM_SECRET_KEY_PREFIX}assemblyai_api_key`;

export async function getPlatformSecret(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  const v = row?.value?.trim();
  return v || null;
}

export async function setPlatformSecret(key: string, value: string): Promise<void> {
  const v = value.trim();
  if (!v) {
    throw new Error('Valor vazio');
  }
  const now = new Date();
  const [existing] = await db
    .select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  if (existing) {
    await db
      .update(platformSettings)
      .set({ value: v, updatedAt: now })
      .where(eq(platformSettings.key, key));
  } else {
    await db.insert(platformSettings).values({ key, value: v, updatedAt: now });
  }
}

export async function deletePlatformSecret(key: string): Promise<void> {
  await db.delete(platformSettings).where(eq(platformSettings.key, key));
}
