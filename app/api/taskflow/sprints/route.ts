import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowSprints } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

function parseIsoInstant(label: string, raw: unknown): { ok: true; d: Date } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: false, error: `${label} é obrigatório` };
  }
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `${label} inválido` };
  }
  return { ok: true, d };
}

/** E8.9 — lista sprints do time (ordenados do mais recente). */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!hasPermission(normalizeRole(user.role), 'taskflow.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }
  const rows = await db
    .select()
    .from(taskflowSprints)
    .where(eq(taskflowSprints.teamId, team.id))
    .orderBy(desc(taskflowSprints.startAt), desc(taskflowSprints.id));
  return NextResponse.json({ sprints: rows });
}

/** E8.9 — cria sprint (owner/admin/gestor). */
export async function POST(request: Request) {
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
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
  }
  const start = parseIsoInstant('startAt', body.startAt);
  const end = parseIsoInstant('endAt', body.endAt);
  if (!start.ok) {
    return NextResponse.json({ error: start.error }, { status: 400 });
  }
  if (!end.ok) {
    return NextResponse.json({ error: end.error }, { status: 400 });
  }
  if (start.d.getTime() >= end.d.getTime()) {
    return NextResponse.json({ error: 'startAt deve ser anterior a endAt' }, { status: 400 });
  }
  const now = new Date();
  const [row] = await db
    .insert(taskflowSprints)
    .values({
      teamId: team.id,
      name,
      startAt: start.d,
      endAt: end.d,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
