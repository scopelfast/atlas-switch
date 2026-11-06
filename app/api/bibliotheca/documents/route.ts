import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { bibliothecaDocuments } from '@/lib/db/schema';

/**
 * Retorna documentos da Bibliotheca (MVP).
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const teamRaw = await getTeamForUser();
  const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
  if (!team || typeof team !== 'object' || typeof team.id !== 'number') {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const projectId = searchParams.get('projectId');
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Number(limitParam) || 20, 100) : 20;

  const conditions = [eq(bibliothecaDocuments.teamId, team.id)];
  if (category) {
    conditions.push(eq(bibliothecaDocuments.category, category));
  }
  if (status) {
    conditions.push(eq(bibliothecaDocuments.status, status));
  }
  if (projectId) {
    conditions.push(eq(bibliothecaDocuments.projectId, Number(projectId)));
  }

  const documents = await db
    .select({
      id: bibliothecaDocuments.id,
      title: bibliothecaDocuments.title,
      titulo: bibliothecaDocuments.title,
      category: bibliothecaDocuments.category,
      categoria: bibliothecaDocuments.category,
      size: bibliothecaDocuments.size,
      tamanho: bibliothecaDocuments.size,
      status: bibliothecaDocuments.status,
      visibility: bibliothecaDocuments.visibility,
      tags: bibliothecaDocuments.tags,
      description: bibliothecaDocuments.description,
      fileUrl: bibliothecaDocuments.fileUrl,
      fileType: bibliothecaDocuments.fileType,
      source: bibliothecaDocuments.source,
      projectId: bibliothecaDocuments.projectId,
      taskId: bibliothecaDocuments.taskId,
      createdAt: bibliothecaDocuments.createdAt,
    })
    .from(bibliothecaDocuments)
    .where(and(...conditions))
    .orderBy(desc(bibliothecaDocuments.createdAt))
    .limit(limit);

  return NextResponse.json(documents);
}

/**
 * Cria um documento na Bibliotheca (MVP).
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const teamRaw = await getTeamForUser();
  const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
  if (!team || typeof team !== 'object' || typeof team.id !== 'number') {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }

  const body = await request.json();
  const title =
    typeof body?.title === 'string'
      ? body.title.trim()
      : typeof body?.titulo === 'string'
        ? body.titulo.trim()
        : '';
  const category =
    typeof body?.category === 'string'
      ? body.category.trim()
      : typeof body?.categoria === 'string'
        ? body.categoria.trim()
        : '';
  const size =
    typeof body?.size === 'string'
      ? body.size.trim()
      : typeof body?.tamanho === 'string'
        ? body.tamanho.trim()
        : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : 'ATIVO';
  const visibility =
    typeof body?.visibility === 'string' ? body.visibility.trim() : 'EQUIPE';
  const tags = typeof body?.tags === 'string' ? body.tags.trim() : null;
  const description =
    typeof body?.description === 'string' ? body.description.trim() : null;
  const fileUrl = typeof body?.fileUrl === 'string' ? body.fileUrl.trim() : null;
  const fileType =
    typeof body?.fileType === 'string' ? body.fileType.trim() : null;
  const source = typeof body?.source === 'string' ? body.source.trim() : 'UPLOAD';
  const projectId = body?.projectId ? Number(body.projectId) : null;
  const taskId = body?.taskId ? Number(body.taskId) : null;

  if (!title || !category || !size) {
    return NextResponse.json(
      { error: 'title, category e size são obrigatórios' },
      { status: 400 },
    );
  }

  const created = await db
    .insert(bibliothecaDocuments)
    .values({
      teamId: team.id,
      createdById: user.id,
      projectId,
      taskId,
      title,
      category,
      size,
      status,
      visibility,
      tags,
      description,
      fileUrl,
      fileType,
      source,
    })
    .returning({
      id: bibliothecaDocuments.id,
      title: bibliothecaDocuments.title,
      titulo: bibliothecaDocuments.title,
      category: bibliothecaDocuments.category,
      categoria: bibliothecaDocuments.category,
      size: bibliothecaDocuments.size,
      tamanho: bibliothecaDocuments.size,
      status: bibliothecaDocuments.status,
      visibility: bibliothecaDocuments.visibility,
      tags: bibliothecaDocuments.tags,
      description: bibliothecaDocuments.description,
      fileUrl: bibliothecaDocuments.fileUrl,
      fileType: bibliothecaDocuments.fileType,
      source: bibliothecaDocuments.source,
      projectId: bibliothecaDocuments.projectId,
      taskId: bibliothecaDocuments.taskId,
    });

  return NextResponse.json(created[0], { status: 201 });
}

/**
 * Atualiza um documento na Bibliotheca.
 */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const teamRaw = await getTeamForUser();
  const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
  if (!team || typeof team !== 'object' || typeof team.id !== 'number') {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(bibliothecaDocuments)
    .where(and(eq(bibliothecaDocuments.id, id), eq(bibliothecaDocuments.teamId, team.id)))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  }

  const updated = await db
    .update(bibliothecaDocuments)
    .set({
      title:
        typeof body?.title === 'string'
          ? body.title.trim()
          : typeof body?.titulo === 'string'
            ? body.titulo.trim()
            : existing[0].title,
      category:
        typeof body?.category === 'string'
          ? body.category.trim()
          : typeof body?.categoria === 'string'
            ? body.categoria.trim()
            : existing[0].category,
      size:
        typeof body?.size === 'string'
          ? body.size.trim()
          : typeof body?.tamanho === 'string'
            ? body.tamanho.trim()
            : existing[0].size,
      status: typeof body?.status === 'string' ? body.status.trim() : existing[0].status,
      visibility:
        typeof body?.visibility === 'string' ? body.visibility.trim() : existing[0].visibility,
      tags: typeof body?.tags === 'string' ? body.tags.trim() : existing[0].tags,
      description:
        typeof body?.description === 'string' ? body.description.trim() : existing[0].description,
      fileUrl: typeof body?.fileUrl === 'string' ? body.fileUrl.trim() : existing[0].fileUrl,
      fileType:
        typeof body?.fileType === 'string' ? body.fileType.trim() : existing[0].fileType,
      source: typeof body?.source === 'string' ? body.source.trim() : existing[0].source,
      projectId: body?.projectId ? Number(body.projectId) : existing[0].projectId,
      taskId: body?.taskId ? Number(body.taskId) : existing[0].taskId,
      updatedAt: new Date(),
    })
    .where(eq(bibliothecaDocuments.id, id))
    .returning({
      id: bibliothecaDocuments.id,
      title: bibliothecaDocuments.title,
      titulo: bibliothecaDocuments.title,
      category: bibliothecaDocuments.category,
      categoria: bibliothecaDocuments.category,
      size: bibliothecaDocuments.size,
      tamanho: bibliothecaDocuments.size,
      status: bibliothecaDocuments.status,
      visibility: bibliothecaDocuments.visibility,
      tags: bibliothecaDocuments.tags,
      description: bibliothecaDocuments.description,
      fileUrl: bibliothecaDocuments.fileUrl,
      fileType: bibliothecaDocuments.fileType,
      source: bibliothecaDocuments.source,
      projectId: bibliothecaDocuments.projectId,
      taskId: bibliothecaDocuments.taskId,
    });

  return NextResponse.json(updated[0]);
}

/**
 * Remove um documento da Bibliotheca.
 */
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const teamRaw = await getTeamForUser();
  const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
  if (!team || typeof team !== 'object' || typeof team.id !== 'number') {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  await db
    .delete(bibliothecaDocuments)
    .where(and(eq(bibliothecaDocuments.id, id), eq(bibliothecaDocuments.teamId, team.id)));

  return NextResponse.json({ ok: true });
}
