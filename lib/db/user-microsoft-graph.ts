import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { userMicrosoftGraphLinks } from '@/lib/db/schema';
import { openMicrosoftRefreshToken, sealMicrosoftRefreshToken } from '@/lib/microsoft-graph/token-crypto';
import { refreshMicrosoftAccessToken } from '@/lib/microsoft-graph/oauth';

export async function getMicrosoftGraphLink(userId: number) {
  const [row] = await db
    .select({
      graphEmail: userMicrosoftGraphLinks.graphEmail,
      encryptedRefreshToken: userMicrosoftGraphLinks.encryptedRefreshToken,
      updatedAt: userMicrosoftGraphLinks.updatedAt,
    })
    .from(userMicrosoftGraphLinks)
    .where(eq(userMicrosoftGraphLinks.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertMicrosoftGraphLink(
  userId: number,
  graphEmail: string | null,
  refreshTokenPlain: string,
): Promise<void> {
  const sealed = sealMicrosoftRefreshToken(refreshTokenPlain);
  await db
    .insert(userMicrosoftGraphLinks)
    .values({
      userId,
      graphEmail,
      encryptedRefreshToken: sealed,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userMicrosoftGraphLinks.userId,
      set: {
        graphEmail,
        encryptedRefreshToken: sealed,
        updatedAt: new Date(),
      },
    });
}

export async function deleteMicrosoftGraphLink(userId: number): Promise<void> {
  await db.delete(userMicrosoftGraphLinks).where(eq(userMicrosoftGraphLinks.userId, userId));
}

/** Obtém access token válido (renova com refresh token quando necessário). */
export async function getMicrosoftGraphAccessToken(userId: number): Promise<string> {
  const row = await getMicrosoftGraphLink(userId);
  if (!row) {
    throw new Error('Conta Microsoft não ligada.');
  }
  const refreshPlain = openMicrosoftRefreshToken(row.encryptedRefreshToken);
  const { accessToken, refreshToken } = await refreshMicrosoftAccessToken(refreshPlain);
  if (refreshToken !== refreshPlain) {
    await upsertMicrosoftGraphLink(userId, row.graphEmail ?? null, refreshToken);
  }
  return accessToken;
}
