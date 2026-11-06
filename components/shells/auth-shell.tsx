import Link from 'next/link';

function AuthBrandMark() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm ring-1 ring-slate-100 transition hover:border-violet-200/80 dark:border-slate-700 dark:bg-slate-900/80 dark:ring-slate-800"
    >
      <img src="/logoSYS.png" width={200} height={48} alt="AtlasSwitch" className="h-9 w-auto" decoding="async" />
    </Link>
  );
}

function AuthTrustFooter() {
  return (
    <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
      <Link href="/" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        Voltar ao início
      </Link>
      <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
      <Link href="/help" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        Ajuda e manuais
      </Link>
      <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
      <Link href="/sign-in" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        Entrar
      </Link>
    </p>
  );
}

const shellBg =
  'min-h-[100dvh] bg-gradient-to-br from-slate-100 via-white to-violet-100/40 px-4 py-8 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/25 sm:px-6 sm:py-10';

/**
 * Autenticação em duas colunas: painel de confiança + cartão do formulário.
 */
export function AuthShellSplit({
  aside,
  children,
}: {
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={shellBg}>
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-stretch lg:gap-8">
        <div className="min-w-0 overflow-hidden rounded-3xl shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10">
          {aside}
        </div>
        <div className="atlas-surface flex min-w-0 flex-col rounded-3xl p-6 shadow-2xl ring-1 ring-slate-200/80 dark:ring-slate-700/80 sm:p-8">
          {children}
        </div>
      </div>
      <AuthTrustFooter />
    </div>
  );
}

/**
 * Fluxos curtos (recuperação de senha, convite): cartão centrado e marca no topo.
 */
export function AuthShellCard({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${shellBg} flex flex-col`}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-4">
        <div className="mb-5 flex justify-center">
          <AuthBrandMark />
        </div>
        <div className="atlas-surface rounded-3xl p-6 shadow-2xl ring-1 ring-slate-200/80 dark:ring-slate-700/80 sm:p-8">
          {children}
        </div>
      </div>
      <AuthTrustFooter />
    </div>
  );
}
