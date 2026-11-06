export type ColumnSlaBreach = {
  taskId: number;
  columnId: number;
  columnName: string;
  hoursInColumn: number;
  maxStayHours: number;
};

type ColumnRow = { id: number; name: string; maxStayHours: number | null };
type TaskRow = {
  id: number;
  columnId: number;
  columnEnteredAt: Date | string | null | undefined;
};

/**
 * M4.2 — tarefas que excederam `max_stay_hours` na coluna actual (com base em `column_entered_at`).
 */
export function computeColumnSlaBreaches(
  tasks: TaskRow[],
  columns: ColumnRow[],
): ColumnSlaBreach[] {
  const colById = new Map(columns.map((c) => [c.id, c]));
  const now = Date.now();
  const out: ColumnSlaBreach[] = [];

  for (const task of tasks) {
    const col = colById.get(task.columnId);
    const max = col?.maxStayHours;
    if (!col || max == null || max <= 0) continue;
    const entered = task.columnEnteredAt ? new Date(task.columnEnteredAt as string).getTime() : NaN;
    if (!Number.isFinite(entered)) continue;
    const hours = (now - entered) / (1000 * 60 * 60);
    if (hours > max) {
      out.push({
        taskId: task.id,
        columnId: col.id,
        columnName: col.name,
        hoursInColumn: Math.round(hours * 10) / 10,
        maxStayHours: max,
      });
    }
  }
  return out;
}
