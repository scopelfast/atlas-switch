import Link from 'next/link';
import { CircleIcon } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="atlas-surface max-w-md space-y-6 p-8 text-center">
        <div className="flex justify-center">
          <CircleIcon className="size-12 text-indigo-500" />
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Página não encontrada
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          A página que você procura pode ter sido removida, renomeada ou está
          temporariamente indisponível.
        </p>
        <Link
          href="/"
          className="mx-auto flex max-w-48 justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
