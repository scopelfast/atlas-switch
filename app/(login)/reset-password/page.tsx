'use client';

import Link from 'next/link';
import { Suspense, useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { resetPasswordWithToken } from '@/app/(login)/actions';
import { ActionState } from '@/lib/auth/middleware';
import { AuthShellCard } from '@/components/shells/auth-shell';

type ResetState = ActionState & { token?: string };

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [state, formAction, pending] = useActionState<ResetState, FormData>(
    resetPasswordWithToken,
    {},
  );

  if (!tokenFromUrl) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
        Link inválido ou incompleto.{' '}
        <Link href="/forgot-password" className="font-medium underline">
          Pedir nova redefinição
        </Link>
        .
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <input type="hidden" name="token" value={tokenFromUrl} />

      <div>
        <Label htmlFor="password" className="text-sm font-medium text-slate-700">
          Nova senha
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={100}
          className="mt-1 rounded-2xl border-slate-200"
        />
      </div>

      <div>
        <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
          Confirmar nova senha
        </Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={100}
          className="mt-1 rounded-2xl border-slate-200"
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
            A guardar…
          </>
        ) : (
          'Definir nova senha'
        )}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShellCard>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Definir nova senha
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Escolha uma senha forte (mínimo 8 caracteres). Evite reutilizar a mesma palavra-passe de
          outros serviços.
        </p>

        <Suspense
          fallback={
            <p className="mt-8 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
            </p>
          }
        >
          <ResetPasswordForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/sign-in" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Voltar ao início de sessão
          </Link>
        </p>
    </AuthShellCard>
  );
}
