import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { projectusPhases, projectusProjects } from '@/lib/db/schema';
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

  const phases = await db
    .select()
    .from(projectusPhases)
    .where(eq(projectusPhases.projectId, projectId))
    .orderBy(projectusPhases.position);

  return NextResponse.json(phases);
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
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const startDate = typeof body?.startDate === 'string' ? body.startDate : null;
  const endDate = typeof body?.endDate === 'string' ? body.endDate : null;
  const status = typeof body?.status === 'string' ? body.status.trim() : 'PLANEJADA';
  const position = typeof body?.position === 'number' ? body.position : 0;

  if (!projectId || !name) {
    return NextResponse.json({ error: 'projectId e name são obrigatórios' }, { status: 400 });
  }

  const project = await ensureProject(team.id, projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const created = await db
    .insert(projectusPhases)
    .values({
      projectId,
      name,
      description: description || null,
      startDate: startDate || null,
      endDate: endDate || null,
      status,
      position,
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

  const phase = await db
    .select()
    .from(projectusPhases)
    .where(eq(projectusPhases.id, id))
    .limit(1);

  if (!phase[0]) {
    return NextResponse.json({ error: 'Fase não encontrada' }, { status: 404 });
  }

  const project = await ensureProject(team.id, phase[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(projectusPhases)
    .set({
      name: typeof body?.name === 'string' ? body.name.trim() : phase[0].name,
      description:
        typeof body?.description === 'string'
          ? body.description.trim()
          : phase[0].description,
      startDate:
        typeof body?.startDate === 'string' ? body.startDate : phase[0].startDate,
      endDate:
        typeof body?.endDate === 'string' ? body.endDate : phase[0].endDate,
      status: typeof body?.status === 'string' ? body.status.trim() : phase[0].status,
      position: typeof body?.position === 'number' ? body.position : phase[0].position,
      updatedAt: new Date(),
    })
    .where(eq(projectusPhases.id, id))
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

  const phase = await db
    .select()
    .from(projectusPhases)
    .where(eq(projectusPhases.id, id))
    .limit(1);

  if (!phase[0]) {
    return NextResponse.json({ error: 'Fase não encontrada' }, { status: 404 });
  }

  const project = await ensureProject(team.id, phase[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  await db.delete(projectusPhases).where(eq(projectusPhases.id, id));

  return NextResponse.json({ ok: true });
}
