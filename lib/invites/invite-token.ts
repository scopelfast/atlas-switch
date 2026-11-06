import { createHash, randomBytes } from 'node:crypto';

/** Prazo do link de convite (dias). Configurável por `INVITE_LINK_TTL_DAYS` (M2.1). */
export const INVITE_LINK_TTL_DAYS = (() => {
  const n = Number(process.env.INVITE_LINK_TTL_DAYS);
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(365, Math.floor(n));
})();

export function hashInviteOpaqueToken(raw: string) {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function generateInviteOpaqueToken() {
  return randomBytes(32).toString('hex');
}

export function inviteTokenExpiresAt() {
  return new Date(Date.now() + INVITE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * M2.4 — após `activated` (e-mail confirmado), quanto tempo para definir senha (pré-def.: 30 dias).
 * Administrador/proprietário não precisa deste passo; aplica-se ao convidado.
 */
export const INVITE_ACTIVATED_TO_PASSWORD_DAYS = (() => {
  const n = Number(process.env.INVITE_ACTIVATED_TO_PASSWORD_DAYS);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(365, Math.floor(n));
})();

type InvitationDeadlineFields = {
  tokenExpiresAt: Date | string | null | undefined;
  activatedAt: Date | string | null | undefined;
  status: string;
};

/** Data-limite mais restritiva: expiração do link OU prazo pós-confirmação de e-mail. */
export function invitationEffectiveDeadline(inv: InvitationDeadlineFields): Date | null {
  const candidates: number[] = [];
  if (inv.tokenExpiresAt) {
    const t = new Date(inv.tokenExpiresAt).getTime();
    if (!Number.isNaN(t)) candidates.push(t);
  }
  if (inv.status === 'activated' && inv.activatedAt) {
    const a = new Date(inv.activatedAt).getTime();
    if (!Number.isNaN(a)) {
      candidates.push(
        a + INVITE_ACTIVATED_TO_PASSWORD_DAYS * 24 * 60 * 60 * 1000,
      );
    }
  }
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates));
}

export function isInvitationPastEffectiveDeadline(inv: InvitationDeadlineFields): boolean {
  const d = invitationEffectiveDeadline(inv);
  if (!d) return false;
  return Date.now() > d.getTime();
}
