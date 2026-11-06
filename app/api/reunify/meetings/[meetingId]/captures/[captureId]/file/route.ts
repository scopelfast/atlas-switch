import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getReunifyMeetingCapture } from '@/lib/db/reunify-meeting-captures';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { REUNIFY_CAPTURE_UPLOAD_DIR } from '@/lib/reunify/capture-upload';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ meetingId: string; captureId: string }> };

function asciiFallbackFilename(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, '_').slice(0, 180) || 'download';
}

export async function GET(_request: Request, context: RouteContext) {
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
  if (!row || row.meetingId !== meetingId || row.kind !== 'UPLOAD' || !row.storedPath) {
    return NextResponse.json({ error: 'Ficheiro não encontrado' }, { status: 404 });
  }

  const diskPath = path.join(REUNIFY_CAPTURE_UPLOAD_DIR, row.storedPath.split('/').join(path.sep));
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
