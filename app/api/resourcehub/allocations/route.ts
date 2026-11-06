import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowTaskForTeam } from '@/lib/db/taskflow';
import { db } from '@/lib/db/drizzle';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  projectusProjects,
  resourcehubAllocations,
  resourcehubResources,
} from '@/lib/db/schema';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';

async function ensureResource(teamId: number, resourceId: number) {
  const resource = await db
    .select()
    .from(resourcehubResources)
    .where(and(eq(resourcehubResources.id, resourceId), eq(resourcehubResources.teamId, teamId)))
    .limit(1);
  return resource[0];
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
  if (!(await teamHasModuleEnabled(team.id, 'resourcehub'))) {
    return NextResponse.json(
      { error: 'O módulo ResourceHub não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const resourceIdParam = searchParams.get('resourceId');

  const teamScope = resourceIdParam
    ? and(
        eq(resourcehubResources.teamId, team.id),
        eq(resourcehubAllocations.resourceId, Number(resourceIdParam)),
      )
    : eq(resourcehubResources.teamId, team.id);

  const rows = await db
    .select()
    .from(resourcehubAllocations)
    .innerJoin(
      resourcehubResources,
      eq(resourcehubAllocations.resourceId, resourcehubResources.id),
    )
    .where(teamScope);

  return NextResponse.json(rows.map((row) => row.resourcehub_allocations));
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
  if (!(await teamHasModuleEnabled(team.id, 'resourcehub'))) {
    return NextResponse.json(
      { error: 'O módulo ResourceHub não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const resourceId = Number(body?.resourceId);
  const projectId = body?.projectId ? Number(body.projectId) : null;
  const taskId = body?.taskId ? Number(body.taskId) : null;
  const startDate = typeof body?.startDate === 'string' ? body.startDate : '';
  const endDate = typeof body?.endDate === 'string' ? body.endDate : '';
  const hoursPerWeek = typeof body?.hoursPerWeek === 'number' ? body.hoursPerWeek : 8;
  const status = typeof body?.status === 'string' ? body.status.trim() : 'ATIVO';

  if (!resourceId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'resourceId, startDate e endDate são obrigatórios' },
      { status: 400 },
    );
  }

  const resource = await ensureResource(team.id, resourceId);
  if (!resource) {
    return NextResponse.json({ error: 'Recurso não encontrado' }, { status: 404 });
  }

  if (projectId) {
    const project = await db
      .select()
      .from(projectusProjects)
      .where(and(eq(projectusProjects.id, projectId), eq(projectusProjects.teamId, team.id)))
      .limit(1);
    if (!project[0]) {
      return NextResponse.json({ error: 'Projeto inválido' }, { status: 400 });
    }
  }

  if (taskId) {
    const taskRow = await getTaskflowTaskForTeam(
      taskId,
      team.id,
      taskflowBoardOptionsForUser(user.id, user.role),
    );
    if (!taskRow) {
      return NextResponse.json({ error: 'Tarefa inválida' }, { status: 400 });
    }
  }

  const created = await db
    .insert(resourcehubAllocations)
    .values({
      resourceId,
      projectId,
      taskId,
      startDate,
      endDate,
      hoursPerWeek,
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
  if (!(await teamHasModuleEnabled(team.id, 'resourcehub'))) {
    return NextResponse.json(
      { error: 'O módulo ResourceHub não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const allocation = await db
    .select()
    .from(resourcehubAllocations)
    .where(eq(resourcehubAllocations.id, id))
    .limit(1);

  if (!allocation[0]) {
    return NextResponse.json({ error: 'Alocação não encontrada' }, { status: 404 });
  }

  const resource = await ensureResource(team.id, allocation[0].resourceId);
  if (!resource) {
    return NextResponse.json({ error: 'Recurso não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(resourcehubAllocations)
    .set({
      startDate:
        typeof body?.startDate === 'string' ? body.startDate : allocation[0].startDate,
      endDate:
        typeof body?.endDate === 'string' ? body.endDate : allocation[0].endDate,
      hoursPerWeek:
        typeof body?.hoursPerWeek === 'number'
          ? body.hoursPerWeek
          : allocation[0].hoursPerWeek,
      status: typeof body?.status === 'string' ? body.status.trim() : allocation[0].status,
      updatedAt: new Date(),
    })
    .where(eq(resourcehubAllocations.id, id))
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
  if (!(await teamHasModuleEnabled(team.id, 'resourcehub'))) {
    return NextResponse.json(
      { error: 'O módulo ResourceHub não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(resourcehubAllocations)
    .innerJoin(
      resourcehubResources,
      eq(resourcehubAllocations.resourceId, resourcehubResources.id),
    )
    .where(and(eq(resourcehubAllocations.id, id), eq(resourcehubResources.teamId, team.id)))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ error: 'Alocação não encontrada' }, { status: 404 });
  }

  await db.delete(resourcehubAllocations).where(eq(resourcehubAllocations.id, id));
  return NextResponse.json({ ok: true });
}
