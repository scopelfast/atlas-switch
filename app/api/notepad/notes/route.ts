import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { notepadNotes } from '@/lib/db/schema';

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
  const folder = searchParams.get('folder');
  const status = searchParams.get('status');
  const projectId = searchParams.get('projectId');
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Number(limitParam) || 50, 100) : 50;

  const conditions = [eq(notepadNotes.teamId, team.id)];
  if (folder) {
    conditions.push(eq(notepadNotes.folder, folder));
  }
  if (status) {
    conditions.push(eq(notepadNotes.status, status));
  }
  if (projectId) {
    conditions.push(eq(notepadNotes.projectId, Number(projectId)));
  }

  const notes = await db
    .select()
    .from(notepadNotes)
    .where(and(...conditions))
    .orderBy(desc(notepadNotes.updatedAt))
    .limit(limit);

  return NextResponse.json(notes);
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
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const folder = typeof body?.folder === 'string' ? body.folder.trim() : 'Geral';
  const tags = typeof body?.tags === 'string' ? body.tags.trim() : null;
  const status = typeof body?.status === 'string' ? body.status.trim() : 'ATIVA';
  const visibility =
    typeof body?.visibility === 'string' ? body.visibility.trim() : 'EQUIPE';
  const pinned = typeof body?.pinned === 'boolean' ? body.pinned : false;
  const source = typeof body?.source === 'string' ? body.source.trim() : 'MANUAL';
  const projectId = body?.projectId ? Number(body.projectId) : null;
  const taskId = body?.taskId ? Number(body.taskId) : null;
  const documentId = body?.documentId ? Number(body.documentId) : null;

  if (!title) {
    return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });
  }

  const created = await db
    .insert(notepadNotes)
    .values({
      teamId: team.id,
      createdById: user.id,
      projectId,
      taskId,
      documentId,
      title,
      content,
      folder,
      tags,
      status,
      visibility,
      pinned,
      source,
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
    .from(notepadNotes)
    .where(and(eq(notepadNotes.id, id), eq(notepadNotes.teamId, team.id)))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 });
  }

  const updated = await db
    .update(notepadNotes)
    .set({
      title: typeof body?.title === 'string' ? body.title.trim() : existing[0].title,
      content:
        typeof body?.content === 'string' ? body.content.trim() : existing[0].content,
      folder:
        typeof body?.folder === 'string' ? body.folder.trim() : existing[0].folder,
      tags: typeof body?.tags === 'string' ? body.tags.trim() : existing[0].tags,
      status:
        typeof body?.status === 'string' ? body.status.trim() : existing[0].status,
      visibility:
        typeof body?.visibility === 'string'
          ? body.visibility.trim()
          : existing[0].visibility,
      pinned: typeof body?.pinned === 'boolean' ? body.pinned : existing[0].pinned,
      projectId: body?.projectId ? Number(body.projectId) : existing[0].projectId,
      taskId: body?.taskId ? Number(body.taskId) : existing[0].taskId,
      documentId: body?.documentId ? Number(body.documentId) : existing[0].documentId,
      updatedAt: new Date(),
    })
    .where(eq(notepadNotes.id, id))
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
    .delete(notepadNotes)
    .where(and(eq(notepadNotes.id, id), eq(notepadNotes.teamId, team.id)));

  return NextResponse.json({ ok: true });
}
