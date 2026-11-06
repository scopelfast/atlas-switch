import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { projectusCostCategories } from '@/lib/db/schema';
import { ensureProjectusCostCategories } from '@/lib/projectus/ensure-cost-categories';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * Lista categorias de custo do time (catálogo para custos Projectus).
 */
export async function GET() {
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

  await ensureProjectusCostCategories(team.id);

  const rows = await db
    .select({
      id: projectusCostCategories.id,
      code: projectusCostCategories.code,
      label: projectusCostCategories.label,
      active: projectusCostCategories.active,
      position: projectusCostCategories.position,
    })
    .from(projectusCostCategories)
    .where(eq(projectusCostCategories.teamId, team.id))
    .orderBy(asc(projectusCostCategories.position), asc(projectusCostCategories.id));

  return NextResponse.json(rows);
}
