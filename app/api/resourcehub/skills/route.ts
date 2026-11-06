import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { resourcehubSkills } from '@/lib/db/schema';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const skills = await db.select().from(resourcehubSkills).orderBy(resourcehubSkills.name);
  return NextResponse.json(skills);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(resourcehubSkills)
    .where(eq(resourcehubSkills.name, name))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json(existing[0]);
  }

  const created = await db.insert(resourcehubSkills).values({ name }).returning();
  return NextResponse.json(created[0], { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  await db.delete(resourcehubSkills).where(eq(resourcehubSkills.id, id));
  return NextResponse.json({ ok: true });
}
