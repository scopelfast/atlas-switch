'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, UploadCloud, X } from 'lucide-react';
import { updateAccount } from '@/app/(login)/actions';
import { User } from '@/lib/db/schema';
import useSWR, { mutate } from 'swr';
import { Suspense } from 'react';
import { HelpPanel } from '@/components/ui/help-panel';
import { ModuleHeader } from '@/components/ui/module-header';
import {
  getRoleDisplayLabel,
  hasPermission,
  isOwnerLike,
  type Role,
} from '@/lib/auth/permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ActionState = {
  name?: string;
  error?: string;
  success?: string;
};

type AccountFormProps = {
  state: ActionState;
  nameValue?: string;
  emailValue?: string;
};

function AccountForm({
  state,
  nameValue = '',
  emailValue = ''
}: AccountFormProps) {
  return (
    <>
      <div>
        <Label htmlFor="name" className="mb-2">
          Nome
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="Digite seu nome"
          defaultValue={state.name || nameValue}
          required
        />
      </div>
      <div>
        <Label htmlFor="email" className="mb-2">
          E-mail
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="Digite seu e-mail"
          defaultValue={emailValue}
          required
        />
      </div>
    </>
  );
}

function AccountFormWithData({ state }: { state: ActionState }) {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  return (
    <AccountForm
      state={state}
      nameValue={user?.name ?? ''}
      emailValue={user?.email ?? ''}
    />
  );
}

export default function GeneralPage() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateAccount,
    {}
  );
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const role = (user?.role || 'member') as Role;
  const canView = hasPermission(role, 'general.view');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);

  /**
   * Dicas personalizadas conforme perfil do usuário.
   */
  const helpTips =
    isOwnerLike(role)
      ? [
          'Defina dados oficiais do time para manter o padrão.',
          'Atualize e-mails sempre que houver troca de responsáveis.',
        ]
      : [
          'Consulte o gestor para alterar dados do time.',
          'Mantenha seu e-mail correto para recuperar o acesso.',
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
              Apenas proprietários do time podem alterar estas configurações.
            </p>
          </CardContent>
        </Card>
        <div className="mt-6">
          <HelpPanel
            title="Ajuda rápida"
            description="Atualize seus dados básicos com segurança."
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
            title="Configurações gerais"
            description="Atualize informações principais da conta."
            className="w-full"
          />
        </div>
        <div className="flex items-start justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/manual/general">Manual</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Dados da conta</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" action={formAction}>
              <Suspense fallback={<AccountForm state={state} />}>
                <AccountFormWithData state={state} />
              </Suspense>
              {state.error && (
                <p className="text-red-500 text-sm">{state.error}</p>
              )}
              {state.success && (
                <p className="text-green-500 text-sm">{state.success}</p>
              )}
              <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar alterações'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Avatar do usuário</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage
                  alt={user?.name || user?.email || ''}
                  src={
                    user?.avatarUrl ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      user?.name || user?.email || 'Atlas',
                    )}`
                  }
                />
                <AvatarFallback>{(user?.name || 'U').slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {user?.name || 'Usuário'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PNG ou JPG até 2MB.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="avatar-file"
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  if (!nextFile) {
                    setAvatarFile(null);
                    setAvatarStatus(null);
                    return;
                  }
                  if (nextFile.size > 2 * 1024 * 1024) {
                    setAvatarStatus('Arquivo acima de 2MB.');
                    setAvatarFile(null);
                    return;
                  }
                  if (!['image/png', 'image/jpeg'].includes(nextFile.type)) {
                    setAvatarStatus('Formato inválido. Use PNG ou JPG.');
                    setAvatarFile(null);
                    return;
                  }
                  setAvatarStatus(null);
                  setAvatarFile(nextFile);
                }}
              />
              <Button asChild variant="outline">
                <label htmlFor="avatar-file" className="cursor-pointer">
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Escolher imagem
                </label>
              </Button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {avatarFile ? avatarFile.name : 'Nenhum arquivo selecionado'}
              </span>
              {avatarFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarStatus(null);
                  }}
                >
                  <X className="mr-1 h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
            {avatarStatus && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{avatarStatus}</p>
            )}
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!avatarFile || isUploadingAvatar}
              onClick={async () => {
                if (!avatarFile) return;
                setIsUploadingAvatar(true);
                setAvatarStatus('Enviando avatar...');
                const formData = new FormData();
                formData.append('avatar', avatarFile);
                const response = await fetch('/api/user/avatar', {
                  method: 'POST',
                  body: formData,
                });
                if (!response.ok) {
                  setAvatarStatus('Erro ao enviar avatar.');
                  setIsUploadingAvatar(false);
                  return;
                }
                setAvatarStatus('Avatar atualizado com sucesso.');
                setAvatarFile(null);
                await mutate('/api/user');
                setIsUploadingAvatar(false);
              }}
            >
              {isUploadingAvatar ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Atualizar avatar'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="atlas-surface atlas-hover">
          <CardHeader>
            <CardTitle>Resumo da conta</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              <span className="text-slate-500 dark:text-slate-400">Nome:</span>{' '}
              {user?.name || '—'}
            </p>
            <p>
              <span className="text-slate-500 dark:text-slate-400">E-mail:</span>{' '}
              {user?.email || '—'}
            </p>
            <p>
              <span className="text-slate-500 dark:text-slate-400">Perfil:</span>{' '}
              {getRoleDisplayLabel(role)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <HelpPanel
          title="Ajuda rápida"
          description="Atualize seus dados básicos com segurança."
          tips={helpTips}
        />
      </div>
    </section>
  );
}
