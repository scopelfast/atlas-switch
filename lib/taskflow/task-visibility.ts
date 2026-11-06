import { and, eq, exists, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { taskflowTaskAssignees, taskflowTasks } from '@/lib/db/schema';
import { normalizeRole } from '@/lib/auth/permissions';

/**
 * M6.8 — Membro e Supervisor: só tarefas em que participam (criador, responsável legado ou N:N).
 * Owner, Admin e Gestor: quadro completo do time.
 */
export function taskflowListScopeForRole(role: string | null | undefined): 'team' | 'self' {
  const r = normalizeRole(role);
  if (r === 'owner' || r === 'admin' || r === 'gestor') {
    return 'team';
  }
  return 'self';
}

/** Condição SQL: a tarefa envolve o utilizador (criação ou responsabilização). */
export function taskflowTaskInvolvesUserWhere(viewerUserId: number): SQL {
  return or(
    eq(taskflowTasks.createdById, viewerUserId),
    eq(taskflowTasks.assigneeId, viewerUserId),
    exists(
      db
        .select({ one: sql`1` })
        .from(taskflowTaskAssignees)
        .where(
          and(
            eq(taskflowTaskAssignees.taskId, taskflowTasks.id),
            eq(taskflowTaskAssignees.userId, viewerUserId),
          ),
        ),
    ),
  )!;
}

export function taskflowBoardOptionsForUser(
  userId: number,
  role: string | null | undefined,
): { listScope: 'team' | 'self'; viewerUserId: number } {
  const listScope = taskflowListScopeForRole(role);
  return { listScope, viewerUserId: userId };
}
