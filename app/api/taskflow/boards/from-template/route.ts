import { NextResponse } from 'next/server';
import { canConfigureTaskflowBoard, hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getClientIp } from '@/lib/http/client-ip';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { createBoardFromTemplate } from '@/lib/db/taskflow';
import { activityLogs, ActivityType } from '@/lib/db/schema';
import { db } from '@/lib/db/drizzle';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

/**
 * E8.8 — cria quadro vazio com a mesma estrutura de colunas (e opcionalmente etiquetas) de outro quadro do time.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const role = normalizeRole(user.role);
  if (!hasPermission(role, 'taskflow.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  if (!canConfigureTaskflowBoard(role)) {
    return NextResponse.json({ error: 'Sem permissão para configurar o Taskflow.' }, { status: 403 });
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const sourceBoardId = Number(body.sourceBoardId);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description =
    typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;
  const copyLabels = body.copyLabels !== false;
  const clientRequestId =
    typeof body.clientRequestId === 'string' && body.clientRequestId.trim()
      ? body.clientRequestId.trim().slice(0, 80)
      : null;

  if (!Number.isFinite(sourceBoardId) || sourceBoardId < 1 || !name) {
    return NextResponse.json(
      { error: 'sourceBoardId e name são obrigatórios (name não pode ser vazio).' },
      { status: 400 },
    );
  }

  try {
    const { board, idempotent } = await createBoardFromTemplate(team.id, {
      sourceBoardId,
      name,
      description,
      copyLabels,
      clientRequestId,
    });

    if (!idempotent) {
      await db.insert(activityLogs).values({
        teamId: team.id,
        userId: user.id,
        action: ActivityType.TASKFLOW_BOARD_FROM_TEMPLATE,
        timestamp: new Date(),
        ipAddress: getClientIp(request),
      });
    }

    return NextResponse.json({ board, idempotent }, { status: idempotent ? 200 : 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao criar quadro a partir do modelo';
    const status =
      message.includes('não encontrado') || message.includes('inválido') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
