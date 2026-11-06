import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teams } from '@/lib/db/schema';

/** E7.3 — opt-in por equipa (owner / admin / gestor). */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { enabled?: unknown }).enabled !== 'boolean'
  ) {
    return NextResponse.json({ error: 'Indique { "enabled": true|false }' }, { status: 400 });
  }

  const enabled = (body as { enabled: boolean }).enabled;

  await db
    .update(teams)
    .set({ taskflowAiInsightsEnabled: enabled, updatedAt: new Date() })
    .where(eq(teams.id, team.id));

  return NextResponse.json({ taskflowAiInsightsEnabled: enabled });
}
