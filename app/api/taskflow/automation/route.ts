import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { taskflowAutomationRules } from '@/lib/db/schema';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

async function ensureRules(teamId: number) {
  const existing = await db
    .select()
    .from(taskflowAutomationRules)
    .where(eq(taskflowAutomationRules.teamId, teamId))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const created = await db
    .insert(taskflowAutomationRules)
    .values({
      teamId,
      autoAssignCreator: false,
      autoHighPriorityOnDue: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return created[0];
}

/**
 * Retorna regras de automação do Taskflow.
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
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const rules = await ensureRules(team.id);
  return NextResponse.json(rules);
}

/**
 * Atualiza regras de automação do Taskflow.
 */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const autoAssignCreator = Boolean(body?.autoAssignCreator);
  const autoHighPriorityOnDue = Boolean(body?.autoHighPriorityOnDue);

  const existing = await ensureRules(team.id);

  const updated = await db
    .update(taskflowAutomationRules)
    .set({
      autoAssignCreator,
      autoHighPriorityOnDue,
      updatedAt: new Date(),
    })
    .where(eq(taskflowAutomationRules.id, existing.id))
    .returning();

  return NextResponse.json(updated[0]);
}
