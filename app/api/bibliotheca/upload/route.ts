import { NextResponse } from 'next/server';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { getTeamForUser, getUser } from '@/lib/db/queries';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const teamRaw = await getTeamForUser();
  const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
  if (!team || typeof team !== 'object' || typeof team.id !== 'number') {
    return NextResponse.json({ error: 'Time não encontrado' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Arquivo acima de 15MB' }, { status: 400 });
  }

  const originalName = file.name || 'documento';
  const extension = path.extname(originalName) || '';
  const filename = `${team.id}-${user.id}-${randomUUID()}${extension}`;
  const uploadDir = path.join(process.cwd(), 'public', 'bibliotheca');
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  const fileUrl = `/bibliotheca/${filename}`;
  const fileType = file.type || extension.replace('.', '') || 'arquivo';

  return NextResponse.json({
    fileUrl,
    fileType,
    originalName,
    sizeBytes: file.size,
  });
}
