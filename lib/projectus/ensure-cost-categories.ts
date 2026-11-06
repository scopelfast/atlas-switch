import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { projectusCostCategories } from '@/lib/db/schema';
import { DEFAULT_PROJECTUS_COST_CATEGORIES } from '@/lib/projectus/cost-category-defaults';

/** Garante linhas de catálogo para o time (idempotente). */
export async function ensureProjectusCostCategories(teamId: number): Promise<void> {
  const existing = await db
    .select({ id: projectusCostCategories.id })
    .from(projectusCostCategories)
    .where(eq(projectusCostCategories.teamId, teamId))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(projectusCostCategories).values(
    DEFAULT_PROJECTUS_COST_CATEGORIES.map((c) => ({
      teamId,
      code: c.code,
      label: c.label,
      position: c.position,
      active: true,
    })),
  );
}
