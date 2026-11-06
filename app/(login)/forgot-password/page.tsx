'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
import { requestPasswordReset } from '@/app/(login)/actions';
import { ActionState } from '@/lib/auth/middleware';
import { AuthShellCard } from '@/components/shells/auth-shell';

type ForgotState = ActionState & { resetUrl?: string };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(
    requestPasswordReset,
    {},
  );

  const inputClass =
    'mt-1 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100';

  return (
    <AuthShellCard>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Recuperar acesso
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Indique o e-mail da conta. Se existir, enviamos um link seguro (cerca de 1 hora). Sem SMTP no
              servidor, o link aparece aqui para copiar.
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Nunca pedimos a senha por e-mail — só um link para definir uma nova.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            O mesmo fluxo protege convites e redefinições.
          </li>
        </ul>

        <form action={formAction} className="mt-8 space-y-6">
          <div>
            <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              E-mail
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
              placeholder="seu@email.com"
            />
          </div>

          {state?.error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              {state.success}
            </div>
          )}

          {state?.resetUrl && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="mb-2 font-medium">Link (ambiente sem SMTP):</p>
              <input
                type="text"
                readOnly
                value={state.resetUrl}
                className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-slate-800 dark:border-amber-700 dark:bg-slate-950 dark:text-slate-200"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A enviar…
              </>
            ) : (
              'Enviar instruções'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/sign-in" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Voltar ao início de sessão
          </Link>
        </p>
    </AuthShellCard>
  );
}
