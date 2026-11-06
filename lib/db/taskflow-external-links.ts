import { and, desc, eq } from 'drizzle-orm';
import { client } from '@/lib/db/drizzle';
import { db } from '@/lib/db/drizzle';
import { taskflowTaskExternalLinks } from '@/lib/db/schema';

/** Resolve `team_id` da tarefa sem `select()` Drizzle em `taskflow_boards` (colunas opcionais). */
export async function getTaskflowTaskTeamId(taskId: number): Promise<number | null> {
  const rows = await client<{ teamId: number }[]>`
    select b.team_id as "teamId"
    from taskflow_tasks t
    inner join taskflow_boards b on b.id = t.board_id
    where t.id = ${taskId}
    limit 1
  `;
  const id = rows[0]?.teamId;
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}

export async function listTaskflowExternalLinks(teamId: number, taskId: number) {
  const taskTeam = await getTaskflowTaskTeamId(taskId);
  if (taskTeam !== teamId) {
    return [];
  }
  return db
    .select()
    .from(taskflowTaskExternalLinks)
    .where(
      and(eq(taskflowTaskExternalLinks.teamId, teamId), eq(taskflowTaskExternalLinks.taskId, taskId)),
    )
    .orderBy(desc(taskflowTaskExternalLinks.createdAt));
}

export async function insertTaskflowExternalLink(input: {
  teamId: number;
  taskId: number;
  provider: string;
  url: string;
  title: string | null;
  externalRef: string | null;
}): Promise<{ id: number } | null> {
  const taskTeam = await getTaskflowTaskTeamId(input.taskId);
  if (taskTeam !== input.teamId) {
    return null;
  }
  const [row] = await db
    .insert(taskflowTaskExternalLinks)
    .values({
      teamId: input.teamId,
      taskId: input.taskId,
      provider: input.provider.slice(0, 32),
      url: input.url,
      title: input.title ? input.title.slice(0, 240) : null,
      externalRef: input.externalRef ? input.externalRef.slice(0, 120) : null,
      createdAt: new Date(),
    })
    .returning({ id: taskflowTaskExternalLinks.id });
  return row ?? null;
}

export async function deleteTaskflowExternalLink(
  teamId: number,
  taskId: number,
  linkId: number,
): Promise<boolean> {
  const res = await db
    .delete(taskflowTaskExternalLinks)
    .where(
      and(
        eq(taskflowTaskExternalLinks.id, linkId),
        eq(taskflowTaskExternalLinks.teamId, teamId),
        eq(taskflowTaskExternalLinks.taskId, taskId),
      ),
    )
    .returning({ id: taskflowTaskExternalLinks.id });
  return res.length > 0;
}
