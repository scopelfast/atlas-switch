import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { buildTaskflowTasksCsv } from '@/lib/db/taskflow-export-csv';
import { buildTaskflowTasksPdfBuffer } from '@/lib/db/taskflow-export-pdf';
import { buildTaskflowTasksXlsxBuffer } from '@/lib/db/taskflow-export-xlsx';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

const dateSlug = () => new Date().toISOString().slice(0, 10);

/**
 * E7.2 — CSV (default). E8.4 — `?format=xlsx` ou `?format=pdf` (mesmos dados; M6.8).
 */
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

  const format = new URL(request.url).searchParams.get('format')?.toLowerCase() ?? 'csv';

  try {
    const vis = taskflowBoardOptionsForUser(user.id, user.role);
    const teamLabel = (team.name?.trim() || `Time ${team.id}`) as string;
    const base = `taskflow-tarefas-${team.id}-${dateSlug()}`;

    if (format === 'xlsx') {
      const buf = await buildTaskflowTasksXlsxBuffer(team.id, vis);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${base}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'pdf') {
      const buf = await buildTaskflowTasksPdfBuffer(team.id, teamLabel, vis);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${base}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Use format=csv (omisso), format=xlsx ou format=pdf' },
        { status: 400 },
      );
    }

    const csv = await buildTaskflowTasksCsv(team.id, vis);
    const filename = `${base}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao exportar';
    console.error('[GET /api/taskflow/export/tasks]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
