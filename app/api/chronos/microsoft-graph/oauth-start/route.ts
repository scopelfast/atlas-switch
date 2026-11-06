import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { assertMicrosoftGraphEnv } from '@/lib/microsoft-graph/env-check';
import { microsoftOAuthAuthorizeUrl } from '@/lib/microsoft-graph/oauth';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

const key = new TextEncoder().encode(process.env.AUTH_SECRET);

function appBaseUrl(): string {
  return (process.env.BASE_URL || 'http://localhost:3003').replace(/\/$/, '');
}

/** Inicia OAuth Microsoft (consentimento) — utilizador autenticado com `chronos.view`. */
export async function GET() {
  const base = appBaseUrl();
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', base));
  }
  if (!hasPermission(normalizeRole(user.role), 'chronos.view')) {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=sem_permissao', base));
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=time', base));
  }
  if (!(await teamHasModuleEnabled(team.id, 'chronos'))) {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=modulo_off', base));
  }
  if ((await getPlatformSetting('integrations.microsoft_graph')) !== 'true') {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=instancia_off', base));
  }

  try {
    assertMicrosoftGraphEnv();
  } catch {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=env', base));
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=env', base));
  }

  const state = await new SignJWT({ purpose: 'ms_graph_oauth', uid: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);

  const url = microsoftOAuthAuthorizeUrl(state);
  return NextResponse.redirect(url);
}
