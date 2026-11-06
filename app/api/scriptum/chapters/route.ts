import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { scriptumChapters, scriptumProjects } from '@/lib/db/schema';

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId é obrigatório' }, { status: 400 });
  }

  const projects = await db
    .select()
    .from(scriptumProjects)
    .where(and(eq(scriptumProjects.id, Number(projectId)), eq(scriptumProjects.teamId, team.id)))
    .limit(1);

  if (!projects[0]) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const chapters = await db
    .select()
    .from(scriptumChapters)
    .where(eq(scriptumChapters.projectId, Number(projectId)))
    .orderBy(asc(scriptumChapters.position));

  return NextResponse.json(chapters);
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

  const body = await request.json();
  const projectId = Number(body?.projectId);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : 'EM_PROGRESSO';
  const wordCount = typeof body?.wordCount === 'number' ? body.wordCount : 0;
  const position = typeof body?.position === 'number' ? body.position : 0;
  const content = typeof body?.content === 'string' ? body.content.trim() : null;

  if (!projectId || !title) {
    return NextResponse.json(
      { error: 'projectId e title são obrigatórios' },
      { status: 400 },
    );
  }

  const projects = await db
    .select()
    .from(scriptumProjects)
    .where(and(eq(scriptumProjects.id, projectId), eq(scriptumProjects.teamId, team.id)))
    .limit(1);

  if (!projects[0]) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const created = await db
    .insert(scriptumChapters)
    .values({
      projectId,
      title,
      status,
      wordCount,
      position,
      content,
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

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const existing = await db
    .select({
      id: scriptumChapters.id,
      projectId: scriptumChapters.projectId,
    })
    .from(scriptumChapters)
    .where(eq(scriptumChapters.id, id))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Capítulo não encontrado' }, { status: 404 });
  }

  const project = await db
    .select()
    .from(scriptumProjects)
    .where(and(eq(scriptumProjects.id, existing[0].projectId), eq(scriptumProjects.teamId, team.id)))
    .limit(1);

  if (!project[0]) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(scriptumChapters)
    .set({
      title: typeof body?.title === 'string' ? body.title.trim() : undefined,
      status: typeof body?.status === 'string' ? body.status.trim() : undefined,
      wordCount: typeof body?.wordCount === 'number' ? body.wordCount : undefined,
      position: typeof body?.position === 'number' ? body.position : undefined,
      content: typeof body?.content === 'string' ? body.content.trim() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(scriptumChapters.id, id))
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

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  await db.delete(scriptumChapters).where(eq(scriptumChapters.id, id));
  return NextResponse.json({ ok: true });
}
