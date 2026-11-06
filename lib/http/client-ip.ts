/** Primeiro IP de `X-Forwarded-For` ou `X-Real-Ip` (MVP; confiar no proxy). */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const real = request.headers.get('x-real-ip');
  if (real?.trim()) return real.trim().slice(0, 45);
  return 'unknown';
}
