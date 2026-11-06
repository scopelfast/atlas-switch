import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { isOwnerLike, normalizeRole } from '@/lib/auth/permissions';
import { assertTaskflowColumnBelongsToTeam } from '@/lib/db/taskflow-portal';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teams } from '@/lib/db/schema';

function newPortalSlug(): string {
  return randomBytes(16).toString('hex');
}

/** E8.7 — activar/desactivar portal e coluna de destino (owner/admin). */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isOwnerLike(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Apenas proprietário ou administrador' }, { status: 403 });
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
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const enabled = o.enabled === undefined ? undefined : Boolean(o.enabled);
  const columnIdRaw = o.columnId;
  const regenerateSlug = o.regenerateSlug === true;

  if (enabled === undefined && columnIdRaw === undefined && !regenerateSlug) {
    return NextResponse.json({ error: 'Indique enabled, columnId e/ou regenerateSlug' }, { status: 400 });
  }

  let nextSlug = team.taskflowPublicPortalSlug ?? null;
  let nextEnabled = team.taskflowPublicPortalEnabled;
  let nextColumnId = team.taskflowPublicPortalColumnId ?? null;

  if (enabled !== undefined) {
    nextEnabled = enabled;
  }
  if (regenerateSlug && !nextEnabled) {
    return NextResponse.json(
      { error: 'Active o portal antes de regenerar o slug (ou envie enabled: true no mesmo pedido).' },
      { status: 400 },
    );
  }
  if (columnIdRaw !== undefined && columnIdRaw !== null) {
    const cid = Number(columnIdRaw);
    if (!Number.isFinite(cid) || cid <= 0) {
      return NextResponse.json({ error: 'columnId inválido' }, { status: 400 });
    }
    await assertTaskflowColumnBelongsToTeam(team.id, cid);
    nextColumnId = cid;
  }

  if (nextEnabled) {
    if (!nextColumnId) {
      return NextResponse.json(
        { error: 'Escolha uma coluna de destino antes de activar o portal' },
        { status: 400 },
      );
    }
    if (!nextSlug || regenerateSlug) {
      let candidate = newPortalSlug();
      for (let i = 0; i < 8; i++) {
        const clash = await db
          .select({ id: teams.id })
          .from(teams)
          .where(eq(teams.taskflowPublicPortalSlug, candidate))
          .limit(1);
        if (clash.length === 0 || clash[0].id === team.id) {
          nextSlug = candidate;
          break;
        }
        candidate = newPortalSlug();
      }
    }
  }

  await db
    .update(teams)
    .set({
      taskflowPublicPortalEnabled: nextEnabled,
      taskflowPublicPortalSlug: nextSlug,
      taskflowPublicPortalColumnId: nextColumnId,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, team.id));

  return NextResponse.json({
    taskflowPublicPortalEnabled: nextEnabled,
    taskflowPublicPortalSlug: nextSlug,
    taskflowPublicPortalColumnId: nextColumnId,
  });
}
