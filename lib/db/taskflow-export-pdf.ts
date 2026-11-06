import PDFDocument from 'pdfkit';
import type { GetBoardDataOptions } from '@/lib/db/taskflow';
import { getTaskflowTasksExportTable } from '@/lib/db/taskflow-export-table';

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (c: Buffer) => {
      chunks.push(c);
    });
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
    doc.end();
  });
}

/** E8.4 — PDF legível (lista por tarefa; mesmos dados que o CSV). */
export async function buildTaskflowTasksPdfBuffer(
  teamId: number,
  teamDisplayName: string,
  opts?: GetBoardDataOptions,
): Promise<Buffer> {
  const { headers, rows } = await getTaskflowTasksExportTable(teamId, opts);

  const doc = new PDFDocument({
    margin: 44,
    size: 'A4',
    info: {
      Title: 'Taskflow — Exportação de tarefas',
      Author: 'Atlas Switch',
    },
  });

  doc.fontSize(15).text('Taskflow — Tarefas exportadas', { underline: true });
  doc.moveDown(0.4);
  doc
    .fontSize(9)
    .fillColor('#555555')
    .text(`Time: ${teamDisplayName}  ·  ${new Date().toLocaleString('pt-PT')}  ·  ${rows.length} tarefa(s)`);
  doc.moveDown(0.8);
  doc.fillColor('#111111');

  const detailKeys = headers.slice(2);

  for (const r of rows) {
    const id = r[0] ?? '';
    const title = r[1] ?? '';
    doc.fontSize(10.5).text(`#${id} — ${title}`, { continued: false });
    doc.fontSize(8.2);
    const parts: string[] = [];
    for (let i = 2; i < r.length; i++) {
      const label = detailKeys[i - 2] ?? `c${i}`;
      const val = (r[i] ?? '').trim();
      if (val) parts.push(`${label}: ${val}`);
    }
    doc.fillColor('#333333').text(parts.join('  ·  '), { width: 505, align: 'left' });
    doc.fillColor('#111111').moveDown(0.45);
  }

  if (rows.length === 0) {
    doc.fontSize(10).text('Nenhuma tarefa visível para exportar.');
  }

  return pdfToBuffer(doc);
}
