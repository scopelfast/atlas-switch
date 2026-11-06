import { NextResponse } from 'next/server';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getTaskflowTaskForTeam } from '@/lib/db/taskflow';
import { taskflowBoardOptionsForUser } from '@/lib/taskflow/task-visibility';
import { taskflowTaskAttachments } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';
import {
  TASKFLOW_ATTACHMENTS_MAX_BYTES,
  TASKFLOW_ATTACHMENT_UPLOAD_DIR,
  sanitizeTaskflowAttachmentOriginalName,
} from '@/lib/taskflow/attachment-upload';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ taskId: string }> };

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

  const taskId = Number((await context.params).taskId);
  if (!taskId) {
    return NextResponse.json({ error: 'taskId inválido' }, { status: 400 });
  }

  const task = await getTaskflowTaskForTeam(taskId, team.id, taskflowBoardOptionsForUser(user.id, user.role));
  if (!task) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }

  const rows = await db
    .select({
      id: taskflowTaskAttachments.id,
      originalName: taskflowTaskAttachments.originalName,
      mimeType: taskflowTaskAttachments.mimeType,
      sizeBytes: taskflowTaskAttachments.sizeBytes,
      createdAt: taskflowTaskAttachments.createdAt,
      uploadedById: taskflowTaskAttachments.uploadedById,
    })
    .from(taskflowTaskAttachments)
    .where(eq(taskflowTaskAttachments.taskId, taskId))
    .orderBy(desc(taskflowTaskAttachments.createdAt));

  return NextResponse.json({ attachments: rows });
}

export async function POST(request: Request, context: RouteContext) {
  try {
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

    const taskId = Number((await context.params).taskId);
    if (!taskId) {
      return NextResponse.json({ error: 'taskId inválido' }, { status: 400 });
    }

    const task = await getTaskflowTaskForTeam(taskId, team.id, taskflowBoardOptionsForUser(user.id, user.role));
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Ficheiro inválido' }, { status: 400 });
    }

    if (file.size > TASKFLOW_ATTACHMENTS_MAX_BYTES) {
      return NextResponse.json({ error: 'Ficheiro acima de 15MB' }, { status: 400 });
    }

    let safeName: string;
    let extension: string;
    try {
      ({ safeName, extension } = sanitizeTaskflowAttachmentOriginalName(
        typeof file.name === 'string' ? file.name : 'ficheiro',
      ));
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Nome inválido' }, { status: 400 });
    }

    const fileNameOnDisk = `${team.id}-${taskId}-${randomUUID()}${extension}`;
    const diskPath = path.join(TASKFLOW_ATTACHMENT_UPLOAD_DIR, fileNameOnDisk);

    await mkdir(TASKFLOW_ATTACHMENT_UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(diskPath, buffer);

    try {
      const inserted = await db
        .insert(taskflowTaskAttachments)
        .values({
          taskId,
          uploadedById: user.id,
          fileNameOnDisk,
          originalName: safeName,
          mimeType: file.type || null,
          sizeBytes: file.size,
          createdAt: new Date(),
        })
        .returning();

      return NextResponse.json(inserted[0], { status: 201 });
    } catch {
      await unlink(diskPath).catch(() => {});
      return NextResponse.json({ error: 'Erro ao gravar anexo na base de dados' }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Erro ao processar upload' },
      { status: 500 },
    );
  }
}
