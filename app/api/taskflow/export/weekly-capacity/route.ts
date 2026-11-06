import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import {
  getTaskflowWeeklyCapacityLoad,
  TASKFLOW_WEEKLY_DEFAULT_CAPACITY_HOURS,
} from '@/lib/db/taskflow-weekly-capacity';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** E8.6 — export CSV opcional da visão semanal (M6.8). */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!hasPermission(normalizeRole(user.role), 'taskflow.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
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

  const weekParam = new URL(request.url).searchParams.get('week');
  let anchor = new Date();
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    const parsed = new Date(`${weekParam}T12:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      anchor = parsed;
    }
  }

  try {
    const vis = taskflowBoardOptionsForUser(user.id, user.role);
    const payload = await getTaskflowWeeklyCapacityLoad(team.id, anchor, {
      listScope: vis.listScope,
      viewerUserId: vis.viewerUserId,
    });

    const headers = [
      'user_id',
      'nome',
      'horas_estimadas_abertas_partilha',
      'horas_reais_intervencoes_semana',
      'capacidade_indicativa_semana',
      'semana_inicio_utc',
    ];
    const lines = [headers.join(',')];
    for (const r of payload.rows) {
      lines.push(
        [
          csvEscape(r.userId),
          csvEscape(r.name),
          csvEscape(r.estimatedHoursOpenShare),
          csvEscape(r.realInterventionHoursWeek),
          csvEscape(TASKFLOW_WEEKLY_DEFAULT_CAPACITY_HOURS),
          csvEscape(payload.weekLabel),
        ].join(','),
      );
    }

    const csv = `\ufeff${lines.join('\n')}\n`;
    const fn = `taskflow-carga-semanal-${team.id}-${payload.weekLabel}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fn}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao exportar';
    console.error('[GET /api/taskflow/export/weekly-capacity]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
