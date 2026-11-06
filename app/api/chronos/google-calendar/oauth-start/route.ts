import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { assertGoogleCalendarEnv } from '@/lib/google-calendar/env-check';
import { googleCalendarOAuthAuthorizeUrl } from '@/lib/google-calendar/oauth';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

const key = new TextEncoder().encode(process.env.AUTH_SECRET);

function appBaseUrl(): string {
  return (process.env.BASE_URL || 'http://localhost:3003').replace(/\/$/, '');
}

/** Inicia OAuth Google Calendar — utilizador autenticado com `chronos.view`. */
export async function GET() {
  const base = appBaseUrl();
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', base));
  }
  if (!hasPermission(normalizeRole(user.role), 'chronos.view')) {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=sem_permissao', base));
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=time', base));
  }
  if (!(await teamHasModuleEnabled(team.id, 'chronos'))) {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=modulo_off', base));
  }
  if ((await getPlatformSetting('integrations.google_calendar')) !== 'true') {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=instancia_off', base));
  }

  try {
    assertGoogleCalendarEnv();
  } catch {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=env', base));
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=env', base));
  }

  const state = await new SignJWT({ purpose: 'google_cal_oauth', uid: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);

  const url = googleCalendarOAuthAuthorizeUrl(state);
  return NextResponse.redirect(url);
}
