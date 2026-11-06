import { NextResponse } from 'next/server';
import { hasPermission, normalizeRole } from '@/lib/auth/permissions';
import { countIndexedTasks } from '@/lib/db/taskflow-semantic-search';
import { getPlatformSetting } from '@/lib/db/platform-settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!hasPermission(normalizeRole(user.role), 'taskflow.view')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'taskflow'))) {
    return NextResponse.json(
      { error: 'O módulo Taskflow não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const indexed = await countIndexedTasks(team.id);
  const platformOpenai = (await getPlatformSetting('integrations.openai_api')) === 'true';
  const envKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  return NextResponse.json({
    teamEnabled: team.taskflowSemanticSearchEnabled,
    indexedTaskCount: indexed,
    canBuildIndex: platformOpenai && envKey,
  });
}
