'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Lock, Trash2, Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { updatePassword, deleteAccount } from '@/app/(login)/actions';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleHeader } from '@/components/ui/module-header';
import { hasPermission, isOwnerLike, type Role } from '@/lib/auth/permissions';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type PasswordState = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  error?: string;
  success?: string;
};

type DeleteState = {
  password?: string;
  error?: string;
  success?: string;
};

export default function SecurityPage() {
  const [passwordState, passwordAction, isPasswordPending] = useActionState<
    PasswordState,
    FormData
  >(updatePassword, {});

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    DeleteState,
    FormData
  >(deleteAccount, {});
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const role = (user?.role || 'member') as Role;
  const canView = hasPermission(role, 'security.view');
  const passwordInputClass =
    'relative block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100';

  /**
   * Dicas personalizadas conforme perfil do usuário.
   */
  const helpTips =
    isOwnerLike(role)
      ? [
          'Troque senhas periodicamente para reduzir riscos.',
          'Revise acessos do time após mudanças internas.',
        ]
      : [
          'Mantenha sua senha forte e não compartilhe.',
          'Em caso de suspeita, avise o gestor imediatamente.',
        ];

  if (user && !canView) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Apenas proprietários do time podem alterar configurações de
              segurança.
            </p>
          </CardContent>
        </Card>
        <div className="mt-6">
          <HelpPanel
            title="Ajuda rápida"
            description="Mantenha sua conta protegida com boas práticas."
            tips={helpTips}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <ModuleHeader
            title="Segurança"
            description="Gerencie senhas e proteção da conta."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline">
            <Link href="/manual/security">Manual</Link>
          </Button>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
            <CardHeader>
              <CardTitle>Senha</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" action={passwordAction}>
                <div>
                  <Label htmlFor="current-password" className="mb-2">
                    Senha atual
                  </Label>
                  <PasswordInput
                    id="current-password"
                    name="currentPassword"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    maxLength={100}
                    defaultValue={passwordState.currentPassword}
                  className={passwordInputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="new-password" className="mb-2">
                    Nova senha
                  </Label>
                  <PasswordInput
                    id="new-password"
                    name="newPassword"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={100}
                    defaultValue={passwordState.newPassword}
                  className={passwordInputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password" className="mb-2">
                    Confirmar nova senha
                  </Label>
                  <PasswordInput
                    id="confirm-password"
                    name="confirmPassword"
                    required
                    minLength={8}
                    maxLength={100}
                    defaultValue={passwordState.confirmPassword}
                  className={passwordInputClass}
                  />
                </div>
                {passwordState.error && (
                  <p className="text-red-500 text-sm">{passwordState.error}</p>
                )}
                {passwordState.success && (
                  <p className="text-green-500 text-sm">{passwordState.success}</p>
                )}
                <Button type="submit" className="w-full sm:w-auto" disabled={isPasswordPending}>
                  {isPasswordPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Atualizar senha
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Excluir conta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              A exclusão é definitiva. Tenha certeza antes de continuar.
            </p>
            <form action={deleteAction} className="space-y-4">
              <div>
                <Label htmlFor="delete-password" className="mb-2">
                  Confirmar senha
                </Label>
                <PasswordInput
                  id="delete-password"
                  name="password"
                  required
                  minLength={8}
                  maxLength={100}
                  defaultValue={deleteState.password}
                  className={passwordInputClass}
                />
              </div>
              {deleteState.error && (
                <p className="text-red-500 text-sm">{deleteState.error}</p>
              )}
              <Button type="submit" variant="destructive" className="w-full sm:w-auto" disabled={isDeletePending}>
                {isDeletePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir conta
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Mantenha sua conta protegida com boas práticas."
          tips={helpTips}
        />
      </div>
    </section>
  );
}
