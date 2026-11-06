import path from 'path';

export const TASKFLOW_ATTACHMENTS_MAX_BYTES = 15 * 1024 * 1024;

export const TASKFLOW_ATTACHMENT_UPLOAD_DIR = path.join(
  process.cwd(),
  'uploads',
  'taskflow-attachments',
);

const BLOCKED_EXT = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.msc',
  '.ps1',
  '.scr',
  '.vbs',
  '.dll',
]);

/**
 * Valida nome original e extensão; devolve nome seguro (basename, truncado).
 */
export function sanitizeTaskflowAttachmentOriginalName(raw: string): {
  safeName: string;
  extension: string;
} {
  const trimmed = (raw || 'ficheiro').trim() || 'ficheiro';
  const base = path.basename(trimmed).replace(/[\x00-\x1f]/g, '_').slice(0, 240);
  const ext = path.extname(base).toLowerCase();
  if (BLOCKED_EXT.has(ext)) {
    throw new Error(`Tipo de ficheiro não permitido (${ext}).`);
  }
  return { safeName: base.slice(0, 255), extension: ext };
}
