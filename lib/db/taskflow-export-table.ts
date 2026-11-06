import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { getBoardData, type GetBoardDataOptions } from '@/lib/db/taskflow';

function iso(d: Date | null | undefined): string {
  if (!d) return '';
  try {
    return d.toISOString();
  } catch {
    return '';
  }
}

export type TaskflowExportTable = {
  headers: string[];
  rows: string[][];
};

/**
 * Tabela de exportação Taskflow (mesmas colunas que o CSV E7.2) — usada por CSV, XLSX e PDF (E8.4).
 */
export async function getTaskflowTasksExportTable(
  teamId: number,
  opts?: GetBoardDataOptions,
): Promise<TaskflowExportTable> {
  const headers = [
    'id',
    'titulo',
    'descricao',
    'coluna',
    'estado',
    'prioridade',
    'tipo_tarefa',
    'responsaveis',
    'prazo',
    'inicio_previsto',
    'horas_estimadas',
    'recorrente',
    'concluida_em',
    'criado_em',
    'atualizado_em',
  ];

  const data = await getBoardData(teamId, opts);
  if (!data) {
    return { headers, rows: [] };
  }

  const colName = new Map(data.columns.map((c) => [c.id, c.name]));
  const statusName = new Map(data.statusDefinitions.map((s) => [s.id, s.name]));

  const allAssigneeIds = new Set<number>();
  for (const t of data.tasks) {
    for (const id of t.assigneeIds ?? []) {
      allAssigneeIds.add(id);
    }
  }

  const nameByUserId = new Map<number, string>();
  if (allAssigneeIds.size > 0) {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, [...allAssigneeIds]));
    for (const u of rows) {
      nameByUserId.set(u.id, (u.name?.trim() || u.email || `#${u.id}`) as string);
    }
  }

  const rows: string[][] = [];

  for (const t of data.tasks) {
    const assigneeLabels = (t.assigneeIds ?? [])
      .map((id) => nameByUserId.get(id) ?? String(id))
      .join('; ');
    const recurrence =
      t.recurrenceRule && !t.recurrenceOccurrenceKey
        ? String(t.recurrenceRule)
        : t.recurrenceOccurrenceKey
          ? 'instancia'
          : '';

    rows.push([
      String(t.id),
      t.title ?? '',
      t.description ?? '',
      colName.get(t.columnId) ?? '',
      statusName.get(t.statusId) ?? '',
      t.priority ?? '',
      t.taskType ?? '',
      assigneeLabels,
      iso(t.dueDate ? new Date(t.dueDate) : null),
      iso(t.plannedStartAt ? new Date(t.plannedStartAt) : null),
      t.estimatedDurationHours != null && Number.isFinite(t.estimatedDurationHours)
        ? String(t.estimatedDurationHours)
        : '',
      recurrence,
      iso(t.completedAt ? new Date(t.completedAt) : null),
      iso(t.createdAt ? new Date(t.createdAt) : null),
      iso(t.updatedAt ? new Date(t.updatedAt) : null),
    ]);
  }

  return { headers, rows };
}
