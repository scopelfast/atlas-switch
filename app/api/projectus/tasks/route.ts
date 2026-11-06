import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { projectusProjects, projectusTasks } from '@/lib/db/schema';
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

  const tasks = await db
    .select()
    .from(projectusTasks)
    .where(eq(projectusTasks.projectId, projectId))
    .orderBy(projectusTasks.createdAt);

  return NextResponse.json(tasks);
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
  const phaseId = body?.phaseId ? Number(body.phaseId) : null;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const assigneeId = body?.assigneeId ? Number(body.assigneeId) : null;
  const status = typeof body?.status === 'string' ? body.status.trim() : 'ABERTA';
  const priority = typeof body?.priority === 'string' ? body.priority.trim() : 'MEDIA';
  const startDate = typeof body?.startDate === 'string' ? body.startDate : null;
  const dueDate = typeof body?.dueDate === 'string' ? body.dueDate : null;
  const effortHours = typeof body?.effortHours === 'number' ? body.effortHours : null;
  const progress = typeof body?.progress === 'number' ? body.progress : 0;

  if (!projectId || !title) {
    return NextResponse.json({ error: 'projectId e title são obrigatórios' }, { status: 400 });
  }

  const project = await ensureProject(team.id, projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const created = await db
    .insert(projectusTasks)
    .values({
      projectId,
      phaseId,
      title,
      description: description || null,
      assigneeId,
      status,
      priority,
      startDate: startDate || null,
      dueDate: dueDate || null,
      effortHours,
      progress,
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

  const task = await db.select().from(projectusTasks).where(eq(projectusTasks.id, id)).limit(1);
  if (!task[0]) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const project = await ensureProject(team.id, task[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(projectusTasks)
    .set({
      phaseId: body?.phaseId ? Number(body.phaseId) : task[0].phaseId,
      title: typeof body?.title === 'string' ? body.title.trim() : task[0].title,
      description:
        typeof body?.description === 'string'
          ? body.description.trim()
          : task[0].description,
      assigneeId: body?.assigneeId ? Number(body.assigneeId) : task[0].assigneeId,
      status: typeof body?.status === 'string' ? body.status.trim() : task[0].status,
      priority:
        typeof body?.priority === 'string' ? body.priority.trim() : task[0].priority,
      startDate:
        typeof body?.startDate === 'string' ? body.startDate : task[0].startDate,
      dueDate:
        typeof body?.dueDate === 'string' ? body.dueDate : task[0].dueDate,
      effortHours:
        typeof body?.effortHours === 'number' ? body.effortHours : task[0].effortHours,
      progress: typeof body?.progress === 'number' ? body.progress : task[0].progress,
      updatedAt: new Date(),
    })
    .where(eq(projectusTasks.id, id))
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

  const task = await db.select().from(projectusTasks).where(eq(projectusTasks.id, id)).limit(1);
  if (!task[0]) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const project = await ensureProject(team.id, task[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  await db.delete(projectusTasks).where(eq(projectusTasks.id, id));
  return NextResponse.json({ ok: true });
}
