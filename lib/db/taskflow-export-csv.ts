import type { GetBoardDataOptions } from '@/lib/db/taskflow';
import { getTaskflowTasksExportTable } from '@/lib/db/taskflow-export-table';

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * E7.2 — CSV mínimo das tarefas do quadro (visibilidade M6.8 alinhada a `getBoardData`).
 * Colunas alinhadas a `getTaskflowTasksExportTable` (também usadas em E8.4 XLSX/PDF).
 */
export async function buildTaskflowTasksCsv(
  teamId: number,
  opts?: GetBoardDataOptions,
): Promise<string> {
  const { headers, rows } = await getTaskflowTasksExportTable(teamId, opts);
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(r.map((cell) => csvEscape(cell)).join(','));
  }
  return `\ufeff${lines.join('\n')}\n`;
}
