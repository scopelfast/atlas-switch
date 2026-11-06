import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { aiModels } from '@/lib/db/schema';

const ensureOwner = async () => {
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  }
  if (!canAccessControlPlane(user)) {
    return { error: NextResponse.json({ error: 'Acesso restrito' }, { status: 403 }) };
  }
  return { user };
};

export async function GET() {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const models = await db.select().from(aiModels).orderBy(aiModels.createdAt);
  return NextResponse.json(models);
}

export async function POST(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const provider = typeof body?.provider === 'string' ? body.provider.trim() : '';
  const type = typeof body?.type === 'string' ? body.type.trim() : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : 'PAUSADO';
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : null;
  const modelId = typeof body?.modelId === 'string' ? body.modelId.trim() : null;
  const isDefault = typeof body?.isDefault === 'boolean' ? body.isDefault : false;
  const isOpenSource =
    typeof body?.isOpenSource === 'boolean' ? body.isOpenSource : true;
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : null;

  if (!name || !provider || !type) {
    return NextResponse.json(
      { error: 'name, provider e type são obrigatórios' },
      { status: 400 },
    );
  }

  if (isDefault) {
    await db.update(aiModels).set({ isDefault: false }).where(eq(aiModels.type, type));
  }

  const created = await db
    .insert(aiModels)
    .values({
      name,
      provider,
      type,
      status,
      endpoint,
      modelId,
      isDefault,
      isOpenSource,
      notes,
    })
    .returning();

  return NextResponse.json(created[0], { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  if (body?.isDefault && body?.type) {
    await db.update(aiModels).set({ isDefault: false }).where(eq(aiModels.type, body.type));
  }

  const updated = await db
    .update(aiModels)
    .set({
      name: typeof body?.name === 'string' ? body.name.trim() : undefined,
      provider: typeof body?.provider === 'string' ? body.provider.trim() : undefined,
      type: typeof body?.type === 'string' ? body.type.trim() : undefined,
      status: typeof body?.status === 'string' ? body.status.trim() : undefined,
      endpoint: typeof body?.endpoint === 'string' ? body.endpoint.trim() : undefined,
      modelId: typeof body?.modelId === 'string' ? body.modelId.trim() : undefined,
      isDefault: typeof body?.isDefault === 'boolean' ? body.isDefault : undefined,
      isOpenSource:
        typeof body?.isOpenSource === 'boolean' ? body.isOpenSource : undefined,
      notes: typeof body?.notes === 'string' ? body.notes.trim() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(aiModels.id, id))
    .returning();

  return NextResponse.json(updated[0]);
}

export async function DELETE(request: Request) {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  await db.delete(aiModels).where(eq(aiModels.id, id));
  return NextResponse.json({ ok: true });
}
