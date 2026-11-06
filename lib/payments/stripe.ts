import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Team } from '@/lib/db/schema';
import {
  getTeamByStripeCustomerId,
  getUser,
  updateTeamSubscription
} from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { saasPlans, teamPlans } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeEnabledEnv = process.env.STRIPE_ENABLED;

const stripeIsAllowed =
  stripeSecretKey &&
  (stripeEnabledEnv === undefined || stripeEnabledEnv === 'true');

export const stripe = stripeIsAllowed
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-04-30.basil'
    })
  : null;

export function ensureStripeClient(): Stripe {
  if (!stripe) {
    throw new Error('Stripe não está configurado. Defina STRIPE_SECRET_KEY para habilitar.');
  }
  return stripe;
}

export function isStripeEnabled() {
  return Boolean(stripe);
}

export async function createCheckoutSession({
  team,
  priceId
}: {
  team: Team | null;
  priceId: string;
}) {
  if (!stripe) {
    console.warn('[stripe] createCheckoutSession chamado sem Stripe configurado.');
    redirect('/pricing?stripe=disabled');
  }

  const client = ensureStripeClient();
  const user = await getUser();

  if (!team || !user) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  const session = await client.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    customer: team.stripeCustomerId || undefined,
    client_reference_id: user.id.toString(),
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14
    }
  });

  if (!session.url) {
    throw new Error('Stripe não retornou URL de checkout.');
  }

  redirect(session.url);
}

export async function createCustomerPortalSession(team: Team) {
  if (!stripe) {
    console.warn('[stripe] Portal solicitado sem Stripe configurado.');
    redirect('/pricing?stripe=disabled');
  }

  const client = ensureStripeClient();

  if (!team.stripeCustomerId || !team.stripeProductId) {
    redirect('/pricing');
  }

  let configuration: Stripe.BillingPortal.Configuration;
  const configurations = await client.billingPortal.configurations.list();

  if (configurations.data.length > 0) {
    configuration = configurations.data[0];
  } else {
    const product = await client.products.retrieve(team.stripeProductId);
    if (!product.active) {
      throw new Error('O produto do time não está ativo no Stripe');
    }

    const prices = await client.prices.list({
      product: product.id,
      active: true
    });
    if (prices.data.length === 0) {
      throw new Error('Nenhum preço ativo encontrado para o produto do time');
    }

    configuration = await client.billingPortal.configurations.create({
      business_profile: {
        headline: 'Gerencie sua assinatura'
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity', 'promotion_code'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: product.id,
              prices: prices.data.map((price) => price.id)
            }
          ]
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other'
            ]
          }
        },
        payment_method_update: {
          enabled: true
        }
      }
    });
  }

  return client.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/dashboard`,
    configuration: configuration.id
  });
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  const price = subscription.items.data[0]?.price;
  const priceId = price?.id;
  const productId =
    typeof price?.product === 'string' ? price.product : price?.product?.id;

  if (status === 'active' || status === 'trialing') {
    const plan = subscription.items.data[0]?.plan;
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: subscriptionId,
      stripeProductId: plan?.product as string,
      planName: (plan?.product as Stripe.Product).name,
      subscriptionStatus: status
    });

    if (priceId || productId) {
      const planRecord = await db
        .select()
        .from(saasPlans)
        .where(
          or(
            eq(saasPlans.stripePriceId, priceId || ''),
            eq(saasPlans.stripeProductId, productId || '')
          )
        )
        .limit(1);

      if (planRecord[0]) {
        const existing = await db
          .select()
          .from(teamPlans)
          .where(eq(teamPlans.teamId, team.id))
          .limit(1);

        if (existing[0]) {
          await db
            .update(teamPlans)
            .set({
              planId: planRecord[0].id,
              status: 'ATIVO',
              updatedAt: new Date()
            })
            .where(eq(teamPlans.id, existing[0].id));
        } else {
          await db.insert(teamPlans).values({
            teamId: team.id,
            planId: planRecord[0].id,
            status: 'ATIVO'
          });
        }
      }
    }
  } else if (status === 'canceled' || status === 'unpaid') {
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: null,
      subscriptionStatus: status
    });

    await db
      .update(teamPlans)
      .set({ status: 'INATIVO', updatedAt: new Date() })
      .where(eq(teamPlans.teamId, team.id));
  }
}

export async function getStripePrices() {
  if (!stripe) {
    return [];
  }

  try {
    const client = ensureStripeClient();
    const prices = await client.prices.list({
      expand: ['data.product'],
      active: true,
      type: 'recurring'
    });

    return prices.data.map((price) => ({
      id: price.id,
      productId:
        typeof price.product === 'string' ? price.product : price.product.id,
      unitAmount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval,
      trialPeriodDays: price.recurring?.trial_period_days
    }));
  } catch (error) {
    console.error('Stripe indisponível ao listar preços:', error);
    return [];
  }
}

export async function getStripeProducts() {
  if (!stripe) {
    return [];
  }

  try {
    const client = ensureStripeClient();
    const products = await client.products.list({
      active: true,
      expand: ['data.default_price']
    });

    return products.data.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      defaultPriceId:
        typeof product.default_price === 'string'
          ? product.default_price
          : product.default_price?.id
    }));
  } catch (error) {
    console.error('Stripe indisponível ao listar produtos:', error);
    return [];
  }
}
