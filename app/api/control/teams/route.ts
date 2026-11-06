import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { auditEvents, saasPlans, teamPlans, teams } from '@/lib/db/schema';

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

export async function GET() {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const data = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      planId: teamPlans.planId,
      planStatus: teamPlans.status,
      negotiatedPriceCents: teamPlans.negotiatedPriceCents,
      billingCycleDay: teamPlans.billingCycleDay,
      nextInvoiceDate: teamPlans.nextInvoiceDate,
      planName: saasPlans.name,
      planPriceCents: saasPlans.priceCents,
    })
    .from(teams)
    .leftJoin(teamPlans, eq(teamPlans.teamId, teams.id))
    .leftJoin(saasPlans, eq(saasPlans.id, teamPlans.planId))
    .orderBy(teams.createdAt);

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json();
  const teamId = Number(body?.teamId);
  const planId = Number(body?.planId);

  if (!teamId || !planId) {
    return NextResponse.json({ error: 'teamId e planId são obrigatórios' }, { status: 400 });
  }

  const existingPlan = await db
    .select()
    .from(teamPlans)
    .where(eq(teamPlans.teamId, teamId))
    .limit(1);

  if (existingPlan[0]) {
    await db
      .update(teamPlans)
      .set({
        planId,
        status: typeof body?.status === 'string' ? body.status.trim() : existingPlan[0].status,
        negotiatedPriceCents:
          typeof body?.negotiatedPriceCents === 'number'
            ? body.negotiatedPriceCents
            : existingPlan[0].negotiatedPriceCents,
        billingCycleDay:
          typeof body?.billingCycleDay === 'number'
            ? body.billingCycleDay
            : existingPlan[0].billingCycleDay,
        nextInvoiceDate:
          typeof body?.nextInvoiceDate === 'string'
            ? body.nextInvoiceDate
            : existingPlan[0].nextInvoiceDate,
        updatedAt: new Date(),
      })
      .where(eq(teamPlans.id, existingPlan[0].id));
  } else {
    await db.insert(teamPlans).values({
      teamId,
      planId,
      status: typeof body?.status === 'string' ? body.status.trim() : 'ATIVO',
      negotiatedPriceCents:
        typeof body?.negotiatedPriceCents === 'number' ? body.negotiatedPriceCents : null,
      billingCycleDay: typeof body?.billingCycleDay === 'number' ? body.billingCycleDay : 5,
      nextInvoiceDate:
        typeof body?.nextInvoiceDate === 'string' ? body.nextInvoiceDate : null,
    });
  }

  await db.insert(auditEvents).values({
    actorUserId: auth.user.id,
    teamId,
    module: 'control-center',
    action: `Plano atualizado para time ${teamId}`,
  });

  return NextResponse.json({ ok: true });
}
