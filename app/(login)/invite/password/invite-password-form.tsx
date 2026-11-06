'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { completeInvitedSignUp } from '@/app/(login)/actions';
import { ActionState } from '@/lib/auth/middleware';

type State = ActionState & { token?: string };

export function InvitePasswordForm(props: {
  email: string;
  invitedName: string | null;
  token: string;
}) {
  const { email, invitedName, token } = props;
  const [state, formAction, pending] = useActionState<State, FormData>(completeInvitedSignUp, {});

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <input type="hidden" name="token" value={token} />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200">
        <p>
          <span className="font-medium">E-mail:</span> {email}
        </p>
        {invitedName?.trim() ? (
          <p className="mt-1">
            <span className="font-medium">Nome:</span> {invitedName.trim()}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Definir senha
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={100}
          className="mt-1 rounded-2xl border-slate-200 dark:border-slate-600"
        />
      </div>

      <div>
        <Label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Confirmar senha
        </Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={100}
          className="mt-1 rounded-2xl border-slate-200 dark:border-slate-600"
        />
      </div>

      {state?.error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {state.error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            A criar conta…
          </>
        ) : (
          'Concluir e entrar'
        )}
      </Button>

      <p className="text-center text-sm text-slate-500">
        <Link href="/sign-in" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
