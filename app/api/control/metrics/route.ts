import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { saasPlans, teamPlans, teams } from '@/lib/db/schema';

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

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0));

export async function GET() {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const totalTeams = await db
    .select({ count: sql<number>`count(*)` })
    .from(teams);

  const planStats = await db
    .select({
      status: teamPlans.status,
      count: sql<number>`count(*)`,
      projected: sql<number>`sum(coalesce(${teamPlans.negotiatedPriceCents}, ${saasPlans.priceCents}))`,
    })
    .from(teamPlans)
    .leftJoin(saasPlans, eq(saasPlans.id, teamPlans.planId))
    .groupBy(teamPlans.status);

  const projectedMrr = planStats.reduce((acc, item) => acc + toNumber(item.projected), 0);
  const activeTeams = planStats.reduce(
    (acc, item) => (item.status === 'ATIVO' ? acc + toNumber(item.count) : acc),
    0,
  );

  return NextResponse.json({
    totalTeams: toNumber(totalTeams[0]?.count),
    activeTeams,
    projectedMrr,
  });
}
