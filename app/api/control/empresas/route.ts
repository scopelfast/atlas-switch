import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { sendInvitationEmail } from '@/lib/email/mailer';
import {
  generateInviteOpaqueToken,
  hashInviteOpaqueToken,
  inviteTokenExpiresAt,
} from '@/lib/invites/invite-token';
import { auditEvents, invitations, saasPlans, teamPlans, teams, users } from '@/lib/db/schema';

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

function appPublicBaseUrl() {
  const raw = process.env.BASE_URL || 'http://localhost:3003';
  return raw.replace(/\/+$/, '');
}

export type EmpresaPlan = {
  id: number;
  planId: number;
  planName: string;
  status: string;
  negotiatedPriceCents?: number | null;
  billingCycleDay?: number | null;
  nextInvoiceDate?: string | null;
};

export type Empresa = {
  id: number;
  name: string;
  subscriptionStatus?: string | null;
  plans: EmpresaPlan[];
};

export async function GET(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase() ?? '';

  const rows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      subscriptionStatus: teams.subscriptionStatus,
      planId: teamPlans.id,
      planPlanId: teamPlans.planId,
      planStatus: teamPlans.status,
      negotiatedPriceCents: teamPlans.negotiatedPriceCents,
      billingCycleDay: teamPlans.billingCycleDay,
      nextInvoiceDate: teamPlans.nextInvoiceDate,
      planName: saasPlans.name,
    })
    .from(teams)
    .leftJoin(teamPlans, eq(teamPlans.teamId, teams.id))
    .leftJoin(saasPlans, eq(saasPlans.id, teamPlans.planId))
    .orderBy(teams.name);

  const byTeam = new Map<number, Empresa>();
  for (const r of rows) {
    if (!byTeam.has(r.teamId)) {
      byTeam.set(r.teamId, {
        id: r.teamId,
        name: r.teamName,
        subscriptionStatus: r.subscriptionStatus,
        plans: [],
      });
    }
    const emp = byTeam.get(r.teamId)!;
    if (r.planId != null && r.planPlanId != null) {
      emp.plans.push({
        id: r.planId,
        planId: r.planPlanId,
        planName: r.planName ?? 'Plano',
        status: r.planStatus ?? 'ATIVO',
        negotiatedPriceCents: r.negotiatedPriceCents,
        billingCycleDay: r.billingCycleDay,
        nextInvoiceDate:
          r.nextInvoiceDate != null ? String(r.nextInvoiceDate).slice(0, 10) : null,
      });
    }
  }

  let result = Array.from(byTeam.values());

  if (q) {
    result = result.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.plans.some((p) => p.planName.toLowerCase().includes(q)),
    );
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const teamName = typeof body?.name === 'string' ? body.name.trim() : '';
  const planIdRaw = body?.planId;
  const planId =
    typeof planIdRaw === 'number'
      ? planIdRaw
      : typeof planIdRaw === 'string' && planIdRaw.trim() !== ''
        ? Number(planIdRaw)
        : null;
  const masterName = typeof body?.masterName === 'string' ? body.masterName.trim() : '';
  const masterEmail = typeof body?.masterEmail === 'string' ? body.masterEmail.trim().toLowerCase() : '';
  const masterRoleRaw = typeof body?.masterRole === 'string' ? body.masterRole.trim().toLowerCase() : '';
  const masterRole = masterRoleRaw === 'admin' ? 'admin' : 'owner';
  const shouldCreateMasterInvite = Boolean(masterName || masterEmail);

  if (!teamName) {
    return NextResponse.json({ error: 'Nome da empresa é obrigatório' }, { status: 400 });
  }

  if (shouldCreateMasterInvite) {
    if (!masterName || !masterEmail) {
      return NextResponse.json(
        { error: 'Para convidar o usuário master, informe nome e e-mail.' },
        { status: 400 },
      );
    }
    const basicEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masterEmail);
    if (!basicEmailOk) {
      return NextResponse.json({ error: 'E-mail do usuário master inválido.' }, { status: 400 });
    }
  }

  if (planId !== null && (!Number.isFinite(planId) || planId < 1)) {
    return NextResponse.json({ error: 'planId inválido' }, { status: 400 });
  }

  if (planId !== null) {
    const planRows = await db
      .select({ id: saasPlans.id })
      .from(saasPlans)
      .where(eq(saasPlans.id, planId))
      .limit(1);
    if (!planRows[0]) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
    }
  }

  if (shouldCreateMasterInvite) {
    const [alreadyUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, masterEmail), isNull(users.deletedAt)))
      .limit(1);
    if (alreadyUser) {
      return NextResponse.json(
        { error: 'Já existe um usuário ativo com este e-mail para o master.' },
        { status: 400 },
      );
    }
  }

  const status = typeof body?.status === 'string' && body.status.trim() ? body.status.trim() : 'ATIVO';
  const negotiatedPriceCents =
    typeof body?.negotiatedPriceCents === 'number' && Number.isFinite(body.negotiatedPriceCents)
      ? Math.max(0, Math.round(body.negotiatedPriceCents))
      : null;
  const billingCycleDay =
    typeof body?.billingCycleDay === 'number' && Number.isFinite(body.billingCycleDay)
      ? Math.min(31, Math.max(1, Math.round(body.billingCycleDay)))
      : 5;
  const nextInvoiceDate =
    typeof body?.nextInvoiceDate === 'string' && body.nextInvoiceDate.trim()
      ? body.nextInvoiceDate.trim()
      : null;
  const rawInviteToken = shouldCreateMasterInvite ? generateInviteOpaqueToken() : null;
  const inviteTokenHash = rawInviteToken ? hashInviteOpaqueToken(rawInviteToken) : null;
  const inviteUrl = rawInviteToken
    ? `${appPublicBaseUrl()}/invite?token=${encodeURIComponent(rawInviteToken)}`
    : null;

  const created = await db.transaction(async (tx) => {
    const [newTeam] = await tx
      .insert(teams)
      .values({
        name: teamName,
        updatedAt: new Date(),
      })
      .returning({ id: teams.id, name: teams.name });

    let createdTeamPlanId: number | null = null;
    let createdInvitationId: number | null = null;
    if (planId !== null) {
      const [teamPlan] = await tx
        .insert(teamPlans)
        .values({
          teamId: newTeam.id,
          planId,
          status,
          negotiatedPriceCents,
          billingCycleDay,
          nextInvoiceDate,
        })
        .returning({ id: teamPlans.id });
      createdTeamPlanId = teamPlan.id;
    }

    if (shouldCreateMasterInvite && inviteTokenHash) {
      const [inv] = await tx
        .insert(invitations)
        .values({
          teamId: newTeam.id,
          email: masterEmail,
          invitedName: masterName.slice(0, 100),
          role: masterRole,
          invitedBy: auth.user.id,
          status: 'pending',
          tokenHash: inviteTokenHash,
          tokenExpiresAt: inviteTokenExpiresAt(),
        })
        .returning({ id: invitations.id });
      createdInvitationId = inv.id;
    }

    await tx.insert(auditEvents).values({
      actorUserId: auth.user.id,
      teamId: newTeam.id,
      module: 'control-center',
      action:
        planId !== null
          ? `Empresa ${newTeam.id} criada com plano inicial ${planId}`
          : `Empresa ${newTeam.id} criada sem plano inicial`,
      detail: JSON.stringify({
        teamName,
        planId,
        status,
        negotiatedPriceCents,
        billingCycleDay,
        nextInvoiceDate,
        masterInviteEmail: shouldCreateMasterInvite ? masterEmail : null,
        masterInviteRole: shouldCreateMasterInvite ? masterRole : null,
      }),
    });

    return {
      id: newTeam.id,
      name: newTeam.name,
      teamPlanId: createdTeamPlanId,
      invitationId: createdInvitationId,
    };
  });

  let inviteEmailSent: boolean | null = null;
  if (shouldCreateMasterInvite && inviteUrl) {
    inviteEmailSent = await sendInvitationEmail({
      to: masterEmail,
      teamName,
      role: masterRole,
      inviteUrl,
      invitedDisplayName: masterName,
    });
  }

  return NextResponse.json(
    {
      ...created,
      masterInvite: shouldCreateMasterInvite
        ? {
            email: masterEmail,
            role: masterRole,
            inviteUrl,
            emailSent: inviteEmailSent,
          }
        : null,
    },
    { status: 201 },
  );
}

/** Renomeia empresa ou suspende / reativa contratos (planos) em lote. */
export async function PATCH(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const teamId = Number(body?.id);
  if (!teamId || teamId < 1) {
    return NextResponse.json({ error: 'id (empresa) inválido' }, { status: 400 });
  }

  const [teamRow] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!teamRow) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
  }

  const action = typeof body?.action === 'string' ? body.action.trim() : '';

  if (action === 'suspend_all_active_plans') {
    await db
      .update(teamPlans)
      .set({ status: 'PAUSADO', updatedAt: new Date() })
      .where(and(eq(teamPlans.teamId, teamId), eq(teamPlans.status, 'ATIVO')));
    await db.insert(auditEvents).values({
      actorUserId: auth.user.id,
      teamId,
      module: 'control-center',
      action: `Faturamento suspenso (planos ATIVO → PAUSADO) empresa ${teamId}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'resume_all_paused_plans') {
    await db
      .update(teamPlans)
      .set({ status: 'ATIVO', updatedAt: new Date() })
      .where(and(eq(teamPlans.teamId, teamId), eq(teamPlans.status, 'PAUSADO')));
    await db.insert(auditEvents).values({
      actorUserId: auth.user.id,
      teamId,
      module: 'control-center',
      action: `Faturamento reativado (planos PAUSADO → ATIVO) empresa ${teamId}`,
    });
    return NextResponse.json({ ok: true });
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json(
      { error: 'Informe name ou action (suspend_all_active_plans / resume_all_paused_plans).' },
      { status: 400 },
    );
  }

  const masterName = typeof body?.masterName === 'string' ? body.masterName.trim() : '';
  const masterEmail = typeof body?.masterEmail === 'string' ? body.masterEmail.trim().toLowerCase() : '';
  const masterRoleRaw = typeof body?.masterRole === 'string' ? body.masterRole.trim().toLowerCase() : '';
  const masterRole = masterRoleRaw === 'admin' ? 'admin' : 'owner';
  const shouldCreateMasterInvite = Boolean(masterName || masterEmail);

  if (shouldCreateMasterInvite) {
    if (!masterName || !masterEmail) {
      return NextResponse.json(
        { error: 'Para convidar o usuário master, informe nome e e-mail.' },
        { status: 400 },
      );
    }
    const basicEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masterEmail);
    if (!basicEmailOk) {
      return NextResponse.json({ error: 'E-mail do usuário master inválido.' }, { status: 400 });
    }
    const [alreadyUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, masterEmail), isNull(users.deletedAt)))
      .limit(1);
    if (alreadyUser) {
      return NextResponse.json(
        { error: 'Já existe um usuário ativo com este e-mail para o master.' },
        { status: 400 },
      );
    }
  }

  const rawInviteToken = shouldCreateMasterInvite ? generateInviteOpaqueToken() : null;
  const inviteTokenHash = rawInviteToken ? hashInviteOpaqueToken(rawInviteToken) : null;
  const inviteUrl = rawInviteToken
    ? `${appPublicBaseUrl()}/invite?token=${encodeURIComponent(rawInviteToken)}`
    : null;

  await db.transaction(async (tx) => {
    await tx
      .update(teams)
      .set({ name, updatedAt: new Date() })
      .where(eq(teams.id, teamId));

    if (shouldCreateMasterInvite && inviteTokenHash) {
      await tx.insert(invitations).values({
        teamId,
        email: masterEmail,
        invitedName: masterName.slice(0, 100),
        role: masterRole,
        invitedBy: auth.user.id,
        status: 'pending',
        tokenHash: inviteTokenHash,
        tokenExpiresAt: inviteTokenExpiresAt(),
      });
    }

    await tx.insert(auditEvents).values({
      actorUserId: auth.user.id,
      teamId,
      module: 'control-center',
      action: shouldCreateMasterInvite
        ? `Empresa ${teamId} atualizada com convite master`
        : `Empresa ${teamId} renomeada`,
      detail: JSON.stringify({
        name,
        masterInviteEmail: shouldCreateMasterInvite ? masterEmail : null,
        masterInviteRole: shouldCreateMasterInvite ? masterRole : null,
      }),
    });
  });

  let inviteEmailSent: boolean | null = null;
  if (shouldCreateMasterInvite && inviteUrl) {
    inviteEmailSent = await sendInvitationEmail({
      to: masterEmail,
      teamName: name,
      role: masterRole,
      inviteUrl,
      invitedDisplayName: masterName,
    });
  }

  return NextResponse.json({
    ok: true,
    id: teamId,
    name,
    masterInvite: shouldCreateMasterInvite
      ? {
          email: masterEmail,
          role: masterRole,
          inviteUrl,
          emailSent: inviteEmailSent,
        }
      : null,
  });
}
