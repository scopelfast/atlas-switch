import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db/drizzle';
import { teamTaskflowDevIntegration } from '@/lib/db/schema';

export function newInboundDevSecret(): string {
  return randomBytes(32).toString('hex');
}

export async function hasTeamDevInboundSecret(teamId: number): Promise<boolean> {
  const rows = await db
    .select({ teamId: teamTaskflowDevIntegration.teamId })
    .from(teamTaskflowDevIntegration)
    .where(eq(teamTaskflowDevIntegration.teamId, teamId))
    .limit(1);
  return rows.length > 0;
}

/** Cria segredo só se ainda não existir; devolve o segredo em texto claro uma única vez. */
export async function createTeamDevInboundSecretIfMissing(teamId: number): Promise<string | null> {
  if (await hasTeamDevInboundSecret(teamId)) {
    return null;
  }
  const secret = newInboundDevSecret();
  await db.insert(teamTaskflowDevIntegration).values({
    teamId,
    inboundSecret: secret,
    updatedAt: new Date(),
  });
  return secret;
}

/** Substitui o segredo existente (ou cria). */
export async function rotateTeamDevInboundSecret(teamId: number): Promise<string> {
  const secret = newInboundDevSecret();
  await db
    .insert(teamTaskflowDevIntegration)
    .values({
      teamId,
      inboundSecret: secret,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: teamTaskflowDevIntegration.teamId,
      set: { inboundSecret: secret, updatedAt: new Date() },
    });
  return secret;
}

export async function resolveTeamIdFromInboundSecret(secret: string): Promise<number | null> {
  const trimmed = secret.trim();
  if (!trimmed || trimmed.length > 80) {
    return null;
  }
  const rows = await db
    .select({ teamId: teamTaskflowDevIntegration.teamId })
    .from(teamTaskflowDevIntegration)
    .where(eq(teamTaskflowDevIntegration.inboundSecret, trimmed))
    .limit(1);
  return rows[0]?.teamId ?? null;
}
