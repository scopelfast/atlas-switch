import { SignJWT, jwtVerify } from 'jose';

const key = () => new TextEncoder().encode(process.env.AUTH_SECRET);

/** JWT de curta duração para `GET .../sample-payload?token=` (sem cookie). */
export async function signWebhookSamplePayloadToken(teamId: number): Promise<string> {
  if (!process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET em falta.');
  }
  return new SignJWT({ purpose: 'webhook_sample_payload', teamId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key());
}

export async function verifyWebhookSamplePayloadToken(
  token: string,
): Promise<{ teamId: number } | null> {
  if (!process.env.AUTH_SECRET) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    if (payload.purpose !== 'webhook_sample_payload') {
      return null;
    }
    const teamId = typeof payload.teamId === 'number' ? payload.teamId : Number(payload.teamId);
    if (!Number.isFinite(teamId) || teamId < 1) {
      return null;
    }
    return { teamId };
  } catch {
    return null;
  }
}
