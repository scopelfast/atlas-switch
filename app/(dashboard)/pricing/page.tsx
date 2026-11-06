import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { SubmitButton } from './submit-button';
import { HelpPanel } from '@/components/ui/help-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModuleHeader } from '@/components/ui/module-header';
import { db } from '@/lib/db/drizzle';
import { saasPlans } from '@/lib/db/schema';
import { SiteFooter } from '@/components/shells/site-footer';

// Prices are fresh for one hour max
export const revalidate = 3600;

export default async function PricingPage() {
  const [prices, products] = await Promise.all([
    getStripePrices(),
    getStripeProducts(),
  ]);
  const plans = await db.select().from(saasPlans).orderBy(saasPlans.priceCents);

  const stripeEnabled = prices.length > 0 && products.length > 0;
  const useDbPlans = plans.length > 0;

  const pricesById = new Map(prices.map((price) => [price.id, price]));

  return (
    <main className="bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ModuleHeader
          title="Planos"
          description="Escolha o plano ideal para o ritmo da sua equipa. Valores e checkout são de demonstração até confirmar comercialmente Stripe e planos em produção."
        />
      </div>
      <div className="max-w-7xl mx-auto px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50/95 to-white p-4 text-sm text-violet-950 shadow-sm dark:border-violet-500/25 dark:from-violet-950/40 dark:to-slate-950/60 dark:text-violet-100">
          <p className="font-semibold">Demonstração de produto</p>
          <p className="mt-1 text-violet-900/90 dark:text-violet-100/90">
            Esta página ilustra o modelo de cobrança e o fluxo de checkout. Não constitui proposta
            fiscal nem contrato até integrar Stripe, impostos e condições reais da sua organização.
          </p>
        </div>
        {!stripeEnabled ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Stripe não está configurado: os botões de compra permanecem desativados.{' '}
            <a href="/help" className="font-semibold underline underline-offset-4">
              Guia rápido de configuração
            </a>
            .
          </div>
        ) : null}
        <div className="grid gap-8 md:grid-cols-2">
          {useDbPlans
            ? plans.map((plan) => {
                const stripePrice = plan.stripePriceId
                  ? pricesById.get(plan.stripePriceId)
                  : undefined;
                const intervalLabel =
                  plan.billingInterval === 'MONTHLY'
                    ? 'month'
                    : plan.billingInterval === 'YEARLY'
                      ? 'year'
                      : 'month';
                return (
                  <PricingCard
                    key={plan.id}
                    name={plan.name}
                    price={plan.priceCents}
                    interval={intervalLabel}
                    trialDays={stripePrice?.trialPeriodDays || 7}
                    features={[
                      `Até ${plan.maxUsers} usuários`,
                      `${plan.maxStorageGb} GB de armazenamento`,
                      plan.aiEnabled ? 'IA liberada no plano' : 'IA sob demanda',
                    ]}
                    priceId={plan.stripePriceId || undefined}
                    disabled={!stripeEnabled || !plan.stripePriceId}
                  />
                );
              })
            : (
              <>
                <PricingCard
                  name="Essencial"
                  price={800}
                  interval="month"
                  trialDays={7}
                  features={[
                    'Uso ilimitado',
                    'Membros ilimitados no workspace',
                    'Suporte por e-mail',
                  ]}
                  priceId={undefined}
                  disabled
                />
                <PricingCard
                  name="Pro"
                  price={1200}
                  interval="month"
                  trialDays={7}
                  features={[
                    'Tudo do plano Base, e:',
                    'Acesso antecipado a novidades',
                    'Suporte 24/7 + acesso ao Slack',
                  ]}
                  priceId={undefined}
                  disabled
                />
              </>
            )}
        </div>

        <div className="mt-8">
          <HelpPanel
            title="Ajuda rápida"
            description="Compare limites de utilizadores e armazenamento; confirme com o owner se a IA está incluída no plano."
            tips={[
              'O período de teste depende do preço configurado no Stripe.',
              'Para ambiente real, valide BASE_URL, webhooks e chaves no .env.',
            ]}
          />
        </div>
      </div>

      <SiteFooter embedded />
    </main>
  );
}

function PricingCard({
  name,
  price,
  interval,
  trialDays,
  features,
  priceId,
  disabled
}: {
  name: string;
  price: number;
  interval: string;
  trialDays: number;
  features: string[];
  priceId?: string;
  disabled?: boolean;
}) {
  return (
    <Card className="atlas-surface">
      <CardHeader className="gap-2">
        <CardTitle className="text-2xl text-slate-900 dark:text-slate-50">
          {name}
        </CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {trialDays} dias de teste grátis
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-semibold text-slate-900 dark:text-slate-50">
          R$ {(price / 100).toFixed(2).replace('.', ',')}{' '}
          <span className="text-base font-normal text-slate-500 dark:text-slate-300">
            por usuário /{' '}
            {interval === 'month' ? 'mês' : interval === 'year' ? 'ano' : interval}
          </span>
        </p>
        <ul className="mt-6 space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="mt-0.5 h-5 w-5 text-indigo-500" />
              <span className="text-slate-700 dark:text-slate-200">
                {feature}
              </span>
            </li>
          ))}
        </ul>
        <form action={checkoutAction} className="mt-8">
          <input type="hidden" name="priceId" value={priceId} />
          <SubmitButton disabled={disabled || !priceId} />
        </form>
      </CardContent>
    </Card>
  );
}
