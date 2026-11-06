import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { isPostgresUndefinedTableError, isPostgresUniqueViolationError } from '@/lib/db/pg-errors';
import { reunifyReasonCatalog } from '@/lib/db/schema';
import {
  DEFAULT_REUNIFY_REASON_CATALOG,
  normalizeReunifyReasonType,
} from '@/lib/reunify/reason-catalog';

const ensureControl = async () => {
  const user = await getUser();
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  if (!canAccessControlPlane(user)) {
    return { error: NextResponse.json({ error: 'Acesso restrito' }, { status: 403 }) };
  }
  return { user };
};

async function seedDefaultsIfEmpty() {
  const count = await db.select({ id: reunifyReasonCatalog.id }).from(reunifyReasonCatalog).limit(1);
  if (count.length > 0) return;
  const seed = [
    ...DEFAULT_REUNIFY_REASON_CATALOG.CANCEL.map((r) => ({ ...r, reasonType: 'CANCEL' as const })),
    ...DEFAULT_REUNIFY_REASON_CATALOG.RESCHEDULE.map((r) => ({ ...r, reasonType: 'RESCHEDULE' as const })),
  ];
  try {
    await db.insert(reunifyReasonCatalog).values(
      seed.map((item) => ({
        reasonType: item.reasonType,
        code: item.code,
        label: item.label,
        active: true,
      })),
    );
  } catch (e) {
    if (!isPostgresUniqueViolationError(e)) {
      throw e;
    }
  }
}

export async function GET() {
  const auth = await ensureControl();
  if (auth.error) return auth.error;
  try {
    await seedDefaultsIfEmpty();
    const rows = await db.select().from(reunifyReasonCatalog).orderBy(asc(reunifyReasonCatalog.reasonType), asc(reunifyReasonCatalog.label));
    return NextResponse.json({ reasons: rows });
  } catch (e) {
    if (isPostgresUndefinedTableError(e)) {
      return NextResponse.json({ reasons: [] });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  const auth = await ensureControl();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reasonType = normalizeReunifyReasonType(body.reasonType);
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase().replace(/\s+/g, '_') : '';
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!reasonType || !code || !label) {
    return NextResponse.json({ error: 'reasonType, code e label são obrigatórios.' }, { status: 400 });
  }
  try {
    await db.insert(reunifyReasonCatalog).values({ reasonType, code, label, active: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isPostgresUndefinedTableError(e)) {
      return NextResponse.json(
        { error: 'Catálogo de motivos não disponível neste ambiente. Aplique a migração 0057.' },
        { status: 400 },
      );
    }
    if (isPostgresUniqueViolationError(e)) {
      return NextResponse.json(
        { error: 'Já existe um motivo com este código para este tipo.' },
        { status: 409 },
      );
    }
    console.error('[POST /api/control/reunify-reasons]', e);
    return NextResponse.json({ error: 'Erro ao cadastrar motivo.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await ensureControl();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.label === 'string') patch.label = body.label.trim();
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (typeof body.code === 'string') patch.code = body.code.trim().toUpperCase().replace(/\s+/g, '_');
  try {
    await db.update(reunifyReasonCatalog).set(patch).where(eq(reunifyReasonCatalog.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isPostgresUndefinedTableError(e)) {
      return NextResponse.json(
        { error: 'Catálogo de motivos não disponível neste ambiente. Aplique a migração 0057.' },
        { status: 400 },
      );
    }
    if (isPostgresUniqueViolationError(e)) {
      return NextResponse.json(
        { error: 'Já existe um motivo com este código para este tipo.' },
        { status: 409 },
      );
    }
    console.error('[PATCH /api/control/reunify-reasons]', e);
    return NextResponse.json({ error: 'Erro ao atualizar motivo.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await ensureControl();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  try {
    await db.delete(reunifyReasonCatalog).where(eq(reunifyReasonCatalog.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isPostgresUndefinedTableError(e)) {
      return NextResponse.json(
        { error: 'Catálogo de motivos não disponível neste ambiente. Aplique a migração 0057.' },
        { status: 400 },
      );
    }
    console.error('[DELETE /api/control/reunify-reasons]', e);
    return NextResponse.json({ error: 'Erro ao excluir motivo.' }, { status: 500 });
  }
}
