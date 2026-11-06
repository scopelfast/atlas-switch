import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teams, users } from '@/lib/db/schema';

/** E8.19 — opt-in do utilizador (só se o time permitir). */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
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

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }

  if (enabled) {
    const [row] = await db
      .select({ allowed: teams.taskflowTtsNotificationsAllowed })
      .from(teams)
      .where(eq(teams.id, team.id))
      .limit(1);
    if (!row?.allowed) {
      return NextResponse.json(
        { error: 'O gestor ainda não permitiu notificações faladas para este time.' },
        { status: 403 },
      );
    }
  }

  await db
    .update(users)
    .set({ taskflowTtsNotificationsEnabled: enabled, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return NextResponse.json({ taskflowTtsNotificationsEnabled: enabled });
}
