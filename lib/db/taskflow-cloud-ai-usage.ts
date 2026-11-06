import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { taskflowCloudAiUsage } from '@/lib/db/schema';

export function utcYearMonth(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export async function getTaskflowCloudAiUsageRow(teamId: number, periodYm: string) {
  const [row] = await db
    .select({
      requestCount: taskflowCloudAiUsage.requestCount,
      promptTokens: taskflowCloudAiUsage.promptTokens,
      completionTokens: taskflowCloudAiUsage.completionTokens,
    })
    .from(taskflowCloudAiUsage)
    .where(
      and(eq(taskflowCloudAiUsage.teamId, teamId), eq(taskflowCloudAiUsage.periodYm, periodYm)),
    )
    .limit(1);
  return (
    row ?? {
      requestCount: 0,
      promptTokens: 0,
      completionTokens: 0,
    }
  );
}

export async function addTaskflowCloudAiUsage(
  teamId: number,
  periodYm: string,
  delta: { requests: number; promptTokens: number; completionTokens: number },
): Promise<void> {
  await db
    .insert(taskflowCloudAiUsage)
    .values({
      teamId,
      periodYm,
      requestCount: delta.requests,
      promptTokens: delta.promptTokens,
      completionTokens: delta.completionTokens,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [taskflowCloudAiUsage.teamId, taskflowCloudAiUsage.periodYm],
      set: {
        requestCount: sql`${taskflowCloudAiUsage.requestCount} + ${delta.requests}`,
        promptTokens: sql`${taskflowCloudAiUsage.promptTokens} + ${delta.promptTokens}`,
        completionTokens: sql`${taskflowCloudAiUsage.completionTokens} + ${delta.completionTokens}`,
        updatedAt: new Date(),
      },
    });
}
