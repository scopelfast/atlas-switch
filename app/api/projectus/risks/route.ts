import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { projectusProjects, projectusRisks } from '@/lib/db/schema';
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

  const risks = await db
    .select()
    .from(projectusRisks)
    .where(eq(projectusRisks.projectId, projectId))
    .orderBy(projectusRisks.createdAt);

  return NextResponse.json(risks);
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
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const probability = typeof body?.probability === 'number' ? body.probability : 3;
  const impact = typeof body?.impact === 'number' ? body.impact : 3;
  const status = typeof body?.status === 'string' ? body.status.trim() : 'ABERTO';
  const mitigation = typeof body?.mitigation === 'string' ? body.mitigation.trim() : '';
  const ownerId = body?.ownerId ? Number(body.ownerId) : null;

  if (!projectId || !title) {
    return NextResponse.json({ error: 'projectId e title são obrigatórios' }, { status: 400 });
  }

  const project = await ensureProject(team.id, projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const created = await db
    .insert(projectusRisks)
    .values({
      projectId,
      title,
      description: description || null,
      probability,
      impact,
      status,
      mitigation: mitigation || null,
      ownerId,
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

  const risk = await db.select().from(projectusRisks).where(eq(projectusRisks.id, id)).limit(1);
  if (!risk[0]) {
    return NextResponse.json({ error: 'Risco não encontrado' }, { status: 404 });
  }

  const project = await ensureProject(team.id, risk[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(projectusRisks)
    .set({
      title: typeof body?.title === 'string' ? body.title.trim() : risk[0].title,
      description:
        typeof body?.description === 'string'
          ? body.description.trim()
          : risk[0].description,
      probability:
        typeof body?.probability === 'number' ? body.probability : risk[0].probability,
      impact: typeof body?.impact === 'number' ? body.impact : risk[0].impact,
      status: typeof body?.status === 'string' ? body.status.trim() : risk[0].status,
      mitigation:
        typeof body?.mitigation === 'string'
          ? body.mitigation.trim()
          : risk[0].mitigation,
      ownerId: body?.ownerId ? Number(body.ownerId) : risk[0].ownerId,
      updatedAt: new Date(),
    })
    .where(eq(projectusRisks.id, id))
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

  const risk = await db.select().from(projectusRisks).where(eq(projectusRisks.id, id)).limit(1);
  if (!risk[0]) {
    return NextResponse.json({ error: 'Risco não encontrado' }, { status: 404 });
  }

  const project = await ensureProject(team.id, risk[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  await db.delete(projectusRisks).where(eq(projectusRisks.id, id));
  return NextResponse.json({ ok: true });
}
