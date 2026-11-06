import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invitations } from '@/lib/db/schema';
import { hashInviteOpaqueToken } from '@/lib/invites/invite-token';
import { syncInvitationExpiryOnAccess } from '@/lib/invites/sync-invitation-expiry';

/**
 * M2.2 — abrir o link confirma o e-mail (`pending` → `activated`) e encaminha para definir senha (M2.3).
 */
export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token || token.length < 16) {
    redirect('/sign-in?inviteError=invalid');
  }

  const th = hashInviteOpaqueToken(token);
  const [inv] = await db.select().from(invitations).where(eq(invitations.tokenHash, th)).limit(1);

  if (!inv) {
    redirect('/sign-in?inviteError=invalid');
  }

  const gate = await syncInvitationExpiryOnAccess(inv);
  if (gate === 'expired') {
    redirect('/sign-in?inviteError=expired');
  }
  if (gate === 'used') {
    redirect('/sign-in?inviteError=used');
  }

  if (inv.status === 'pending') {
    await db
      .update(invitations)
      .set({ status: 'activated', activatedAt: new Date() })
      .where(eq(invitations.id, inv.id));
  }

  redirect(`/invite/password?token=${encodeURIComponent(token)}`);
}
