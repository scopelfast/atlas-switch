import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { billtrakBills } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0));

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'billtrak'))) {
    return NextResponse.json(
      { error: 'O módulo BillTrak não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const totals = await db
    .select({
      receitas: sql<number>`sum(case when ${billtrakBills.status} = 'RECEBIDO' then ${billtrakBills.amountCents} else 0 end)`,
      despesas: sql<number>`sum(case when ${billtrakBills.status} = 'PAGO' then ${billtrakBills.amountCents} else 0 end)`,
      pendentes: sql<number>`sum(case when ${billtrakBills.status} = 'PENDENTE' then ${billtrakBills.amountCents} else 0 end)`,
    })
    .from(billtrakBills)
    .where(eq(billtrakBills.teamId, team.id));

  const receitas = toNumber(totals[0]?.receitas);
  const despesas = toNumber(totals[0]?.despesas);
  const pendentes = toNumber(totals[0]?.pendentes);
  const margem = receitas > 0 ? Math.round(((receitas - despesas) / receitas) * 100) : 0;

  return NextResponse.json({
    receitas,
    despesas,
    pendentes,
    margem,
  });
}
