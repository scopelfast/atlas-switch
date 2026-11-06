import { NextResponse } from 'next/server';
import { getClientIp } from '@/lib/http/client-ip';
import { checkPublicPortalRateLimit } from '@/lib/taskflow/public-portal-rate-limit';
import {
  getTeamByPublicPortalSlug,
  getPublicPortalPageMeta,
  insertPortalSubmission,
} from '@/lib/db/taskflow-portal';
import { db } from '@/lib/db/drizzle';
import { activityLogs } from '@/lib/db/schema';
import { ActivityType } from '@/lib/db/schema';

/**
 * E8.7 — metadados do formulário público (sem autenticação).
 */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const meta = await getPublicPortalPageMeta(slug);
  if (!meta) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  }
  return NextResponse.json(meta);
}

/**
 * E8.7 — envio para fila de moderação (honeypot + rate limit por IP).
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const team = await getTeamByPublicPortalSlug(slug);
  if (!team?.taskflowPublicPortalEnabled) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  }

  const ip = getClientIp(request);
  if (!checkPublicPortalRateLimit(team.id, ip)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tente mais tarde.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (typeof b.companyWebsite === 'string' && b.companyWebsite.trim() !== '') {
    return NextResponse.json({ error: 'Rejeitado' }, { status: 400 });
  }

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title || title.length > 500) {
    return NextResponse.json({ error: 'Título obrigatório (máx. 500 caracteres)' }, { status: 400 });
  }
  const description = typeof b.description === 'string' ? b.description.slice(0, 8000) : null;
  const submitterName =
    typeof b.submitterName === 'string' ? b.submitterName.trim().slice(0, 120) : null;
  const submitterEmailRaw =
    typeof b.submitterEmail === 'string' ? b.submitterEmail.trim().slice(0, 255) : null;
  const submitterEmail = submitterEmailRaw === '' ? null : submitterEmailRaw;
  if (submitterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
  }

  const row = await insertPortalSubmission({
    teamId: team.id,
    title,
    description: description?.trim() || null,
    submitterName: submitterName || null,
    submitterEmail,
  });

  await db.insert(activityLogs).values({
    teamId: team.id,
    userId: null,
    action: ActivityType.TASKFLOW_PORTAL_SUBMIT,
    timestamp: new Date(),
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}
