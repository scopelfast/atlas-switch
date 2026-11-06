import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { projectusCostCategories, projectusCostItems, projectusProjects } from '@/lib/db/schema';
import { ensureProjectusCostCategories } from '@/lib/projectus/ensure-cost-categories';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

async function ensureProject(teamId: number, projectId: number) {
  const project = await db
    .select()
    .from(projectusProjects)
    .where(and(eq(projectusProjects.id, projectId), eq(projectusProjects.teamId, teamId)))
    .limit(1);
  return project[0];
}

function buildCostCategoryDisplay(
  label: string,
  code: string,
  categoryDetail: string | null | undefined,
): string {
  const d = typeof categoryDetail === 'string' ? categoryDetail.trim() : '';
  if (code === 'OUTROS' && d) {
    const s = `${label}: ${d}`;
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  }
  return label.length > 80 ? `${label.slice(0, 77)}…` : label;
}

async function resolveCategoryForTeam(
  teamId: number,
  categoryId: number,
  categoryDetailRaw: string | null | undefined,
): Promise<{ row: (typeof projectusCostCategories.$inferSelect); display: string; detail: string | null } | null> {
  const catRows = await db
    .select()
    .from(projectusCostCategories)
    .where(and(eq(projectusCostCategories.id, categoryId), eq(projectusCostCategories.teamId, teamId)))
    .limit(1);
  const row = catRows[0];
  if (!row || !row.active) return null;

  const detail =
    row.code === 'OUTROS'
      ? typeof categoryDetailRaw === 'string' && categoryDetailRaw.trim()
        ? categoryDetailRaw.trim().slice(0, 200)
        : null
      : null;

  if (row.code === 'OUTROS' && !detail) {
    return null;
  }

  const display = buildCostCategoryDisplay(row.label, row.code, detail);
  return { row, display, detail };
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get('projectId'));
  if (!projectId) {
    return NextResponse.json({ error: 'projectId é obrigatório' }, { status: 400 });
  }

  const project = await ensureProject(team.id, projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const rows = await db
    .select({
      item: projectusCostItems,
      categoryCode: projectusCostCategories.code,
      categoryLabel: projectusCostCategories.label,
    })
    .from(projectusCostItems)
    .innerJoin(projectusCostCategories, eq(projectusCostCategories.id, projectusCostItems.categoryId))
    .where(eq(projectusCostItems.projectId, projectId))
    .orderBy(projectusCostItems.createdAt);

  return NextResponse.json(
    rows.map(({ item, categoryCode, categoryLabel }) => ({
      ...item,
      categoryCode,
      categoryLabel,
      categoryTitle: buildCostCategoryDisplay(categoryLabel, categoryCode, item.categoryDetail),
    })),
  );
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
  if (!(await teamHasModuleEnabled(team.id, 'projectus'))) {
    return NextResponse.json(
      { error: 'O módulo Projectus não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  await ensureProjectusCostCategories(team.id);

  const body = await request.json();
  const projectId = Number(body?.projectId);
  const phaseId = body?.phaseId ? Number(body.phaseId) : null;
  const taskId = body?.taskId ? Number(body.taskId) : null;
  const type = typeof body?.type === 'string' ? body.type.trim() : 'PLANEJADO';
  const categoryId = Number(body?.categoryId);
  const amountCents = typeof body?.amountCents === 'number' ? body.amountCents : 0;
  const incurredAt = typeof body?.incurredAt === 'string' ? body.incurredAt : null;
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : null;

  if (!projectId || !Number.isFinite(categoryId) || !amountCents) {
    return NextResponse.json(
      { error: 'projectId, categoryId e amountCents são obrigatórios' },
      { status: 400 },
    );
  }

  const project = await ensureProject(team.id, projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const resolved = await resolveCategoryForTeam(team.id, categoryId, body?.categoryDetail);
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'Categoria inválida ou inativa. Para "Outros", preencha o detalhe (texto livre curto).',
      },
      { status: 400 },
    );
  }

  const created = await db
    .insert(projectusCostItems)
    .values({
      projectId,
      phaseId,
      taskId,
      type,
      categoryId,
      categoryDetail: resolved.detail,
      category: resolved.display,
      amountCents,
      incurredAt: incurredAt || null,
      notes,
    })
    .returning();

  const out = created[0];
  return NextResponse.json(
    {
      ...out,
      categoryCode: resolved.row.code,
      categoryLabel: resolved.row.label,
      categoryTitle: buildCostCategoryDisplay(resolved.row.label, resolved.row.code, out.categoryDetail),
    },
    { status: 201 },
  );
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
  if (!(await teamHasModuleEnabled(team.id, 'projectus'))) {
    return NextResponse.json(
      { error: 'O módulo Projectus não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const id = Number(idParam);

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const cost = await db
    .select()
    .from(projectusCostItems)
    .where(eq(projectusCostItems.id, id))
    .limit(1);

  if (!cost[0]) {
    return NextResponse.json({ error: 'Custo não encontrado' }, { status: 404 });
  }

  const project = await ensureProject(team.id, cost[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  await db.delete(projectusCostItems).where(eq(projectusCostItems.id, id));
  return NextResponse.json({ ok: true });
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
  if (!(await teamHasModuleEnabled(team.id, 'projectus'))) {
    return NextResponse.json(
      { error: 'O módulo Projectus não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  await ensureProjectusCostCategories(team.id);

  const body = await request.json();
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(projectusCostItems)
    .where(eq(projectusCostItems.id, id))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: 'Custo não encontrado' }, { status: 404 });
  }

  const project = await ensureProject(team.id, existing[0].projectId);
  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  const nextCategoryId =
    typeof body?.categoryId === 'number' && Number.isFinite(body.categoryId)
      ? body.categoryId
      : existing[0].categoryId;
  const detailInput = Object.prototype.hasOwnProperty.call(body ?? {}, 'categoryDetail')
    ? body?.categoryDetail
    : existing[0].categoryDetail;

  const resolved = await resolveCategoryForTeam(team.id, nextCategoryId, detailInput);
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'Categoria inválida ou inativa. Para "Outros", preencha o detalhe (texto livre curto).',
      },
      { status: 400 },
    );
  }

  const updated = await db
    .update(projectusCostItems)
    .set({
      phaseId: body?.phaseId ? Number(body.phaseId) : existing[0].phaseId,
      taskId: body?.taskId ? Number(body.taskId) : existing[0].taskId,
      type: typeof body?.type === 'string' ? body.type.trim() : existing[0].type,
      categoryId: nextCategoryId,
      categoryDetail: resolved.detail,
      category: resolved.display,
      amountCents:
        typeof body?.amountCents === 'number' ? body.amountCents : existing[0].amountCents,
      incurredAt:
        typeof body?.incurredAt === 'string' ? body.incurredAt : existing[0].incurredAt,
      notes: typeof body?.notes === 'string' ? body.notes.trim() : existing[0].notes,
      updatedAt: new Date(),
    })
    .where(eq(projectusCostItems.id, id))
    .returning();

  const out = updated[0];
  return NextResponse.json({
    ...out,
    categoryCode: resolved.row.code,
    categoryLabel: resolved.row.label,
    categoryTitle: buildCostCategoryDisplay(resolved.row.label, resolved.row.code, out.categoryDetail),
  });
}
