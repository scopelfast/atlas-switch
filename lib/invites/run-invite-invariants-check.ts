/**
 * Complemento à checklist manual de convites (memorial M0.7).
 * Não substitui browser + BD; valida invariantes de URL e token reproduzíveis em CI.
 */
import {
  generateInviteOpaqueToken,
  hashInviteOpaqueToken,
  invitationEffectiveDeadline,
} from '@/lib/invites/invite-token';

function fail(msg: string): never {
  throw new Error(`[check:invite-invariants] ${msg}`);
}

function stripTrailingSlashes(u: string) {
  return u.replace(/\/+$/, '');
}

/** Mesma regra que `appPublicBaseUrl()` em `actions.ts` — URLs de convite sem `//`. */
function joinPublicPath(baseRaw: string, path: string) {
  const base = stripTrailingSlashes(baseRaw.trim());
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function assertNoAccidentalDoubleSlash(url: string) {
  const idx = url.indexOf('://');
  const rest = idx >= 0 ? url.slice(idx + 3) : url;
  if (rest.includes('//')) {
    fail(`URL com segmento vazio (//): ${url}`);
  }
}

export function runInviteInvariantsCheck(): void {
  const samples = [
    joinPublicPath('http://localhost:3003/', '/invite?token=abc'),
    joinPublicPath('http://localhost:3003', 'invite?token=abc'),
    joinPublicPath('https://app.exemplo.com///', '/sign-up?inviteId=1'),
  ];
  for (const u of samples) {
    assertNoAccidentalDoubleSlash(u);
  }

  const raw = generateInviteOpaqueToken();
  const h = hashInviteOpaqueToken(raw);
  if (h.length !== 64) {
    fail('hash SHA-256 deve ter 64 hex chars');
  }
  if (hashInviteOpaqueToken(raw) !== h) {
    fail('hash deve ser determinístico');
  }
  if (hashInviteOpaqueToken(`${raw}x`) === h) {
    fail('hash deve mudar com token diferente');
  }

  const far = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const d = invitationEffectiveDeadline({
    status: 'pending',
    tokenExpiresAt: far,
    activatedAt: null,
  });
  if (!d || d.getTime() < Date.now()) {
    fail('prazo efectivo com tokenExpiresAt futuro deve ser futuro');
  }

  // eslint-disable-next-line no-console -- script CLI
  console.log('[check:invite-invariants] OK');
}

runInviteInvariantsCheck();
