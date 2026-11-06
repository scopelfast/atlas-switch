import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { upsertMicrosoftGraphLink } from '@/lib/db/user-microsoft-graph';
import { exchangeMicrosoftCodeForTokens, fetchMicrosoftGraphMe } from '@/lib/microsoft-graph/oauth';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

const key = new TextEncoder().encode(process.env.AUTH_SECRET);

function appBaseUrl(): string {
  return (process.env.BASE_URL || 'http://localhost:3003').replace(/\/$/, '');
}

/** Callback OAuth Microsoft (regista refresh token cifrado). */
export async function GET(request: Request) {
  const base = appBaseUrl();
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', base));
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=time', base));
  }
  if (!(await teamHasModuleEnabled(team.id, 'chronos'))) {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=modulo_off', base));
  }
  const url = new URL(request.url);
  const err = url.searchParams.get('error');
  const desc = url.searchParams.get('error_description');
  if (err) {
    const q = new URLSearchParams({ outlook: 'erro', msg: desc || err });
    return NextResponse.redirect(new URL(`/dashboard/chronos?${q}`, base));
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=erro&msg=callback_incompleto', base));
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=env', base));
  }

  if ((await getPlatformSetting('integrations.microsoft_graph')) !== 'true') {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=instancia_off', base));
  }

  let userId: number;
  try {
    const { payload } = await jwtVerify(state, key, { algorithms: ['HS256'] });
    if (payload.purpose !== 'ms_graph_oauth') {
      throw new Error('state inválido');
    }
    const uid = payload.uid;
    userId = typeof uid === 'number' ? uid : Number(uid);
    if (!Number.isFinite(userId) || userId < 1) {
      throw new Error('state inválido');
    }
  } catch {
    return NextResponse.redirect(new URL('/dashboard/chronos?outlook=erro&msg=state_invalido', base));
  }

  try {
    const tokens = await exchangeMicrosoftCodeForTokens(code);
    const me = await fetchMicrosoftGraphMe(tokens.accessToken);
    const email = me.mail || me.upn;
    await upsertMicrosoftGraphLink(userId, email, tokens.refreshToken);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'token_falhou';
    return NextResponse.redirect(
      new URL(`/dashboard/chronos?${new URLSearchParams({ outlook: 'erro', msg }).toString()}`, base),
    );
  }

  return NextResponse.redirect(new URL('/dashboard/chronos?outlook=ligado', base));
}
