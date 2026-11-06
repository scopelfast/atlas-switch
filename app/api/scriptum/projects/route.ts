import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { scriptumProjects } from '@/lib/db/schema';

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
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Number(limitParam) || 50, 100) : 50;

  const conditions = [eq(scriptumProjects.teamId, team.id)];
  if (status) {
    conditions.push(eq(scriptumProjects.status, status));
  }
  if (type) {
    conditions.push(eq(scriptumProjects.type, type));
  }

  const projects = await db
    .select()
    .from(scriptumProjects)
    .where(and(...conditions))
    .orderBy(desc(scriptumProjects.updatedAt))
    .limit(limit);

  return NextResponse.json(projects);
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
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const type = typeof body?.type === 'string' ? body.type.trim() : 'ARTIGO';
  const status = typeof body?.status === 'string' ? body.status.trim() : 'RASCUNHO';
  const goalWords = typeof body?.goalWords === 'number' ? body.goalWords : 1000;
  const currentWords = typeof body?.currentWords === 'number' ? body.currentWords : 0;
  const dueDate = typeof body?.dueDate === 'string' ? body.dueDate : null;
  const summary = typeof body?.summary === 'string' ? body.summary.trim() : null;
  const documentId = body?.documentId ? Number(body.documentId) : null;
  const noteId = body?.noteId ? Number(body.noteId) : null;

  if (!title) {
    return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });
  }

  const created = await db
    .insert(scriptumProjects)
    .values({
      teamId: team.id,
      createdById: user.id,
      documentId,
      noteId,
      title,
      type,
      status,
      goalWords,
      currentWords,
      dueDate,
      summary,
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
    .select()
    .from(scriptumProjects)
    .where(and(eq(scriptumProjects.id, id), eq(scriptumProjects.teamId, team.id)))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(scriptumProjects)
    .set({
      title: typeof body?.title === 'string' ? body.title.trim() : existing[0].title,
      type: typeof body?.type === 'string' ? body.type.trim() : existing[0].type,
      status:
        typeof body?.status === 'string' ? body.status.trim() : existing[0].status,
      goalWords:
        typeof body?.goalWords === 'number' ? body.goalWords : existing[0].goalWords,
      currentWords:
        typeof body?.currentWords === 'number'
          ? body.currentWords
          : existing[0].currentWords,
      dueDate: typeof body?.dueDate === 'string' ? body.dueDate : existing[0].dueDate,
      summary:
        typeof body?.summary === 'string' ? body.summary.trim() : existing[0].summary,
      documentId: body?.documentId ? Number(body.documentId) : existing[0].documentId,
      noteId: body?.noteId ? Number(body.noteId) : existing[0].noteId,
      updatedAt: new Date(),
    })
    .where(eq(scriptumProjects.id, id))
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

  await db
    .delete(scriptumProjects)
    .where(and(eq(scriptumProjects.id, id), eq(scriptumProjects.teamId, team.id)));

  return NextResponse.json({ ok: true });
}
