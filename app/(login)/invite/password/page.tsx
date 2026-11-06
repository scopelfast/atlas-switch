import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invitations } from '@/lib/db/schema';
import { hashInviteOpaqueToken } from '@/lib/invites/invite-token';
import { syncInvitationExpiryOnAccess } from '@/lib/invites/sync-invitation-expiry';
import { InvitePasswordForm } from './invite-password-form';
import { AuthShellCard } from '@/components/shells/auth-shell';

/**
 * M2.3 — definir senha após confirmação do convite (M2.2).
 */
export default async function InvitePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token || token.length < 16) {
    redirect('/sign-in?inviteError=missing');
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

  if (inv.status !== 'activated') {
    redirect('/sign-in?inviteError=invalid');
  }

  return (
    <AuthShellCard>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Concluir convite
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          E-mail confirmado. Defina uma senha para aceder à plataforma (mínimo 8 caracteres). O nome
          indicado no convite será utilizado no seu perfil.
        </p>

        <InvitePasswordForm email={inv.email} invitedName={inv.invitedName} token={token} />

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Problemas com o link?{' '}
          <Link href="/forgot-password" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Recuperar senha
          </Link>{' '}
          só funciona para contas já criadas.
        </p>
    </AuthShellCard>
  );
}
