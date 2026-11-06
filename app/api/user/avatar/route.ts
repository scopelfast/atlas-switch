import { NextResponse } from 'next/server';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('avatar');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo acima de 2MB' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = file.type?.includes('png')
    ? 'png'
    : file.type?.includes('jpeg') || file.type?.includes('jpg')
      ? 'jpg'
      : 'png';

  const filename = `avatar-${user.id}-${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'avatars');
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, buffer);

  const avatarUrl = `/avatars/${filename}`;
  await db.update(users).set({ avatarUrl }).where(eq(users.id, user.id));

  return NextResponse.json({ avatarUrl });
}
