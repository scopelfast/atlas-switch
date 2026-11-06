import { NextResponse } from 'next/server';
import { canConfigureTaskflowBoard, normalizeRole } from '@/lib/auth/permissions';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import {
  createTeamDevInboundSecretIfMissing,
  hasTeamDevInboundSecret,
  rotateTeamDevInboundSecret,
} from '@/lib/db/team-taskflow-dev-integration';

/**
 * E8.10 — estado e gestão do segredo inbound (GitHub/GitLab / scripts).
 * O segredo **não** aparece no GET /api/team genérico.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  const configured = await hasTeamDevInboundSecret(team.id);
  return NextResponse.json({
    configured,
    inboundPath: '/api/taskflow/inbound/dev',
    headerName: 'X-Atlas-Taskflow-Dev-Secret',
  });
}

/** Gera segredo na primeira vez (não sobrescreve se já existir). */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  const secret = await createTeamDevInboundSecretIfMissing(team.id);
  if (secret == null) {
    return NextResponse.json(
      { error: 'Segredo já configurado. Use PATCH para gerar um novo.' },
      { status: 409 },
    );
  }
  return NextResponse.json({ secret }, { status: 201 });
}

/** Rotação do segredo (invalida o anterior). */
export async function PATCH() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!canConfigureTaskflowBoard(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  const secret = await rotateTeamDevInboundSecret(team.id);
  return NextResponse.json({ secret });
}
