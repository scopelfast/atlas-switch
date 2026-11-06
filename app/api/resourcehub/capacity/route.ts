import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { resourcehubAllocations, resourcehubResources } from '@/lib/db/schema';
import { teamHasModuleEnabled } from '@/lib/team/plan-modules';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }
  if (!(await teamHasModuleEnabled(team.id, 'resourcehub'))) {
    return NextResponse.json(
      { error: 'O módulo ResourceHub não está habilitado no plano ativo deste time.' },
      { status: 403 },
    );
  }

  const [resources, allocations] = await Promise.all([
    db
      .select()
      .from(resourcehubResources)
      .where(eq(resourcehubResources.teamId, team.id)),
    db
      .select()
      .from(resourcehubAllocations)
      .innerJoin(resourcehubResources, eq(resourcehubAllocations.resourceId, resourcehubResources.id))
      .where(and(eq(resourcehubResources.teamId, team.id), eq(resourcehubAllocations.status, 'ATIVO'))),
  ]);

  const allocationByResource = new Map<number, number>();
  allocations.forEach((row) => {
    const allocation = row.resourcehub_allocations;
    allocationByResource.set(
      allocation.resourceId,
      (allocationByResource.get(allocation.resourceId) || 0) + allocation.hoursPerWeek,
    );
  });

  const summary = resources.map((resource) => {
    const allocated = allocationByResource.get(resource.id) || 0;
    const capacity = resource.capacityHoursPerWeek || 0;
    const percent = capacity === 0 ? 0 : Math.round((allocated / capacity) * 100);
    return {
      resourceId: resource.id,
      name: resource.name,
      type: resource.type,
      capacityHoursPerWeek: capacity,
      allocatedHoursPerWeek: allocated,
      utilizationPercent: percent,
    };
  });

  return NextResponse.json(summary);
}
