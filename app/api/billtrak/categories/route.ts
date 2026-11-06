import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { billtrakCategories } from '@/lib/db/schema';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const categories = await db.select().from(billtrakCategories).orderBy(billtrakCategories.name);
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const type = typeof body?.type === 'string' ? body.type.trim() : '';

  if (!name || !type) {
    return NextResponse.json({ error: 'name e type são obrigatórios' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(billtrakCategories)
    .where(eq(billtrakCategories.name, name))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json(existing[0]);
  }

  const created = await db.insert(billtrakCategories).values({ name, type }).returning();
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

  await db.delete(billtrakCategories).where(eq(billtrakCategories.id, id));
  return NextResponse.json({ ok: true });
}
