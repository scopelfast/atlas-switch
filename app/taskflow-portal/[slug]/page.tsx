import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicPortalPageMeta } from '@/lib/db/taskflow-portal';
import { PortalPublicForm } from '@/components/taskflow/portal-public-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getPublicPortalPageMeta(slug);
  if (!meta) {
    return { title: 'Portal' };
  }
  return { title: `${meta.teamName} · Pedido externo`, description: 'Formulário público Atlas Taskflow.' };
}

export default async function TaskflowPublicPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = await getPublicPortalPageMeta(slug);
  if (!meta) {
    notFound();
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900/90">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Pedido externo</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Este formulário não exige conta. Não envie dados sensíveis desnecessários.
        </p>
        <div className="mt-6">
          <PortalPublicForm slug={slug} teamName={meta.teamName} />
        </div>
      </div>
    </div>
  );
}
