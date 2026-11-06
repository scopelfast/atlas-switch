import { NextResponse } from 'next/server';
import { and, desc, eq, max } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import {
  activityLogs,
  saasCustomerHealth,
  saasPlans,
  teamPlans,
  teams,
} from '@/lib/db/schema';

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

const clamp = (value: number, min: number, maxValue: number) =>
  Math.max(min, Math.min(maxValue, value));

const calculateRisk = (healthScore: number) => {
  if (healthScore >= 80) return 'BAIXO';
  if (healthScore >= 60) return 'MEDIO';
  return 'ALTO';
};

export async function GET() {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const latestActivity = await db
    .select({
      teamId: activityLogs.teamId,
      lastActivity: max(activityLogs.timestamp),
    })
    .from(activityLogs)
    .groupBy(activityLogs.teamId);

  const activityMap = new Map(
    latestActivity.map((item) => [item.teamId, item.lastActivity]),
  );

  const teamData = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      planId: teamPlans.planId,
      planStatus: teamPlans.status,
      planName: saasPlans.name,
      planPriceCents: saasPlans.priceCents,
      negotiatedPriceCents: teamPlans.negotiatedPriceCents,
    })
    .from(teams)
    .leftJoin(teamPlans, eq(teamPlans.teamId, teams.id))
    .leftJoin(saasPlans, eq(saasPlans.id, teamPlans.planId))
    .orderBy(teams.createdAt);

  const healthRecords = await db
    .select()
    .from(saasCustomerHealth)
    .orderBy(desc(saasCustomerHealth.updatedAt));

  const healthMap = new Map(healthRecords.map((item) => [item.teamId, item]));

  const results = teamData.map((team) => {
    const lastActivity = activityMap.get(team.teamId);
    const daysSince = lastActivity
      ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000)
      : 30;
    const usageScore = clamp(100 - daysSince * 3, 0, 100);
    const planFitScore = team.planStatus === 'ATIVO' ? 85 : 55;
    const supportScore = 70;
    const healthScore = clamp(
      Math.round((usageScore * 0.5 + planFitScore * 0.3 + supportScore * 0.2)),
      0,
      100,
    );
    const churnRisk = calculateRisk(healthScore);
    const recommendation =
      churnRisk === 'ALTO'
        ? 'Acionar CS e revisar plano/uso nas últimas 2 semanas.'
        : churnRisk === 'MEDIO'
          ? 'Enviar checklist de adoção e sugerir treinamento.'
          : 'Manter acompanhamento mensal e avaliar upsell.';

    const existing = healthMap.get(team.teamId);
    return {
      teamId: team.teamId,
      teamName: team.teamName,
      planName: team.planName,
      planStatus: team.planStatus,
      revenueCents: team.negotiatedPriceCents ?? team.planPriceCents ?? 0,
      lastActivity,
      usageScore,
      planFitScore,
      supportScore,
      healthScore: existing?.healthScore ?? healthScore,
      churnRisk: existing?.churnRisk ?? churnRisk,
      recommendation: existing?.recommendation ?? recommendation,
    };
  });

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json();
  const teamId = Number(body?.teamId);
  if (!teamId) {
    return NextResponse.json({ error: 'teamId é obrigatório' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(saasCustomerHealth)
    .where(eq(saasCustomerHealth.teamId, teamId))
    .limit(1);

  const payload = {
    teamId,
    healthScore:
      typeof body?.healthScore === 'number' ? body.healthScore : existing[0]?.healthScore ?? 70,
    churnRisk:
      typeof body?.churnRisk === 'string' ? body.churnRisk : existing[0]?.churnRisk ?? 'MEDIO',
    lastActivityAt: typeof body?.lastActivityAt === 'string' ? body.lastActivityAt : null,
    usageScore:
      typeof body?.usageScore === 'number' ? body.usageScore : existing[0]?.usageScore ?? 0,
    planFitScore:
      typeof body?.planFitScore === 'number' ? body.planFitScore : existing[0]?.planFitScore ?? 0,
    supportScore:
      typeof body?.supportScore === 'number' ? body.supportScore : existing[0]?.supportScore ?? 0,
    recommendation:
      typeof body?.recommendation === 'string'
        ? body.recommendation
        : existing[0]?.recommendation ?? null,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db
      .update(saasCustomerHealth)
      .set(payload)
      .where(eq(saasCustomerHealth.id, existing[0].id));
  } else {
    await db.insert(saasCustomerHealth).values(payload);
  }

  return NextResponse.json({ ok: true });
}
