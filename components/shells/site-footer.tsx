import Link from 'next/link';

export function SiteFooter({ embedded = false }: { embedded?: boolean }) {
  return (
    <footer
      className={
        embedded
          ? 'border-t border-slate-200/80 bg-white/40 py-10 dark:border-slate-800/80 dark:bg-slate-950/40'
          : 'border-t border-slate-200/80 bg-white/60 py-10 dark:border-slate-800/80 dark:bg-slate-950/60'
      }
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center text-xs text-slate-500 sm:flex-row sm:text-left dark:text-slate-400">
        <p>© {new Date().getFullYear()} AtlasSwitch · Operação e documentação no mesmo padrão visual.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end">
          <Link href="/" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Início
          </Link>
          <Link href="/pricing" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Preços
          </Link>
          <Link href="/help" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Ajuda
          </Link>
          <Link href="/sign-in" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Entrar
          </Link>
        </nav>
      </div>
    </footer>
  );
}
