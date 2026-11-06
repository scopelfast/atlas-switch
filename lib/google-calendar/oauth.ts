const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const GOOGLE_CALENDAR_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`${name} em falta.`);
  }
  return v;
}

export function googleCalendarOAuthAuthorizeUrl(state: string): string {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const redirectUri = requireEnv('GOOGLE_REDIRECT_URI');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_OAUTH_SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = requireEnv('GOOGLE_REDIRECT_URI');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      typeof json.error_description === 'string'
        ? json.error_description
        : typeof json.error === 'string'
          ? json.error
          : JSON.stringify(json);
    throw new Error(err || 'Falha ao obter tokens Google.');
  }

  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  const refreshToken = typeof json.refresh_token === 'string' ? json.refresh_token : '';
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600;
  if (!accessToken || !refreshToken) {
    throw new Error('Resposta Google sem access_token ou refresh_token (tente ligar de novo com consentimento).');
  }
  return { accessToken, refreshToken, expiresIn };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      typeof json.error_description === 'string'
        ? json.error_description
        : typeof json.error === 'string'
          ? json.error
          : JSON.stringify(json);
    throw new Error(err || 'Falha ao renovar token Google.');
  }

  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  const nextRefresh =
    typeof json.refresh_token === 'string' && json.refresh_token.length > 0
      ? json.refresh_token
      : refreshToken;
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600;
  if (!accessToken) {
    throw new Error('Resposta Google sem access_token.');
  }
  return { accessToken, refreshToken: nextRefresh, expiresIn };
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return null;
  }
  const email = typeof json.email === 'string' ? json.email : null;
  return email;
}
