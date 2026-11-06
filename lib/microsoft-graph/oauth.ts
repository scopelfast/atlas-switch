const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_ME = 'https://graph.microsoft.com/v1.0/me';

export const MICROSOFT_GRAPH_OAUTH_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'https://graph.microsoft.com/User.Read',
  'https://graph.microsoft.com/Calendars.Read',
].join(' ');

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`${name} em falta.`);
  }
  return v;
}

export function microsoftOAuthAuthorizeUrl(state: string): string {
  const clientId = requireEnv('MICROSOFT_CLIENT_ID');
  const redirectUri = requireEnv('MICROSOFT_REDIRECT_URI');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: MICROSOFT_GRAPH_OAUTH_SCOPES,
    state,
    prompt: 'consent',
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = requireEnv('MICROSOFT_CLIENT_ID');
  const clientSecret = requireEnv('MICROSOFT_CLIENT_SECRET');
  const redirectUri = requireEnv('MICROSOFT_REDIRECT_URI');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
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
    const err = typeof json.error_description === 'string' ? json.error_description : JSON.stringify(json);
    throw new Error(err || 'Falha ao obter tokens Microsoft.');
  }

  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  const refreshToken = typeof json.refresh_token === 'string' ? json.refresh_token : '';
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600;
  if (!accessToken || !refreshToken) {
    throw new Error('Resposta Microsoft sem access_token ou refresh_token.');
  }
  return { accessToken, refreshToken, expiresIn };
}

export async function refreshMicrosoftAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = requireEnv('MICROSOFT_CLIENT_ID');
  const clientSecret = requireEnv('MICROSOFT_CLIENT_SECRET');

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
    const err = typeof json.error_description === 'string' ? json.error_description : JSON.stringify(json);
    throw new Error(err || 'Falha ao renovar token Microsoft.');
  }

  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  const nextRefresh =
    typeof json.refresh_token === 'string' && json.refresh_token.length > 0
      ? json.refresh_token
      : refreshToken;
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600;
  if (!accessToken) {
    throw new Error('Resposta Microsoft sem access_token.');
  }
  return { accessToken, refreshToken: nextRefresh, expiresIn };
}

export async function fetchMicrosoftGraphMe(accessToken: string): Promise<{ mail: string | null; upn: string | null }> {
  const res = await fetch(GRAPH_ME, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errObj = json.error;
    const msg =
      errObj && typeof errObj === 'object' && 'message' in errObj && typeof (errObj as { message?: unknown }).message === 'string'
        ? (errObj as { message: string }).message
        : 'Falha ao ler perfil Graph.';
    throw new Error(msg);
  }
  const mail = typeof json.mail === 'string' ? json.mail : null;
  const upn = typeof json.userPrincipalName === 'string' ? json.userPrincipalName : null;
  return { mail, upn };
}
