import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { auditEvents, saasPlanModules, saasPlans } from '@/lib/db/schema';

const ensureOwner = async () => {
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  }
  if (!canAccessControlPlane(user)) {
    return { error: NextResponse.json({ error: 'Acesso restrito' }, { status: 403 }) };
  }
  return { user };
};

export async function GET(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase() ?? '';
  const moduleKey = searchParams.get('module')?.trim() ?? '';

  let plans = await db.select().from(saasPlans).orderBy(saasPlans.priceCents);
  const modules = await db.select().from(saasPlanModules);

  const grouped = plans.map((plan) => ({
    ...plan,
    modules: modules
      .filter((item) => item.planId === plan.id)
      .map((item) => ({ moduleKey: item.moduleKey, enabled: item.enabled })),
  }));

  let result = grouped;
  if (q) {
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    );
  }
  if (moduleKey) {
    result = result.filter((p) =>
      p.modules.some((m) => m.moduleKey === moduleKey),
    );
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : null;
  const priceCents = typeof body?.priceCents === 'number' ? body.priceCents : 0;
  const stripeProductId =
    typeof body?.stripeProductId === 'string' ? body.stripeProductId.trim() : null;
  const stripePriceId =
    typeof body?.stripePriceId === 'string' ? body.stripePriceId.trim() : null;
  const billingInterval =
    typeof body?.billingInterval === 'string' ? body.billingInterval.trim() : 'MONTHLY';
  const maxUsers = typeof body?.maxUsers === 'number' ? body.maxUsers : 5;
  const maxStorageGb = typeof body?.maxStorageGb === 'number' ? body.maxStorageGb : 50;
  const aiEnabled = typeof body?.aiEnabled === 'boolean' ? body.aiEnabled : true;
  const maxTeamAdminSlots =
    typeof body?.maxTeamAdminSlots === 'number' && body.maxTeamAdminSlots >= 1
      ? Math.min(99, Math.floor(body.maxTeamAdminSlots))
      : 1;
  const modules = Array.isArray(body?.modules) ? body.modules : [];

  if (!name) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
  }

  const created = await db
    .insert(saasPlans)
    .values({
      name,
      description,
      priceCents,
      stripeProductId,
      stripePriceId,
      billingInterval,
      maxUsers,
      maxStorageGb,
      aiEnabled,
      maxTeamAdminSlots,
      catalogSuspended: false,
    })
    .returning();

  if (modules.length) {
    await db.insert(saasPlanModules).values(
      modules.map((module: { moduleKey: string; enabled?: boolean }) => ({
        planId: created[0].id,
        moduleKey: module.moduleKey,
        enabled: module.enabled ?? true,
      })),
    );
  }

  await db.insert(auditEvents).values({
    actorUserId: auth.user.id,
    module: 'control-center',
    action: `Plano criado: ${name}`,
  });

  return NextResponse.json(created[0], { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const existing = await db.select().from(saasPlans).where(eq(saasPlans.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(saasPlans)
    .set({
      name: typeof body?.name === 'string' ? body.name.trim() : existing[0].name,
      description:
        typeof body?.description === 'string'
          ? body.description.trim()
          : existing[0].description,
      priceCents:
        typeof body?.priceCents === 'number' ? body.priceCents : existing[0].priceCents,
      stripeProductId:
        typeof body?.stripeProductId === 'string'
          ? body.stripeProductId.trim()
          : existing[0].stripeProductId,
      stripePriceId:
        typeof body?.stripePriceId === 'string'
          ? body.stripePriceId.trim()
          : existing[0].stripePriceId,
      billingInterval:
        typeof body?.billingInterval === 'string'
          ? body.billingInterval.trim()
          : existing[0].billingInterval,
      maxUsers:
        typeof body?.maxUsers === 'number' ? body.maxUsers : existing[0].maxUsers,
      maxStorageGb:
        typeof body?.maxStorageGb === 'number'
          ? body.maxStorageGb
          : existing[0].maxStorageGb,
      aiEnabled:
        typeof body?.aiEnabled === 'boolean' ? body.aiEnabled : existing[0].aiEnabled,
      maxTeamAdminSlots:
        typeof body?.maxTeamAdminSlots === 'number' && body.maxTeamAdminSlots >= 1
          ? Math.min(99, Math.floor(body.maxTeamAdminSlots))
          : existing[0].maxTeamAdminSlots,
      catalogSuspended:
        typeof body?.catalogSuspended === 'boolean'
          ? body.catalogSuspended
          : existing[0].catalogSuspended,
      updatedAt: new Date(),
    })
    .where(eq(saasPlans.id, id))
    .returning();

  if (Array.isArray(body?.modules)) {
    await db.delete(saasPlanModules).where(eq(saasPlanModules.planId, id));
    const modules = body.modules as { moduleKey: string; enabled?: boolean }[];
    if (modules.length) {
      await db.insert(saasPlanModules).values(
        modules.map((module) => ({
          planId: id,
          moduleKey: module.moduleKey,
          enabled: module.enabled ?? true,
        })),
      );
    }
  }

  await db.insert(auditEvents).values({
    actorUserId: auth.user.id,
    module: 'control-center',
    action: `Plano atualizado: ${updated[0].name}`,
  });

  return NextResponse.json(updated[0]);
}

export async function DELETE(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const existing = await db.select().from(saasPlans).where(eq(saasPlans.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
  }

  await db.delete(saasPlans).where(eq(saasPlans.id, id));

  await db.insert(auditEvents).values({
    actorUserId: auth.user.id,
    module: 'control-center',
    action: `Plano removido: ${existing[0].name}`,
  });

  return NextResponse.json({ ok: true });
}
