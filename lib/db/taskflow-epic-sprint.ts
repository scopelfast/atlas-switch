import { and, eq } from 'drizzle-orm';
import { db } from './drizzle';
import { taskflowBoards, taskflowSprints, taskflowTasks } from './schema';

/**
 * E8.9 — valida `parent_task_id`: mesmo quadro do time, sem ciclo, não é a própria tarefa.
 */
export async function assertValidTaskflowParentTask(
  teamId: number,
  boardId: number,
  taskId: number | null,
  parentTaskId: number | null,
): Promise<void> {
  if (parentTaskId == null) {
    return;
  }
  if (taskId != null && parentTaskId === taskId) {
    throw new Error('Uma tarefa não pode ser pai de si própria');
  }

  const [parentRow] = await db
    .select({
      id: taskflowTasks.id,
      boardId: taskflowTasks.boardId,
      parentTaskId: taskflowTasks.parentTaskId,
    })
    .from(taskflowTasks)
    .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
    .where(
      and(
        eq(taskflowTasks.id, parentTaskId),
        eq(taskflowBoards.teamId, teamId),
        eq(taskflowTasks.boardId, boardId),
      ),
    )
    .limit(1);

  if (!parentRow) {
    throw new Error('Tarefa pai inválida (deve existir no mesmo quadro do time)');
  }

  if (taskId == null) {
    return;
  }

  let cur: number | null = parentTaskId;
  const visited = new Set<number>();
  while (cur != null) {
    if (cur === taskId) {
      throw new Error('Referência circular na hierarquia de tarefas');
    }
    if (visited.has(cur)) {
      break;
    }
    visited.add(cur);
    const [next] = await db
      .select({ parentTaskId: taskflowTasks.parentTaskId })
      .from(taskflowTasks)
      .where(eq(taskflowTasks.id, cur))
      .limit(1);
    cur = next?.parentTaskId ?? null;
  }
}

/** E8.9 — sprint pertence ao time. */
export async function assertValidTaskflowSprint(
  teamId: number,
  sprintId: number | null,
): Promise<void> {
  if (sprintId == null) {
    return;
  }
  const [sp] = await db
    .select({ id: taskflowSprints.id })
    .from(taskflowSprints)
    .where(and(eq(taskflowSprints.id, sprintId), eq(taskflowSprints.teamId, teamId)))
    .limit(1);
  if (!sp) {
    throw new Error('Sprint inválido para este time');
  }
}
