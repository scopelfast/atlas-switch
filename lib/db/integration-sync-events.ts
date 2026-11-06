import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { isPostgresUndefinedTableError } from '@/lib/db/pg-errors';
import { integrationSyncEvents } from '@/lib/db/schema';

export type IntegrationSyncStatus = 'SUCCESS' | 'ERROR' | 'SKIPPED' | 'RECONCILED';

type RecordIntegrationSyncEventInput = {
  teamId: number;
  integrationKey: string;
  entityType: string;
  entityId?: number | null;
  operation: string;
  status: IntegrationSyncStatus;
  message?: string | null;
  payload?: unknown;
};

export async function recordIntegrationSyncEvent(input: RecordIntegrationSyncEventInput) {
  try {
    await db.insert(integrationSyncEvents).values({
      teamId: input.teamId,
      integrationKey: input.integrationKey.slice(0, 60),
      entityType: input.entityType.slice(0, 40),
      entityId: input.entityId ?? null,
      operation: input.operation.slice(0, 40),
      status: input.status,
      message: input.message?.slice(0, 2000) ?? null,
      payload: input.payload == null ? null : JSON.stringify(input.payload),
      createdAt: new Date(),
    });
  } catch (e) {
    if (!isPostgresUndefinedTableError(e)) {
      console.error('[integration sync] failed to record event', e);
    }
  }
}

export async function listIntegrationSyncEventsForEntity(
  teamId: number,
  entityType: string,
  entityId: number,
  limit = 100,
) {
  try {
    return await db
      .select()
      .from(integrationSyncEvents)
      .where(
        and(
          eq(integrationSyncEvents.teamId, teamId),
          eq(integrationSyncEvents.entityType, entityType),
          eq(integrationSyncEvents.entityId, entityId),
        ),
      )
      .orderBy(desc(integrationSyncEvents.createdAt))
      .limit(Math.max(1, Math.min(limit, 200)));
  } catch (e) {
    if (isPostgresUndefinedTableError(e)) {
      return [];
    }
    throw e;
  }
}

export async function getIntegrationSyncMetrics(teamId: number, integrationKey: string, lookbackHours = 24) {
  const since = new Date(Date.now() - Math.max(1, Math.min(lookbackHours, 24 * 30)) * 60 * 60 * 1000);
  try {
    const rows = await db
      .select({
        status: integrationSyncEvents.status,
        createdAt: integrationSyncEvents.createdAt,
      })
      .from(integrationSyncEvents)
      .where(
        and(
          eq(integrationSyncEvents.teamId, teamId),
          eq(integrationSyncEvents.integrationKey, integrationKey),
          gte(integrationSyncEvents.createdAt, since),
        ),
      )
      .orderBy(desc(integrationSyncEvents.createdAt))
      .limit(5000);

    const counters = { success: 0, error: 0, skipped: 0, reconciled: 0 };
    for (const row of rows) {
      if (row.status === 'SUCCESS') counters.success += 1;
      else if (row.status === 'ERROR') counters.error += 1;
      else if (row.status === 'SKIPPED') counters.skipped += 1;
      else if (row.status === 'RECONCILED') counters.reconciled += 1;
    }

    return {
      integrationKey,
      lookbackHours,
      since: since.toISOString(),
      total: rows.length,
      ...counters,
      errorRatePct: rows.length > 0 ? Number(((counters.error / rows.length) * 100).toFixed(2)) : 0,
    };
  } catch (e) {
    if (isPostgresUndefinedTableError(e)) {
      return {
        integrationKey,
        lookbackHours,
        since: since.toISOString(),
        total: 0,
        success: 0,
        error: 0,
        skipped: 0,
        reconciled: 0,
        errorRatePct: 0,
      };
    }
    throw e;
  }
}
