import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invitations, type Invitation } from '@/lib/db/schema';
import { isInvitationPastEffectiveDeadline } from '@/lib/invites/invite-token';

export type InviteAccessGate = 'ok' | 'expired' | 'used';

/**
 * M2.4 — se o convite ultrapassou a data-limite (link ou janela pós-confirmação), marca `expired` e invalida o token.
 */
export async function syncInvitationExpiryOnAccess(inv: Invitation): Promise<InviteAccessGate> {
  if (inv.status === 'accepted') return 'used';
  if (inv.status === 'expired') return 'expired';
  if (!isInvitationPastEffectiveDeadline(inv)) return 'ok';

  await db
    .update(invitations)
    .set({ status: 'expired', tokenHash: null })
    .where(eq(invitations.id, inv.id));

  return 'expired';
}
