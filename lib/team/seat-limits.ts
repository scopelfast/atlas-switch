import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invitations, saasPlans, teamMembers, teamPlans } from '@/lib/db/schema';

/**
 * Limite de lugares do contrato: maior `max_users` entre planos ATIVO ligados ao time.
 * Sem plano activo → `null` (sem bloqueio; típico em dev ou antes de contratar).
 */
export async function getTeamMaxSeats(teamId: number): Promise<number | null> {
  const rows = await db
    .select({ maxUsers: saasPlans.maxUsers })
    .from(teamPlans)
    .innerJoin(saasPlans, eq(teamPlans.planId, saasPlans.id))
    .where(and(eq(teamPlans.teamId, teamId), eq(teamPlans.status, 'ATIVO')));

  if (rows.length === 0) return null;
  return Math.max(...rows.map((r) => r.maxUsers));
}

/** Membros actuais + convites `pending` ou `activated` (M2.2 — ainda não aceite final). */
export async function countOccupiedSeats(teamId: number): Promise<number> {
  const [m] = await db
    .select({ n: count(teamMembers.id) })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  const [p] = await db
    .select({ n: count(invitations.id) })
    .from(invitations)
    .where(
      and(
        eq(invitations.teamId, teamId),
        inArray(invitations.status, ['pending', 'activated']),
      ),
    );
  return Number(m?.n ?? 0) + Number(p?.n ?? 0);
}

export type SeatCheck =
  | { ok: true }
  | { ok: false; max: number; used: number; message: string };

/** Bloqueia novo convite se `used >= max` (M1.5). */
export async function assertSeatsAvailableForNewInvite(teamId: number): Promise<SeatCheck> {
  const max = await getTeamMaxSeats(teamId);
  if (max === null) return { ok: true };

  const used = await countOccupiedSeats(teamId);
  if (used >= max) {
    return {
      ok: false,
      max,
      used,
      message: `Limite de licenças atingido (${used}/${max} lugares em uso, incluindo convites pendentes ou em confirmação). Atualize o plano ou libere lugares antes de convidar.`,
    };
  }
  return { ok: true };
}
