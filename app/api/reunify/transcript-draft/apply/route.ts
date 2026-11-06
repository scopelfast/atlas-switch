import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { reunifyActionItems, reunifyMeetings, teams } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

const TITLE_MAX = 200;
const MAX_APPLY = 30;

/**
 * E8.2 — grava na reunião as acções seleccionadas pelo utilizador (revisão humana).
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!hasPermission(normalizeRole(user.role), 'reunify.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'reunify'))) {
    return NextResponse.json(
      { error: 'O módulo Reunify não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const [teamRow] = await db
    .select({ enabled: teams.reunifyTranscriptDraftEnabled })
    .from(teams)
    .where(eq(teams.id, team.id))
    .limit(1);

  if (!teamRow?.enabled) {
    return NextResponse.json({ error: 'Função não activada para este time.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const meetingId = Number((body as { meetingId?: unknown })?.meetingId);
  const titlesRaw = (body as { titles?: unknown })?.titles;
  if (!meetingId || !Array.isArray(titlesRaw)) {
    return NextResponse.json(
      { error: 'meetingId e titles (array de strings) são obrigatórios' },
      { status: 400 },
    );
  }

  const meetingRows = await db
    .select({ id: reunifyMeetings.id })
    .from(reunifyMeetings)
    .where(and(eq(reunifyMeetings.id, meetingId), eq(reunifyMeetings.teamId, team.id)))
    .limit(1);

  if (!meetingRows[0]) {
    return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
  }

  const titles: string[] = [];
  const seen = new Set<string>();
  for (const item of titlesRaw) {
    if (typeof item !== 'string') continue;
    const t = item.trim().slice(0, TITLE_MAX);
    if (t.length < 2) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    titles.push(t);
    if (titles.length >= MAX_APPLY) break;
  }

  if (titles.length === 0) {
    return NextResponse.json({ error: 'Nenhum título válido para gravar' }, { status: 400 });
  }

  const inserted = await db
    .insert(reunifyActionItems)
    .values(
      titles.map((title) => ({
        meetingId,
        title,
        status: 'ABERTO' as const,
      })),
    )
    .returning({ id: reunifyActionItems.id, title: reunifyActionItems.title });

  return NextResponse.json({ created: inserted.length, items: inserted }, { status: 201 });
}
