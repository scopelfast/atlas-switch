import { PublicSiteHeader } from '@/components/shells/public-site-header';
import { SiteFooter } from '@/components/shells/site-footer';

/**
 * Camada pública (marketing / ajuda) sem o cabeçalho da rota `(dashboard)`.
 * Mantém o mesmo vocabulário visual que o resto da plataforma.
 */
export function MarketingStandaloneLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-slate-100/90 via-white to-violet-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/25">
      <PublicSiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
