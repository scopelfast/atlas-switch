import path from 'path';

export const REUNIFY_CAPTURE_MAX_BYTES = 80 * 1024 * 1024;

export const REUNIFY_CAPTURE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'reunify-captures');

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

/** Extensões típicas de áudio/vídeo para captação de reunião (MVP). */
const ALLOWED_MEDIA_EXT = new Set([
  '.mp3',
  '.m4a',
  '.aac',
  '.wav',
  '.flac',
  '.ogg',
  '.opus',
  '.webm',
  '.mp4',
  '.mov',
  '.mkv',
  '.mpeg',
  '.mpg',
]);

export function sanitizeReunifyCaptureOriginalName(raw: string): { safeName: string; extension: string } {
  const trimmed = (raw || 'gravacao').trim() || 'gravacao';
  const base = path.basename(trimmed).replace(/[\x00-\x1f]/g, '_').slice(0, 240);
  const ext = path.extname(base).toLowerCase();
  if (BLOCKED_EXT.has(ext)) {
    throw new Error(`Tipo de ficheiro não permitido (${ext}).`);
  }
  if (!ALLOWED_MEDIA_EXT.has(ext)) {
    throw new Error(
      'Extensão não suportada para upload. Use áudio ou vídeo comuns (.mp3, .m4a, .wav, .webm, .mp4, .mov, …).',
    );
  }
  return { safeName: base.slice(0, 255), extension: ext };
}

export function validateReunifyCaptureExternalUrl(raw: string): string {
  const u = raw.trim();
  if (u.length < 12 || u.length > 2000) {
    throw new Error('URL inválida (comprimento).');
  }
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error('URL inválida.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Apenas URLs http ou https.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL com credenciais incorporadas não é permitida.');
  }
  return parsed.toString().slice(0, 2000);
}
