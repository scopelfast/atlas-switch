import { MarketingStandaloneLayout } from '@/components/shells/marketing-standalone-layout';

/** Mesmo shell visual que `/help`: cabeçalho público, gradiente e rodapé. */
export default function ManualLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingStandaloneLayout>
      <div className="mx-auto w-full max-w-5xl px-4 pb-14 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8">
        {children}
      </div>
    </MarketingStandaloneLayout>
  );
}
