import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import {
  projectusProjects,
  projectusTaskDependencies,
  projectusTasks,
} from '@/lib/db/schema';
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

  const dependencies = await db
    .select()
    .from(projectusTaskDependencies)
    .leftJoin(projectusTasks, eq(projectusTasks.id, projectusTaskDependencies.taskId))
    .where(eq(projectusTasks.projectId, projectId));

  return NextResponse.json(
    dependencies.map((row) => ({
      id: row.projectus_task_dependencies.id,
      taskId: row.projectus_task_dependencies.taskId,
      dependsOnTaskId: row.projectus_task_dependencies.dependsOnTaskId,
    })),
  );
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
  const taskId = Number(body?.taskId);
  const dependsOnTaskId = Number(body?.dependsOnTaskId);

  if (!projectId || !taskId || !dependsOnTaskId) {
    return NextResponse.json(
      { error: 'projectId, taskId e dependsOnTaskId são obrigatórios' },
      { status: 400 },
    );
  }

  const project = await ensureProject(team.id, projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const tasks = await db
    .select()
    .from(projectusTasks)
    .where(eq(projectusTasks.projectId, projectId));

  const validIds = new Set(tasks.map((task) => task.id));
  if (!validIds.has(taskId) || !validIds.has(dependsOnTaskId)) {
    return NextResponse.json({ error: 'Dependência inválida' }, { status: 400 });
  }

  const created = await db
    .insert(projectusTaskDependencies)
    .values({
      taskId,
      dependsOnTaskId,
    })
    .returning();

  return NextResponse.json(created[0], { status: 201 });
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

  const dependency = await db
    .select()
    .from(projectusTaskDependencies)
    .where(eq(projectusTaskDependencies.id, id))
    .limit(1);

  if (!dependency[0]) {
    return NextResponse.json({ error: 'Dependência não encontrada' }, { status: 404 });
  }

  const task = await db
    .select()
    .from(projectusTasks)
    .where(eq(projectusTasks.id, dependency[0].taskId))
    .limit(1);

  if (!task[0]) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const project = await ensureProject(team.id, task[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  await db.delete(projectusTaskDependencies).where(eq(projectusTaskDependencies.id, id));
  return NextResponse.json({ ok: true });
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
  const taskId = Number(body?.taskId);
  const dependsOnTaskId = Number(body?.dependsOnTaskId);

  if (!id || !taskId || !dependsOnTaskId) {
    return NextResponse.json(
      { error: 'id, taskId e dependsOnTaskId são obrigatórios' },
      { status: 400 },
    );
  }

  const dependency = await db
    .select()
    .from(projectusTaskDependencies)
    .where(eq(projectusTaskDependencies.id, id))
    .limit(1);
  if (!dependency[0]) {
    return NextResponse.json({ error: 'Dependência não encontrada' }, { status: 404 });
  }

  const task = await db
    .select()
    .from(projectusTasks)
    .where(eq(projectusTasks.id, taskId))
    .limit(1);
  const dependsOnTask = await db
    .select()
    .from(projectusTasks)
    .where(eq(projectusTasks.id, dependsOnTaskId))
    .limit(1);

  if (!task[0] || !dependsOnTask[0] || task[0].projectId !== dependsOnTask[0].projectId) {
    return NextResponse.json({ error: 'Dependência inválida' }, { status: 400 });
  }

  const project = await ensureProject(team.id, task[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(projectusTaskDependencies)
    .set({
      taskId,
      dependsOnTaskId,
    })
    .where(eq(projectusTaskDependencies.id, id))
    .returning();

  return NextResponse.json(updated[0]);
}
