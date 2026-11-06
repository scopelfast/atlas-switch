import ExcelJS from 'exceljs';
import type { GetBoardDataOptions } from '@/lib/db/taskflow';
import { getTaskflowTasksExportTable } from '@/lib/db/taskflow-export-table';

/** E8.4 — Excel (.xlsx) com as mesmas colunas que o CSV. */
export async function buildTaskflowTasksXlsxBuffer(
  teamId: number,
  opts?: GetBoardDataOptions,
): Promise<Buffer> {
  const { headers, rows } = await getTaskflowTasksExportTable(teamId, opts);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Atlas Switch';
  wb.created = new Date();
  const ws = wb.addWorksheet('Tarefas', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', wrapText: true };

  for (const r of rows) {
    ws.addRow(r);
  }

  headers.forEach((h, idx) => {
    const colIdx = idx + 1;
    const maxData = rows.reduce((m, row) => Math.max(m, (row[idx] ?? '').length), 0);
    const w = Math.min(52, Math.max(10, Math.ceil(Math.max(h.length, maxData) * 0.95) + 2));
    ws.getColumn(colIdx).width = w;
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
