import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { ensureDefaultStatusDefinitions } from '@/lib/db/taskflow';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowStatusDefinitions } from '@/lib/db/schema';
import { normalizeLabelColorForApi } from '@/lib/taskflow/label-color';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  normalizeFixedSituation,
  normalizeStatusDefinitionCode,
} from '@/lib/taskflow/status-definition';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
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

  await ensureDefaultStatusDefinitions(team.id);

  const rows = await db
    .select()
    .from(taskflowStatusDefinitions)
    .where(eq(taskflowStatusDefinitions.teamId, team.id))
    .orderBy(asc(taskflowStatusDefinitions.position));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão para gerir o catálogo de status.' }, { status: 403 });
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

  await ensureDefaultStatusDefinitions(team.id);

  const body = await request.json().catch(() => ({}));
  const codeParsed = normalizeStatusDefinitionCode(body?.code);
  if (!codeParsed.ok) {
    return NextResponse.json({ error: codeParsed.error }, { status: 400 });
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
  }

  const fixed = normalizeFixedSituation(body?.fixedSituation);
  if (!fixed) {
    return NextResponse.json(
      { error: 'fixedSituation inválido (OPEN, IN_PROGRESS, BLOCKED, DONE, CANCELLED)' },
      { status: 400 },
    );
  }

  const colorNorm = normalizeLabelColorForApi(
    typeof body?.color === 'string' ? body.color : 'slate',
  );
  if (!colorNorm.ok) {
    return NextResponse.json({ error: colorNorm.error }, { status: 400 });
  }

  const description =
    typeof body?.description === 'string' ? body.description.trim() || null : null;

  let position = 0;
  if (body?.position !== undefined && body?.position !== null && body?.position !== '') {
    const p = Number(body.position);
    if (!Number.isFinite(p)) {
      return NextResponse.json({ error: 'position inválido' }, { status: 400 });
    }
    position = p;
  }

  const dup = await db
    .select({ id: taskflowStatusDefinitions.id })
    .from(taskflowStatusDefinitions)
    .where(
      and(
        eq(taskflowStatusDefinitions.teamId, team.id),
        eq(taskflowStatusDefinitions.code, codeParsed.value),
      ),
    )
    .limit(1);
  if (dup[0]) {
    return NextResponse.json({ error: 'Já existe um status com este código.' }, { status: 400 });
  }

  const now = new Date();
  const [created] = await db
    .insert(taskflowStatusDefinitions)
    .values({
      teamId: team.id,
      code: codeParsed.value,
      name,
      description,
      fixedSituation: fixed,
      color: colorNorm.value,
      position,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
