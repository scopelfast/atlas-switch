import { unlink } from 'fs/promises';
import path from 'path';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { reunifyMeetingCaptures, reunifyMeetings } from '@/lib/db/schema';
import { REUNIFY_CAPTURE_UPLOAD_DIR } from '@/lib/reunify/capture-upload';

export async function assertReunifyMeetingInTeam(meetingId: number, teamId: number) {
  const [m] = await db
    .select({ id: reunifyMeetings.id })
    .from(reunifyMeetings)
    .where(and(eq(reunifyMeetings.id, meetingId), eq(reunifyMeetings.teamId, teamId)))
    .limit(1);
  return m ?? null;
}

export async function listReunifyMeetingCaptures(teamId: number, meetingId: number) {
  return db
    .select({
      id: reunifyMeetingCaptures.id,
      kind: reunifyMeetingCaptures.kind,
      externalUrl: reunifyMeetingCaptures.externalUrl,
      originalName: reunifyMeetingCaptures.originalName,
      mimeType: reunifyMeetingCaptures.mimeType,
      sizeBytes: reunifyMeetingCaptures.sizeBytes,
      createdById: reunifyMeetingCaptures.createdById,
      createdAt: reunifyMeetingCaptures.createdAt,
    })
    .from(reunifyMeetingCaptures)
    .where(and(eq(reunifyMeetingCaptures.teamId, teamId), eq(reunifyMeetingCaptures.meetingId, meetingId)))
    .orderBy(asc(reunifyMeetingCaptures.createdAt));
}

export async function getReunifyMeetingCapture(teamId: number, captureId: number) {
  const [row] = await db
    .select({
      id: reunifyMeetingCaptures.id,
      meetingId: reunifyMeetingCaptures.meetingId,
      kind: reunifyMeetingCaptures.kind,
      externalUrl: reunifyMeetingCaptures.externalUrl,
      storedPath: reunifyMeetingCaptures.storedPath,
      originalName: reunifyMeetingCaptures.originalName,
      mimeType: reunifyMeetingCaptures.mimeType,
      sizeBytes: reunifyMeetingCaptures.sizeBytes,
      createdById: reunifyMeetingCaptures.createdById,
    })
    .from(reunifyMeetingCaptures)
    .where(and(eq(reunifyMeetingCaptures.teamId, teamId), eq(reunifyMeetingCaptures.id, captureId)))
    .limit(1);
  return row ?? null;
}

export async function insertReunifyCaptureLink(params: {
  teamId: number;
  meetingId: number;
  externalUrl: string;
  createdById: number;
}): Promise<number> {
  const [row] = await db
    .insert(reunifyMeetingCaptures)
    .values({
      teamId: params.teamId,
      meetingId: params.meetingId,
      kind: 'LINK',
      externalUrl: params.externalUrl,
      storedPath: null,
      originalName: params.externalUrl.slice(0, 255),
      mimeType: null,
      sizeBytes: 0,
      createdById: params.createdById,
    })
    .returning({ id: reunifyMeetingCaptures.id });
  if (!row?.id) {
    throw new Error('Falha ao gravar ligação.');
  }
  return row.id;
}

export async function insertReunifyCaptureUpload(params: {
  teamId: number;
  meetingId: number;
  storedPath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdById: number;
}): Promise<number> {
  const [row] = await db
    .insert(reunifyMeetingCaptures)
    .values({
      teamId: params.teamId,
      meetingId: params.meetingId,
      kind: 'UPLOAD',
      externalUrl: null,
      storedPath: params.storedPath,
      originalName: params.originalName,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      createdById: params.createdById,
    })
    .returning({ id: reunifyMeetingCaptures.id });
  if (!row?.id) {
    throw new Error('Falha ao gravar upload.');
  }
  return row.id;
}

/** Remove ficheiros em disco de todos os uploads da reunião (chamar antes de apagar a reunião). */
export async function unlinkUploadFilesForMeeting(teamId: number, meetingId: number): Promise<void> {
  const rows = await db
    .select({ storedPath: reunifyMeetingCaptures.storedPath })
    .from(reunifyMeetingCaptures)
    .where(
      and(
        eq(reunifyMeetingCaptures.teamId, teamId),
        eq(reunifyMeetingCaptures.meetingId, meetingId),
        eq(reunifyMeetingCaptures.kind, 'UPLOAD'),
      ),
    );
  for (const r of rows) {
    if (!r.storedPath?.trim()) continue;
    const disk = path.join(REUNIFY_CAPTURE_UPLOAD_DIR, r.storedPath.split('/').join(path.sep));
    try {
      await unlink(disk);
    } catch {
      /* ficheiro já ausente */
    }
  }
}

export async function deleteReunifyMeetingCaptureRow(teamId: number, captureId: number): Promise<{
  storedPath: string | null;
} | null> {
  const row = await getReunifyMeetingCapture(teamId, captureId);
  if (!row) {
    return null;
  }
  await db
    .delete(reunifyMeetingCaptures)
    .where(and(eq(reunifyMeetingCaptures.teamId, teamId), eq(reunifyMeetingCaptures.id, captureId)));
  return { storedPath: row.kind === 'UPLOAD' ? row.storedPath : null };
}
