import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { auditEvents, teamPlans } from '@/lib/db/schema';

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

/** Adiciona um plano a uma empresa (team). */
export async function POST(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json();
  const teamId = Number(body?.teamId);
  const planId = Number(body?.planId);

  if (!teamId || !planId) {
    return NextResponse.json({ error: 'teamId e planId são obrigatórios' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(teamPlans)
    .where(eq(teamPlans.teamId, teamId));

  const alreadyHas = existing.some((tp) => tp.planId === planId);
  if (alreadyHas) {
    return NextResponse.json(
      { error: 'Esta empresa já possui este plano contratado' },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(teamPlans)
    .values({
      teamId,
      planId,
      status: typeof body?.status === 'string' ? body.status.trim() : 'ATIVO',
      negotiatedPriceCents:
        typeof body?.negotiatedPriceCents === 'number' ? body.negotiatedPriceCents : null,
      billingCycleDay: typeof body?.billingCycleDay === 'number' ? body.billingCycleDay : 5,
      nextInvoiceDate:
        typeof body?.nextInvoiceDate === 'string' ? body.nextInvoiceDate : null,
    })
    .returning();

  await db.insert(auditEvents).values({
    actorUserId: auth.user.id,
    teamId,
    module: 'control-center',
    action: `Plano ${planId} adicionado à empresa ${teamId}`,
  });

  return NextResponse.json(created, { status: 201 });
}

/** Remove um plano de uma empresa. */
export async function DELETE(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));

  if (!id) {
    return NextResponse.json({ error: 'id (team_plans.id) é obrigatório' }, { status: 400 });
  }

  const existing = await db.select().from(teamPlans).where(eq(teamPlans.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 });
  }

  await db.delete(teamPlans).where(eq(teamPlans.id, id));

  await db.insert(auditEvents).values({
    actorUserId: auth.user.id,
    teamId: existing[0].teamId,
    module: 'control-center',
    action: `Plano ${existing[0].planId} removido da empresa ${existing[0].teamId}`,
  });

  return NextResponse.json({ ok: true });
}

const ALLOWED_TEAM_PLAN_STATUS = new Set(['ATIVO', 'PAUSADO', 'CANCELADO']);

/** Atualiza faturamento / estado de um vínculo empresa × plano. */
export async function PATCH(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!id || id < 1) {
    return NextResponse.json({ error: 'id (team_plans) obrigatório' }, { status: 400 });
  }

  const [existing] = await db.select().from(teamPlans).where(eq(teamPlans.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 });
  }

  const patch: {
    status?: string;
    negotiatedPriceCents?: number | null;
    billingCycleDay?: number;
    nextInvoiceDate?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (body?.status !== undefined) {
    const s = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
    if (!ALLOWED_TEAM_PLAN_STATUS.has(s)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 });
    }
    patch.status = s;
  }

  if (body?.negotiatedPriceCents !== undefined) {
    if (body.negotiatedPriceCents === null) {
      patch.negotiatedPriceCents = null;
    } else if (typeof body.negotiatedPriceCents === 'number' && Number.isFinite(body.negotiatedPriceCents)) {
      patch.negotiatedPriceCents = Math.max(0, Math.round(body.negotiatedPriceCents));
    } else {
      return NextResponse.json({ error: 'negotiatedPriceCents inválido' }, { status: 400 });
    }
  }

  if (body?.billingCycleDay !== undefined) {
    const d = Number(body.billingCycleDay);
    if (!Number.isFinite(d) || d < 1 || d > 31) {
      return NextResponse.json({ error: 'billingCycleDay deve ser 1–31' }, { status: 400 });
    }
    patch.billingCycleDay = Math.round(d);
  }

  if (body?.nextInvoiceDate !== undefined) {
    if (body.nextInvoiceDate === null || body.nextInvoiceDate === '') {
      patch.nextInvoiceDate = null;
    } else if (typeof body.nextInvoiceDate === 'string') {
      const raw = body.nextInvoiceDate.trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return NextResponse.json({ error: 'nextInvoiceDate use AAAA-MM-DD' }, { status: 400 });
      }
      patch.nextInvoiceDate = raw;
    } else {
      return NextResponse.json({ error: 'nextInvoiceDate inválido' }, { status: 400 });
    }
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  await db.update(teamPlans).set(patch).where(eq(teamPlans.id, id));

  await db.insert(auditEvents).values({
    actorUserId: auth.user.id,
    teamId: existing.teamId,
    module: 'control-center',
    action: `Plano ${existing.planId} (vínculo ${id}) atualizado`,
    detail: JSON.stringify(patch),
  });

  const [updated] = await db.select().from(teamPlans).where(eq(teamPlans.id, id)).limit(1);
  return NextResponse.json(updated);
}
