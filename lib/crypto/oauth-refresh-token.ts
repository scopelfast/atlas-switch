import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function aesKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 8) {
    throw new Error('AUTH_SECRET inválido ou em falta.');
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** Cifra refresh token OAuth para persistência (AES-256-GCM). */
export function sealOAuthRefreshToken(plain: string): string {
  const key = aesKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function openOAuthRefreshToken(sealed: string): string {
  const key = aesKey();
  const buf = Buffer.from(sealed, 'base64url');
  if (buf.length < 12 + 16) {
    throw new Error('Token armazenado inválido.');
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
