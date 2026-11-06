'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2, Shield, Sparkles } from 'lucide-react';
import { signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';
import { AuthShellSplit } from '@/components/shells/auth-shell';

/**
 * Tela de autenticação (signin/signup) em português.
 */
export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  const inviteId = searchParams.get('inviteId');
  const passwordResetOk = searchParams.get('reset') === 'ok';
  const inviteError = searchParams.get('inviteError');
  const inviteErrorMessage =
    inviteError === 'invalid'
      ? 'Link de convite inválido ou incorreto.'
      : inviteError === 'expired'
        ? 'O link de convite expirou. Peça um novo convite a quem pode convidar no time.'
        : inviteError === 'used'
          ? 'Este convite já foi utilizado. Entre com a sua conta.'
          : inviteError === 'missing'
            ? 'O link de convite está incompleto.'
            : null;
  const toggleParams = new URLSearchParams();
  if (redirect) toggleParams.set('redirect', redirect);
  if (priceId) toggleParams.set('priceId', priceId);
  if (inviteId) toggleParams.set('inviteId', inviteId);
  const authToggleHref = `${
    mode === 'signin' ? '/sign-up' : '/sign-in'
  }${toggleParams.toString() ? `?${toggleParams.toString()}` : ''}`;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );
  const inputFieldClass =
    'relative block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100';

  const aside = (
    <div className="flex h-full min-h-[280px] flex-col rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-8 text-white shadow-xl ring-1 ring-white/10 sm:p-10">
      <div className="flex flex-wrap items-center gap-3">
        <img
          src="/logoSYS.png"
          width={200}
          height={48}
          alt="AtlasSwitch"
          className="h-10 w-auto"
        />
        <span className="text-xs uppercase tracking-[0.35em] text-indigo-200">AtlasSwitch</span>
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
        Operação integrada para a sua equipa
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        Módulos ligados (reunião → tarefa → tempo → custo), IA em camadas (local e opcional na nuvem) e
        permissões por equipa — sem confundir o seu painel com a administração global da instância.
      </p>

      <div className="mt-8 grid flex-1 gap-4">
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" />
          <div>
            <p className="text-sm font-semibold text-white">Operação inteligente</p>
            <p className="text-xs text-slate-300">
              Sugestões e insights com opt-in por equipa; dados sensíveis tratados com cuidado.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <p className="text-sm font-semibold text-white">Governança e auditoria</p>
            <p className="text-xs text-slate-300">
              Planos e limites do contrato da equipa, registo de atividade e finanças nos módulos que estiverem
              ativos.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <p className="text-sm font-semibold text-white">Módulos integrados</p>
            <p className="text-xs text-slate-300">
              Chronos, Taskflow, Projectus, BillTrak e mais — com ligações reais entre agenda, tarefas e
              reuniões.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-xs text-slate-400">
        Precisa de orientação?{' '}
        <Link href="/help" className="font-medium text-white underline underline-offset-4">
          Centro de ajuda e manuais
        </Link>
        .
      </div>
    </div>
  );

  return (
    <AuthShellSplit aside={aside}>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              {mode === 'signin' ? 'Entrar na sua conta' : 'Criar a sua conta'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {mode === 'signin'
                ? 'Bem-vindo de volta — os seus dados e equipa estão à espera.'
                : 'Convite ou registo livre: preencha os campos abaixo para continuar.'}
            </p>
          </div>

          <form className="space-y-6" action={formAction}>
            <input type="hidden" name="redirect" value={redirect || ''} />
            <input type="hidden" name="priceId" value={priceId || ''} />
            <input type="hidden" name="inviteId" value={inviteId || ''} />
            {mode === 'signin' && passwordResetOk && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                Senha redefinida com sucesso. Entre com a nova senha.
              </div>
            )}
            {mode === 'signin' && inviteErrorMessage && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
                {inviteErrorMessage}
              </div>
            )}
            <div>
              <Label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                E-mail
              </Label>
              <div className="mt-1">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={state.email}
                  required
                  maxLength={50}
                  className={inputFieldClass}
                  placeholder="Digite seu e-mail"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <Label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Nome completo
                </Label>
                <div className="mt-1">
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    defaultValue={state.name as string | undefined}
                    required
                    minLength={1}
                    maxLength={100}
                    className={inputFieldClass}
                    placeholder="Como deve aparecer em registos e listas"
                  />
                </div>
              </div>
            )}

            <div>
              <Label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Senha
              </Label>
              <div className="mt-1">
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete={
                    mode === 'signin' ? 'current-password' : 'new-password'
                  }
                  defaultValue={state.password}
                  required
                  minLength={8}
                  maxLength={100}
                  className={inputFieldClass}
                  placeholder="Digite sua senha"
                />
              </div>
            </div>

            {mode === 'signin' && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Esqueci minha senha
                </Link>
              </div>
            )}

            {state?.error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {state.error}
              </div>
            )}

            <div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A processar…
                  </>
                ) : mode === 'signin' ? (
                  'Entrar'
                ) : (
                  'Criar conta'
                )}
              </Button>
            </div>
          </form>

          <div className="mt-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white/90 px-2 text-slate-500 dark:bg-slate-950/90 dark:text-slate-400">
                  {mode === 'signin' ? 'Novo por aqui?' : 'Já tem uma conta?'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Button
                asChild
                variant="outline"
                className="w-full justify-center text-sm font-semibold"
              >
                <Link href={authToggleHref}>
                  {mode === 'signin' ? 'Criar uma conta' : 'Entrar na conta existente'}
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Encriptação em trânsito, sessões seguras e documentação alinhada ao produto
          </div>
    </AuthShellSplit>
  );
}
