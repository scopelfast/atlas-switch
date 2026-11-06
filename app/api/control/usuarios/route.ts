import { NextResponse } from 'next/server';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { auditEvents, teamMembers, teams, users } from '@/lib/db/schema';

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

export type UserWithTeams = {
  id: number;
  name: string | null;
  email: string;
  blockedAt: string | null;
  teams: { teamId: number; teamName: string; role: string }[];
};

const TEAM_ROLES = new Set(['owner', 'admin', 'gestor', 'supervisor', 'member']);

export async function GET(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase() ?? '';
  const teamIdParam = searchParams.get('teamId');
  const includeInactive = searchParams.get('includeInactive') === '1';

  const rows = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userDeletedAt: users.deletedAt,
      teamId: teams.id,
      teamName: teams.name,
      role: teamMembers.role,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(includeInactive ? undefined : isNull(users.deletedAt));

  const byUser = new Map<number, UserWithTeams>();
  for (const r of rows) {
    if (teamIdParam && Number(teamIdParam) !== r.teamId) continue;

    if (!byUser.has(r.userId)) {
      byUser.set(r.userId, {
        id: r.userId,
        name: r.userName,
        email: r.userEmail,
        blockedAt: r.userDeletedAt ? new Date(r.userDeletedAt).toISOString() : null,
        teams: [],
      });
    }
    if (r.teamId != null && r.teamName != null && r.role != null) {
      byUser.get(r.userId)!.teams.push({
        teamId: r.teamId,
        teamName: r.teamName,
        role: r.role,
      });
    }
  }

  let result = Array.from(byUser.values());

  if (q) {
    result = result.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.teams.some((t) => t.teamName.toLowerCase().includes(q)),
    );
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;
  if (!auth.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: number;
    name?: string;
    email?: string;
    action?: 'assign_team' | 'update_team_role' | 'remove_team' | 'toggle_block';
    userId?: number;
    teamId?: number;
    role?: string;
    blocked?: boolean;
  };
  const action = body.action;

  if (action === 'assign_team') {
    const userId = Number(body.userId);
    const teamId = Number(body.teamId);
    const role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
    if (!userId || !teamId || !TEAM_ROLES.has(role)) {
      return NextResponse.json({ error: 'userId, teamId e role válidos são obrigatórios.' }, { status: 400 });
    }

    const [userRow] = await db
      .select({ id: users.id, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!userRow || userRow.deletedAt) {
      return NextResponse.json({ error: 'Usuário não encontrado ou bloqueado.' }, { status: 404 });
    }

    const [teamRow] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!teamRow) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const [existingMember] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
      .limit(1);
    if (existingMember) {
      return NextResponse.json({ error: 'Usuário já está vinculado a esta empresa.' }, { status: 400 });
    }

    await db.insert(teamMembers).values({ userId, teamId, role });
    await db.insert(auditEvents).values({
      actorUserId: auth.user.id,
      teamId,
      module: 'control-center',
      action: `Usuário ${userId} vinculado à empresa ${teamId} com papel ${role}`,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'update_team_role') {
    const userId = Number(body.userId);
    const teamId = Number(body.teamId);
    const role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
    if (!userId || !teamId || !TEAM_ROLES.has(role)) {
      return NextResponse.json({ error: 'userId, teamId e role válidos são obrigatórios.' }, { status: 400 });
    }

    const [existingMember] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
      .limit(1);
    if (!existingMember) {
      return NextResponse.json({ error: 'Vínculo usuário/empresa não encontrado.' }, { status: 404 });
    }

    await db
      .update(teamMembers)
      .set({ role })
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)));
    await db.insert(auditEvents).values({
      actorUserId: auth.user.id,
      teamId,
      module: 'control-center',
      action: `Papel do usuário ${userId} na empresa ${teamId} alterado para ${role}`,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'remove_team') {
    const userId = Number(body.userId);
    const teamId = Number(body.teamId);
    if (!userId || !teamId) {
      return NextResponse.json({ error: 'userId e teamId são obrigatórios.' }, { status: 400 });
    }

    const [existingMember] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
      .limit(1);
    if (!existingMember) {
      return NextResponse.json({ error: 'Vínculo usuário/empresa não encontrado.' }, { status: 404 });
    }

    await db.delete(teamMembers).where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)));
    await db.insert(auditEvents).values({
      actorUserId: auth.user.id,
      teamId,
      module: 'control-center',
      action: `Usuário ${userId} removido da empresa ${teamId}`,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'toggle_block') {
    const userId = Number(body.userId);
    const blocked = Boolean(body.blocked);
    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório.' }, { status: 400 });
    }
    if (userId === auth.user.id) {
      return NextResponse.json({ error: 'Você não pode bloquear a si próprio.' }, { status: 400 });
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!existingUser) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    await db
      .update(users)
      .set({
        deletedAt: blocked ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    await db.insert(auditEvents).values({
      actorUserId: auth.user.id,
      module: 'control-center',
      action: blocked ? `Usuário ${userId} bloqueado` : `Usuário ${userId} desbloqueado`,
    });

    return NextResponse.json({ ok: true });
  }

  const id = Number(body?.id);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!id || !name || !email) {
    return NextResponse.json({ error: 'id, name e email são obrigatórios' }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  const [emailInUse] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, id), isNull(users.deletedAt)))
    .limit(1);

  if (emailInUse) {
    return NextResponse.json({ error: 'Este e-mail já está em uso por outro usuário.' }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set({
      name,
      email,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;
  if (!auth.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }
  if (id === auth.user.id) {
    return NextResponse.json({ error: 'Você não pode excluir o próprio usuário.' }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));

  return NextResponse.json({ ok: true });
}
