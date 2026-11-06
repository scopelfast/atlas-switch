import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { projectusProjects } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * Retorna projetos do Projectus (MVP).
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'projectus'))) {
    return NextResponse.json(
      { error: 'O módulo Projectus não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const projects = await db
    .select({
      id: projectusProjects.id,
      nome: projectusProjects.name,
      status: projectusProjects.status,
      prazo: projectusProjects.dueDate,
      budgetCents: projectusProjects.budgetCents,
    })
    .from(projectusProjects)
    .where(eq(projectusProjects.teamId, team.id))
    .orderBy(projectusProjects.createdAt);

  return NextResponse.json(projects);
}

/**
 * Cria um projeto no Projectus.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'projectus'))) {
    return NextResponse.json(
      { error: 'O módulo Projectus não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : 'EM_ANDAMENTO';
  const dueDate = typeof body?.dueDate === 'string' ? body.dueDate : null;
  const budgetCents = typeof body?.budgetCents === 'number' ? body.budgetCents : 0;

  if (!name) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
  }

  const created = await db
    .insert(projectusProjects)
    .values({
      teamId: team.id,
      name,
      status,
      dueDate: dueDate ? new Date(dueDate) : null,
      budgetCents,
    })
    .returning({
      id: projectusProjects.id,
      nome: projectusProjects.name,
      status: projectusProjects.status,
      prazo: projectusProjects.dueDate,
      budgetCents: projectusProjects.budgetCents,
    });

  return NextResponse.json(created[0], { status: 201 });
}

/**
 * Atualiza um projeto do Projectus.
 */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'projectus'))) {
    return NextResponse.json(
      { error: 'O módulo Projectus não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const id = Number(body?.id);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(projectusProjects)
    .where(and(eq(projectusProjects.id, id), eq(projectusProjects.teamId, team.id)))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : existing[0].name;
  const status =
    typeof body?.status === 'string' ? body.status.trim() : existing[0].status;
  const dueDate =
    typeof body?.dueDate === 'string' ? body.dueDate : existing[0].dueDate?.toISOString();
  const budgetCents =
    typeof body?.budgetCents === 'number' ? body.budgetCents : existing[0].budgetCents;

  const updated = await db
    .update(projectusProjects)
    .set({
      name,
      status,
      dueDate: dueDate ? new Date(dueDate) : null,
      budgetCents,
      updatedAt: new Date(),
    })
    .where(eq(projectusProjects.id, id))
    .returning({
      id: projectusProjects.id,
      nome: projectusProjects.name,
      status: projectusProjects.status,
      prazo: projectusProjects.dueDate,
      budgetCents: projectusProjects.budgetCents,
    });

  return NextResponse.json(updated[0]);
}

/**
 * Remove um projeto do Projectus.
 */
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'projectus'))) {
    return NextResponse.json(
      { error: 'O módulo Projectus não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  let id = idParam ? Number(idParam) : NaN;

  if (!id || Number.isNaN(id)) {
    try {
      const body = await request.json();
      id = Number(body?.id);
    } catch {
      id = NaN;
    }
  }

  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  await db
    .delete(projectusProjects)
    .where(and(eq(projectusProjects.id, id), eq(projectusProjects.teamId, team.id)));

  return NextResponse.json({ ok: true });
}
