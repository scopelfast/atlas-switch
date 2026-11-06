import { NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { and, eq } from 'drizzle-orm';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { taskflowBoards, taskflowTaskAttachments, taskflowTasks } from '@/lib/db/schema';
import { TASKFLOW_ATTACHMENT_UPLOAD_DIR } from '@/lib/taskflow/attachment-upload';
import { taskflowBoardOptionsForUser, taskflowTaskInvolvesUserWhere } from '@/lib/taskflow/task-visibility';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ attachmentId: string }> };

function asciiFallbackFilename(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, '_').slice(0, 180) || 'download';
}

export async function GET(_request: Request, context: RouteContext) {
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

  const attachmentId = Number((await context.params).attachmentId);
  if (!attachmentId) {
    return NextResponse.json({ error: 'attachmentId inválido' }, { status: 400 });
  }

  const visOpts = taskflowBoardOptionsForUser(user.id, user.role);
  const vis =
    visOpts.listScope === 'self' ? taskflowTaskInvolvesUserWhere(visOpts.viewerUserId) : undefined;

  const rows = await db
    .select({
      id: taskflowTaskAttachments.id,
      fileNameOnDisk: taskflowTaskAttachments.fileNameOnDisk,
      originalName: taskflowTaskAttachments.originalName,
      mimeType: taskflowTaskAttachments.mimeType,
    })
    .from(taskflowTaskAttachments)
    .innerJoin(taskflowTasks, eq(taskflowTaskAttachments.taskId, taskflowTasks.id))
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(
        eq(taskflowTaskAttachments.id, attachmentId),
        eq(taskflowBoards.teamId, team.id),
        ...(vis ? [vis] : []),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
  }

  const diskPath = path.join(TASKFLOW_ATTACHMENT_UPLOAD_DIR, row.fileNameOnDisk);
  let buffer: Buffer;
  try {
    buffer = await readFile(diskPath);
  } catch {
    return NextResponse.json({ error: 'Ficheiro em falta no servidor' }, { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', row.mimeType || 'application/octet-stream');
  const asciiName = asciiFallbackFilename(row.originalName);
  headers.set(
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
  );

  return new NextResponse(buffer, { status: 200, headers });
}
