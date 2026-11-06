import { NextResponse } from 'next/server';
import path from 'path';
import { unlink } from 'fs/promises';
import { and, eq } from 'drizzle-orm';
import { canConfigureTaskflowBoard, hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowTaskForTeam } from '@/lib/db/taskflow';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { taskflowTaskAttachments } from '@/lib/db/schema';
import { TASKFLOW_ATTACHMENT_UPLOAD_DIR } from '@/lib/taskflow/attachment-upload';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ taskId: string; attachmentId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
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

  const { taskId: taskIdRaw, attachmentId: attachmentIdRaw } = await context.params;
  const taskId = Number(taskIdRaw);
  const attachmentId = Number(attachmentIdRaw);
  if (!taskId || !attachmentId) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }

  const task = await getTaskflowTaskForTeam(taskId, team.id, taskflowBoardOptionsForUser(user.id, user.role));
  if (!task) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(taskflowTaskAttachments)
    .where(
      and(
        eq(taskflowTaskAttachments.id, attachmentId),
        eq(taskflowTaskAttachments.taskId, taskId),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
  }

  const role = normalizeRole(user.role);
  const canConfig = canConfigureTaskflowBoard(role);
  const isUploader = rows[0].uploadedById === user.id;
  if (!isUploader && !canConfig) {
    return NextResponse.json(
      { error: 'Só quem enviou ou quem configura o quadro pode remover o anexo.' },
      { status: 403 },
    );
  }

  const diskPath = path.join(TASKFLOW_ATTACHMENT_UPLOAD_DIR, rows[0].fileNameOnDisk);
  await unlink(diskPath).catch(() => {});

  await db
    .delete(taskflowTaskAttachments)
    .where(eq(taskflowTaskAttachments.id, attachmentId));

  return NextResponse.json({ ok: true });
}
