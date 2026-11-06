import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowTaskTypeDefinitions } from '@/lib/db/schema';
import { NATIVE_TASK_TYPES, normalizeCustomTaskTypeCode } from '@/lib/taskflow/task-type';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

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

  const custom = await db
    .select()
    .from(taskflowTaskTypeDefinitions)
    .where(eq(taskflowTaskTypeDefinitions.teamId, team.id))
    .orderBy(asc(taskflowTaskTypeDefinitions.position));

  return NextResponse.json({
    native: NATIVE_TASK_TYPES.map((t) => ({ code: t.code, name: t.label })),
    custom,
  });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão para gerir tipos de tarefa.' }, { status: 403 });
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

  const body = await request.json().catch(() => ({}));
  const codeParsed = normalizeCustomTaskTypeCode(body?.code);
  if (!codeParsed.ok) {
    return NextResponse.json({ error: codeParsed.error }, { status: 400 });
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
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
    .select({ id: taskflowTaskTypeDefinitions.id })
    .from(taskflowTaskTypeDefinitions)
    .where(
      and(
        eq(taskflowTaskTypeDefinitions.teamId, team.id),
        eq(taskflowTaskTypeDefinitions.code, codeParsed.value),
      ),
    )
    .limit(1);
  if (dup[0]) {
    return NextResponse.json({ error: 'Já existe um tipo com este código.' }, { status: 400 });
  }

  const now = new Date();
  const [created] = await db
    .insert(taskflowTaskTypeDefinitions)
    .values({
      teamId: team.id,
      code: codeParsed.value,
      name,
      description,
      position,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
