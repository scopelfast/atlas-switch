import { NextResponse } from 'next/server';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import {
  assertReunifyMeetingInTeam,
  insertReunifyCaptureLink,
  insertReunifyCaptureUpload,
  listReunifyMeetingCaptures,
} from '@/lib/db/reunify-meeting-captures';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import {
  REUNIFY_CAPTURE_MAX_BYTES,
  REUNIFY_CAPTURE_UPLOAD_DIR,
  sanitizeReunifyCaptureOriginalName,
  validateReunifyCaptureExternalUrl,
} from '@/lib/reunify/capture-upload';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ meetingId: string }> };

/** E8.17 — lista captações (ligação ou upload) da reunião. */
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
  if (!meetingId) {
    return NextResponse.json({ error: 'meetingId inválido' }, { status: 400 });
  }
  const meeting = await assertReunifyMeetingInTeam(meetingId, team.id);
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  const rows = await listReunifyMeetingCaptures(team.id, meetingId);
  return NextResponse.json({
    captures: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      externalUrl: r.externalUrl,
      originalName: r.originalName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      createdById: r.createdById,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
  });
}

/**
 * E8.17 — regista ligação (JSON) ou upload multipart (`file`).
 * JSON: `{ "url": "https://..." }`
 */
export async function POST(request: Request, context: RouteContext) {
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
  if (!meetingId) {
    return NextResponse.json({ error: 'meetingId inválido' }, { status: 400 });
  }
  const meeting = await assertReunifyMeetingInTeam(meetingId, team.id);
  if (!meeting) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const urlRaw = typeof (body as { url?: unknown })?.url === 'string' ? (body as { url: string }).url : '';
    try {
      const url = validateReunifyCaptureExternalUrl(urlRaw);
      const id = await insertReunifyCaptureLink({
        teamId: team.id,
        meetingId,
        externalUrl: url,
        createdById: user.id,
      });
      return NextResponse.json({ id, kind: 'LINK' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'URL inválida';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Use application/json com { "url" } ou multipart/form-data com campo file.' },
      { status: 415 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Formulário inválido' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Campo file é obrigatório' }, { status: 400 });
  }
  if (file.size <= 0 || file.size > REUNIFY_CAPTURE_MAX_BYTES) {
    return NextResponse.json(
      { error: `Ficheiro demasiado grande (máx. ${Math.floor(REUNIFY_CAPTURE_MAX_BYTES / (1024 * 1024))} MiB).` },
      { status: 400 },
    );
  }

  let safeName: string;
  let ext: string;
  try {
    const s = sanitizeReunifyCaptureOriginalName(file.name || 'gravacao');
    safeName = s.safeName;
    ext = s.extension;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Nome inválido';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const relative = path.join(String(team.id), String(meetingId), `${randomUUID()}${ext}`);
  const absDir = path.join(REUNIFY_CAPTURE_UPLOAD_DIR, String(team.id), String(meetingId));
  await mkdir(absDir, { recursive: true });
  const absPath = path.join(REUNIFY_CAPTURE_UPLOAD_DIR, relative);
  await writeFile(absPath, buf);

  const storedPath = relative.split(path.sep).join('/');
  try {
    const id = await insertReunifyCaptureUpload({
      teamId: team.id,
      meetingId,
      storedPath,
      originalName: safeName,
      mimeType: file.type?.trim() || null,
      sizeBytes: file.size,
      createdById: user.id,
    });
    return NextResponse.json({ id, kind: 'UPLOAD', originalName: safeName, sizeBytes: file.size });
  } catch (e) {
    try {
      await unlink(absPath);
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : 'Erro ao gravar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
