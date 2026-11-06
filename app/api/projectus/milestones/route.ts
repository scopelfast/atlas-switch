import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { projectusMilestones, projectusProjects } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

async function ensureProject(teamId: number, projectId: number) {
  const project = await db
    .select()
    .from(projectusProjects)
    .where(and(eq(projectusProjects.id, projectId), eq(projectusProjects.teamId, teamId)))
    .limit(1);
  return project[0];
}

export async function GET(request: Request) {
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
  const projectId = Number(searchParams.get('projectId'));
  if (!projectId) {
    return NextResponse.json({ error: 'projectId é obrigatório' }, { status: 400 });
  }

  const project = await ensureProject(team.id, projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const milestones = await db
    .select()
    .from(projectusMilestones)
    .where(eq(projectusMilestones.projectId, projectId))
    .orderBy(projectusMilestones.dueDate);

  return NextResponse.json(milestones);
}

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
  const projectId = Number(body?.projectId);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const dueDate = typeof body?.dueDate === 'string' ? body.dueDate : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : 'ABERTO';

  if (!projectId || !name || !dueDate) {
    return NextResponse.json(
      { error: 'projectId, name e dueDate são obrigatórios' },
      { status: 400 },
    );
  }

  const project = await ensureProject(team.id, projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const created = await db
    .insert(projectusMilestones)
    .values({
      projectId,
      name,
      dueDate,
      status,
    })
    .returning();

  return NextResponse.json(created[0], { status: 201 });
}

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

  const milestone = await db
    .select()
    .from(projectusMilestones)
    .where(eq(projectusMilestones.id, id))
    .limit(1);

  if (!milestone[0]) {
    return NextResponse.json({ error: 'Marco não encontrado' }, { status: 404 });
  }

  const project = await ensureProject(team.id, milestone[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(projectusMilestones)
    .set({
      name: typeof body?.name === 'string' ? body.name.trim() : milestone[0].name,
      dueDate:
        typeof body?.dueDate === 'string' ? body.dueDate : milestone[0].dueDate,
      status: typeof body?.status === 'string' ? body.status.trim() : milestone[0].status,
      updatedAt: new Date(),
    })
    .where(eq(projectusMilestones.id, id))
    .returning();

  return NextResponse.json(updated[0]);
}

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
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const milestone = await db
    .select()
    .from(projectusMilestones)
    .where(eq(projectusMilestones.id, id))
    .limit(1);

  if (!milestone[0]) {
    return NextResponse.json({ error: 'Marco não encontrado' }, { status: 404 });
  }

  const project = await ensureProject(team.id, milestone[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  await db.delete(projectusMilestones).where(eq(projectusMilestones.id, id));
  return NextResponse.json({ ok: true });
}
