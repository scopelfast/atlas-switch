import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { upsertGoogleCalendarLink } from '@/lib/db/user-google-calendar';
import {
  exchangeGoogleCodeForTokens,
  fetchGoogleUserEmail,
} from '@/lib/google-calendar/oauth';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

const key = new TextEncoder().encode(process.env.AUTH_SECRET);

function appBaseUrl(): string {
  return (process.env.BASE_URL || 'http://localhost:3003').replace(/\/$/, '');
}

/** Callback OAuth Google Calendar (regista refresh token cifrado). */
export async function GET(request: Request) {
  const base = appBaseUrl();
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', base));
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=time', base));
  }
  if (!(await teamHasModuleEnabled(team.id, 'chronos'))) {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=modulo_off', base));
  }
  const url = new URL(request.url);
  const err = url.searchParams.get('error');
  const desc = url.searchParams.get('error_description');
  if (err) {
    const q = new URLSearchParams({ gcal: 'erro', msg: desc || err });
    return NextResponse.redirect(new URL(`/dashboard/chronos?${q}`, base));
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=erro&msg=callback_incompleto', base));
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=env', base));
  }

  if ((await getPlatformSetting('integrations.google_calendar')) !== 'true') {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=instancia_off', base));
  }

  let userId: number;
  try {
    const { payload } = await jwtVerify(state, key, { algorithms: ['HS256'] });
    if (payload.purpose !== 'google_cal_oauth') {
      throw new Error('state inválido');
    }
    const uid = payload.uid;
    userId = typeof uid === 'number' ? uid : Number(uid);
    if (!Number.isFinite(userId) || userId < 1) {
      throw new Error('state inválido');
    }
  } catch {
    return NextResponse.redirect(new URL('/dashboard/chronos?gcal=erro&msg=state_invalido', base));
  }

  try {
    const tokens = await exchangeGoogleCodeForTokens(code);
    const email = await fetchGoogleUserEmail(tokens.accessToken);
    await upsertGoogleCalendarLink(userId, email, tokens.refreshToken);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'token_falhou';
    return NextResponse.redirect(
      new URL(`/dashboard/chronos?${new URLSearchParams({ gcal: 'erro', msg }).toString()}`, base),
    );
  }

  return NextResponse.redirect(new URL('/dashboard/chronos?gcal=ligado', base));
}
