import { client } from '@/lib/db/drizzle';

/**
 * ID do quadro Taskflow mais recente do time.
 * Usa SQL literal no driver `postgres` para não depender de colunas opcionais
 * presentes só no schema Drizzle (ex.: `cloned_from_board_id` antes da migração 0047).
 */
export async function getLatestTaskflowBoardIdForTeam(teamId: number): Promise<number | null> {
  const rows = await client<{ id: number }[]>`
    select id
    from taskflow_boards
    where team_id = ${teamId}
    order by created_at desc
    limit 1
  `;
  const id = rows[0]?.id;
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}
