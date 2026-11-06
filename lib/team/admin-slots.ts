import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invitations, saasPlans, teamMembers, teamPlans } from '@/lib/db/schema';

/**
 * E1.1 — maior `max_team_admin_slots` entre planos ATIVO do time.
 * Sem plano ATIVO → 2 (desenvolvimento / pré-contrato; produção deve ligar planos).
 */
export async function getTeamMaxAdminSlots(teamId: number): Promise<number> {
  const rows = await db
    .select({ slots: saasPlans.maxTeamAdminSlots })
    .from(teamPlans)
    .innerJoin(saasPlans, eq(teamPlans.planId, saasPlans.id))
    .where(and(eq(teamPlans.teamId, teamId), eq(teamPlans.status, 'ATIVO')));

  if (rows.length === 0) return 2;
  return Math.max(1, ...rows.map((r) => r.slots ?? 1));
}

export async function countTeamAdminMembers(teamId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, 'admin')));
  return Number(row?.n ?? 0);
}

/** Convites admin ainda não aceites (pending ou activated no fluxo M2). */
export async function countPendingOrActivatedAdminInvites(teamId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(invitations)
    .where(
      and(
        eq(invitations.teamId, teamId),
        eq(invitations.role, 'admin'),
        inArray(invitations.status, ['pending', 'activated']),
      ),
    );
  return Number(row?.n ?? 0);
}

export type AdminSlotCheck = { ok: true } | { ok: false; message: string };

/** Antes de criar convite admin ou aceitar registo com papel admin. */
export async function assertTeamAdminSlotsAvailable(
  teamId: number,
  mode: 'new_invite' | 'complete_membership',
): Promise<AdminSlotCheck> {
  const max = await getTeamMaxAdminSlots(teamId);
  const members = await countTeamAdminMembers(teamId);
  const invites = await countPendingOrActivatedAdminInvites(teamId);

  if (mode === 'new_invite') {
    if (members + invites + 1 > max) {
      return {
        ok: false,
        message:
          max <= 1
            ? 'O plano actual só permite um Administrador no time. Contrate um plano ou add-on com vaga extra (Enterprise ou plano com slots > 1) para convidar outro administrador.'
            : `Limite de administradores atingido para este plano (${max} vaga(s)). Ajuste o plano no Centro de Controlo ou contacte o suporte.`,
      };
    }
    return { ok: true };
  }

  if (members + 1 > max) {
    return {
      ok: false,
      message:
        'O plano do time já não permite mais contas Administrador. Peça ao proprietário para rever a subscrição ou utilize outro papel no convite.',
    };
  }
  return { ok: true };
}
