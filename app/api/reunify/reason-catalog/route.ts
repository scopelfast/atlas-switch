import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { isPostgresUndefinedTableError } from '@/lib/db/pg-errors';
import { reunifyReasonCatalog } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  DEFAULT_REUNIFY_REASON_CATALOG,
  type ReunifyReasonType,
} from '@/lib/reunify/reason-catalog';

export const runtime = 'nodejs';

type CatalogPayload = Record<ReunifyReasonType, { code: string; label: string }[]>;

function fallbackCatalog(): CatalogPayload {
  return {
    CANCEL: [...DEFAULT_REUNIFY_REASON_CATALOG.CANCEL],
    RESCHEDULE: [...DEFAULT_REUNIFY_REASON_CATALOG.RESCHEDULE],
  };
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  try {
    const rows = await db
      .select({
        reasonType: reunifyReasonCatalog.reasonType,
        code: reunifyReasonCatalog.code,
        label: reunifyReasonCatalog.label,
      })
      .from(reunifyReasonCatalog)
      .where(eq(reunifyReasonCatalog.active, true))
      .orderBy(asc(reunifyReasonCatalog.reasonType), asc(reunifyReasonCatalog.label));

    const payload: CatalogPayload = { CANCEL: [], RESCHEDULE: [] };
    for (const row of rows) {
      const type = row.reasonType === 'CANCEL' || row.reasonType === 'RESCHEDULE' ? row.reasonType : null;
      if (!type) continue;
      payload[type].push({ code: row.code, label: row.label });
    }
    if (payload.CANCEL.length === 0 || payload.RESCHEDULE.length === 0) {
      const fallback = fallbackCatalog();
      if (payload.CANCEL.length === 0) payload.CANCEL = fallback.CANCEL;
      if (payload.RESCHEDULE.length === 0) payload.RESCHEDULE = fallback.RESCHEDULE;
    }
    return NextResponse.json(payload);
  } catch (e) {
    if (isPostgresUndefinedTableError(e)) {
      return NextResponse.json(fallbackCatalog());
    }
    throw e;
  }
}
