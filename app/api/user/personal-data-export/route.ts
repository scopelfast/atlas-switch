import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getUser } from '@/lib/db/queries';
import { getGoogleCalendarLink } from '@/lib/db/user-google-calendar';
import { getMicrosoftGraphLink } from '@/lib/db/user-microsoft-graph';
import {
  activityLogs,
  invitations,
  reunifyMeetingCaptures,
  reunifyMeetings,
  teamMembers,
  teams,
} from '@/lib/db/schema';

const ACTIVITY_LIMIT = 500;

/**
 * I8.3 — portabilidade mínima: JSON com dados pessoais do utilizador autenticado (sem password_hash).
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const userId = user.id;
  const email = user.email;

  const memberships = await db
    .select({
      teamMemberId: teamMembers.id,
      teamId: teamMembers.teamId,
      teamName: teams.name,
      role: teamMembers.role,
      reportsToUserId: teamMembers.reportsToUserId,
      joinedAt: teamMembers.joinedAt,
      taskflowTtsNotificationsAllowed: teams.taskflowTtsNotificationsAllowed,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId));

  const invitationRows = await db
    .select({
      id: invitations.id,
      teamId: invitations.teamId,
      email: invitations.email,
      invitedName: invitations.invitedName,
      role: invitations.role,
      status: invitations.status,
      invitedAt: invitations.invitedAt,
      activatedAt: invitations.activatedAt,
      tokenExpiresAt: invitations.tokenExpiresAt,
    })
    .from(invitations)
    .where(eq(invitations.email, email));

  const activities = await db
    .select({
      id: activityLogs.id,
      teamId: activityLogs.teamId,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
    })
    .from(activityLogs)
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.timestamp))
    .limit(ACTIVITY_LIMIT);

  const msGraph = await getMicrosoftGraphLink(userId);
  const googleCal = await getGoogleCalendarLink(userId);

  const reunifyCapturaRows = await db
    .select({
      id: reunifyMeetingCaptures.id,
      meetingId: reunifyMeetingCaptures.meetingId,
      reuniaoTitulo: reunifyMeetings.title,
      kind: reunifyMeetingCaptures.kind,
      externalUrl: reunifyMeetingCaptures.externalUrl,
      originalName: reunifyMeetingCaptures.originalName,
      sizeBytes: reunifyMeetingCaptures.sizeBytes,
      createdAt: reunifyMeetingCaptures.createdAt,
    })
    .from(reunifyMeetingCaptures)
    .innerJoin(reunifyMeetings, eq(reunifyMeetingCaptures.meetingId, reunifyMeetings.id))
    .where(eq(reunifyMeetingCaptures.createdById, userId));

  const payload = {
    geradoEm: new Date().toISOString(),
    versaoExport: '1',
    utilizador: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      taskflowTtsNotificationsEnabled: user.taskflowTtsNotificationsEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    membriasEquipa: memberships,
    convitesAssociadosEmail: invitationRows,
    registosActividadeRecentes: activities,
    microsoft365Graph: {
      contaLigada: Boolean(msGraph),
      emailContaMicrosoft: msGraph?.graphEmail ?? null,
      nota:
        'Não são exportados tokens OAuth. A ligação pode ser removida em Chronos (desligar Microsoft 365).',
    },
    googleCalendar: {
      contaLigada: Boolean(googleCal),
      emailContaGoogle: googleCal?.googleEmail ?? null,
      nota:
        'Não são exportados tokens OAuth. A ligação pode ser removida em Chronos (desligar Google Calendar).',
    },
    reunifyCapturasRegistadasPorSi: reunifyCapturaRows.map((r) => ({
      id: r.id,
      meetingId: r.meetingId,
      reuniaoTitulo: r.reuniaoTitulo,
      tipo: r.kind,
      urlExterna: r.externalUrl,
      nomeOriginalOuUrl: r.originalName,
      tamanhoBytes: r.sizeBytes,
      criadoEm: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
    reunifyCapturasNota:
      'Lista só captações Reunify que este utilizador criou. Não inclui caminhos internos de ficheiros nem conteúdo binário.',
    nota:
      'Este export não inclui password_hash nem token_hash de convites. Conteúdo de tarefas e outros módulos pode ser acrescentado em fases posteriores (I8.3).',
  };

  const filename = `atlas-switch-dados-pessoais-${userId}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
