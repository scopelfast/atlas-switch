import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  taskflowBoards,
  taskflowColumns,
  taskflowPortalSubmissions,
  teams,
} from '@/lib/db/schema';

const PORTAL_SLUG_RE = /^[a-f0-9]{32}$/;

export function isValidPublicPortalSlug(slug: string): boolean {
  return PORTAL_SLUG_RE.test(slug);
}

export async function getTeamByPublicPortalSlug(slug: string) {
  if (!isValidPublicPortalSlug(slug)) return null;
  const row = await db.select().from(teams).where(eq(teams.taskflowPublicPortalSlug, slug)).limit(1);
  return row[0] ?? null;
}

export async function getPublicPortalPageMeta(slug: string): Promise<{ teamName: string } | null> {
  const team = await getTeamByPublicPortalSlug(slug);
  if (!team?.taskflowPublicPortalEnabled) return null;
  return { teamName: team.name };
}

export async function assertTaskflowColumnBelongsToTeam(
  teamId: number,
  columnId: number,
): Promise<{ boardId: number }> {
  const r = await db
    .select({ boardId: taskflowColumns.boardId })
    .from(taskflowColumns)
    .innerJoin(taskflowBoards, eq(taskflowColumns.boardId, taskflowBoards.id))
    .where(and(eq(taskflowBoards.teamId, teamId), eq(taskflowColumns.id, columnId)))
    .limit(1);
  if (!r[0]) {
    throw new Error('Coluna inválida para este time');
  }
  return { boardId: r[0].boardId };
}

export async function insertPortalSubmission(input: {
  teamId: number;
  title: string;
  description: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
}) {
  const [row] = await db
    .insert(taskflowPortalSubmissions)
    .values({
      teamId: input.teamId,
      title: input.title,
      description: input.description,
      submitterName: input.submitterName,
      submitterEmail: input.submitterEmail,
      status: 'pending',
    })
    .returning({ id: taskflowPortalSubmissions.id });
  return row;
}

export async function listPendingPortalSubmissions(teamId: number) {
  return db
    .select()
    .from(taskflowPortalSubmissions)
    .where(and(eq(taskflowPortalSubmissions.teamId, teamId), eq(taskflowPortalSubmissions.status, 'pending')))
    .orderBy(desc(taskflowPortalSubmissions.createdAt));
}

export async function getPortalSubmissionForTeam(teamId: number, submissionId: number) {
  const row = await db
    .select()
    .from(taskflowPortalSubmissions)
    .where(
      and(
        eq(taskflowPortalSubmissions.id, submissionId),
        eq(taskflowPortalSubmissions.teamId, teamId),
      ),
    )
    .limit(1);
  return row[0] ?? null;
}

export function buildTaskDescriptionFromPortalSubmission(sub: {
  description: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
}): string | null {
  const blocks: string[] = [];
  const body = sub.description?.trim();
  if (body) blocks.push(body);
  const meta: string[] = ['— Origem: portal público'];
  if (sub.submitterName?.trim()) meta.push(`Remetente: ${sub.submitterName.trim()}`);
  if (sub.submitterEmail?.trim()) meta.push(`E-mail: ${sub.submitterEmail.trim()}`);
  blocks.push(meta.join('\n'));
  return blocks.join('\n\n') || null;
}
