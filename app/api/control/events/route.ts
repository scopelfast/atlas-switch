import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { canAccessControlPlane } from '@/lib/auth/permissions';
import { db } from '@/lib/db/drizzle';
import { auditEvents } from '@/lib/db/schema';

const ensureOwner = async () => {
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  }
  if (!canAccessControlPlane(user)) {
    return { error: NextResponse.json({ error: 'Acesso restrito' }, { status: 403 }) };
  }
  return { user };
};

export async function GET() {
  const auth = await ensureOwner();
  if (auth.error) return auth.error;

  const events = await db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.createdAt))
    .limit(50);

  return NextResponse.json(events);
}
