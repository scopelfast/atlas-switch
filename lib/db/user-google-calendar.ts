import { eq } from 'drizzle-orm';
import { openOAuthRefreshToken, sealOAuthRefreshToken } from '@/lib/crypto/oauth-refresh-token';
import { db } from '@/lib/db/drizzle';
import { userGoogleCalendarLinks } from '@/lib/db/schema';
import { refreshGoogleAccessToken } from '@/lib/google-calendar/oauth';

export async function getGoogleCalendarLink(userId: number) {
  const [row] = await db
    .select({
      googleEmail: userGoogleCalendarLinks.googleEmail,
      encryptedRefreshToken: userGoogleCalendarLinks.encryptedRefreshToken,
      updatedAt: userGoogleCalendarLinks.updatedAt,
    })
    .from(userGoogleCalendarLinks)
    .where(eq(userGoogleCalendarLinks.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertGoogleCalendarLink(
  userId: number,
  googleEmail: string | null,
  refreshTokenPlain: string,
): Promise<void> {
  const sealed = sealOAuthRefreshToken(refreshTokenPlain);
  await db
    .insert(userGoogleCalendarLinks)
    .values({
      userId,
      googleEmail,
      encryptedRefreshToken: sealed,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userGoogleCalendarLinks.userId,
      set: {
        googleEmail,
        encryptedRefreshToken: sealed,
        updatedAt: new Date(),
      },
    });
}

export async function deleteGoogleCalendarLink(userId: number): Promise<void> {
  await db.delete(userGoogleCalendarLinks).where(eq(userGoogleCalendarLinks.userId, userId));
}

export async function getGoogleCalendarAccessToken(userId: number): Promise<string> {
  const row = await getGoogleCalendarLink(userId);
  if (!row) {
    throw new Error('Google Calendar não ligado.');
  }
  const refreshPlain = openOAuthRefreshToken(row.encryptedRefreshToken);
  const { accessToken, refreshToken } = await refreshGoogleAccessToken(refreshPlain);
  if (refreshToken !== refreshPlain) {
    await upsertGoogleCalendarLink(userId, row.googleEmail ?? null, refreshToken);
  }
  return accessToken;
}
