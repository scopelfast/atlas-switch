import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { buildWebhookSamplePayload } from '@/lib/taskflow/webhook-sample-payload';
import { checkWebhookSamplePayloadRateLimit } from '@/lib/taskflow/webhook-sample-rate-limit';
import { verifyWebhookSamplePayloadToken } from '@/lib/taskflow/webhook-sample-payload-token';
import { getClientIp } from '@/lib/http/client-ip';

/**
 * E8.14 — JSON de exemplo para mapear Zapier/Make (token JWT na query; rate limit por IP).
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!checkWebhookSamplePayloadRateLimit(ip)) {
    return NextResponse.json({ error: 'Muitos pedidos. Tente mais tarde.' }, { status: 429 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token')?.trim() ?? '';
  if (!token) {
    return NextResponse.json({ error: 'Indique token na query.' }, { status: 400 });
  }

  const claims = await verifyWebhookSamplePayloadToken(token);
  if (!claims) {
    return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 401 });
  }

  const [row] = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, claims.teamId))
    .limit(1);

  const teamName = row?.name ?? `Team ${claims.teamId}`;
  const body = buildWebhookSamplePayload(claims.teamId, teamName);

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
