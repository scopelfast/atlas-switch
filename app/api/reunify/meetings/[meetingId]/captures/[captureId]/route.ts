import { NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import { hasPermission, isOwnerLike, normalizeRole } from '@/lib/auth/permissions';
import { deleteReunifyMeetingCaptureRow, getReunifyMeetingCapture } from '@/lib/db/reunify-meeting-captures';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { REUNIFY_CAPTURE_UPLOAD_DIR } from '@/lib/reunify/capture-upload';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ meetingId: string; captureId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!hasPermission(normalizeRole(user.role), 'reunify.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const meetingId = Number((await context.params).meetingId);
  const captureId = Number((await context.params).captureId);
  if (!meetingId || !captureId) {
    return NextResponse.json({ error: 'Identificadores inválidos' }, { status: 400 });
  }

  const row = await getReunifyMeetingCapture(team.id, captureId);
  if (!row || row.meetingId !== meetingId) {
    return NextResponse.json({ error: 'Registo não encontrado' }, { status: 404 });
  }

  const canDelete =
    row.createdById === user.id || isOwnerLike(normalizeRole(user.role));
  if (!canDelete) {
    return NextResponse.json(
      { error: 'Só quem carregou o ficheiro ou um administrador pode remover.' },
      { status: 403 },
    );
  }

  const deleted = await deleteReunifyMeetingCaptureRow(team.id, captureId);
  if (!deleted) {
    return NextResponse.json({ error: 'Registo não encontrado' }, { status: 404 });
  }
  if (deleted.storedPath) {
    const disk = path.join(REUNIFY_CAPTURE_UPLOAD_DIR, deleted.storedPath.split('/').join(path.sep));
    try {
      await unlink(disk);
    } catch {
      /* ficheiro já ausente */
    }
  }

  return NextResponse.json({ ok: true });
}
