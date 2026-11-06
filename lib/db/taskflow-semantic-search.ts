import { asc, eq } from 'drizzle-orm';
import { client, db } from '@/lib/db/drizzle';
import { taskflowBoards, taskflowTasks, teams } from '@/lib/db/schema';
import { openaiEmbedTexts, SEMANTIC_EMBEDDING_DIM } from '@/lib/taskflow/openai-embeddings';

export function buildTaskEmbeddingSource(title: string, description: string | null): string {
  const t = title.trim().slice(0, 400);
  const d = (description || '').trim().slice(0, 12000);
  return `${t}\n${d}`.trim().slice(0, 16000) || t || ' ';
}

export function assertValidEmbedding(vec: number[]): void {
  if (vec.length !== SEMANTIC_EMBEDDING_DIM) {
    throw new Error(`Embedding inválido: esperado ${SEMANTIC_EMBEDDING_DIM}, recebido ${vec.length}.`);
  }
  for (const x of vec) {
    if (!Number.isFinite(x)) {
      throw new Error('Embedding contém valor não finito.');
    }
  }
}

/** Distância coseno (igual à semântica do operador `<=>` do pgvector em vectores L2-normalizados). */
export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) {
    return 1;
  }
  return 1 - dot / denom;
}

function parseEmbeddingJson(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    throw new Error('Formato de embedding inválido na base de dados.');
  }
  const out: number[] = [];
  for (const x of raw) {
    const n = typeof x === 'number' ? x : Number(x);
    out.push(n);
  }
  assertValidEmbedding(out);
  return out;
}

export async function deleteEmbeddingsForTeam(teamId: number): Promise<void> {
  await client`DELETE FROM taskflow_task_embeddings WHERE team_id = ${teamId}`;
}

export async function upsertTaskEmbedding(
  taskId: number,
  teamId: number,
  embedding: number[],
  sourceText: string,
): Promise<void> {
  assertValidEmbedding(embedding);
  await client`
    INSERT INTO taskflow_task_embeddings (task_id, team_id, embedding, source_text, updated_at)
    VALUES (${taskId}, ${teamId}, ${client.json(embedding)}, ${sourceText}, now())
    ON CONFLICT (task_id) DO UPDATE SET
      team_id = EXCLUDED.team_id,
      embedding = EXCLUDED.embedding,
      source_text = EXCLUDED.source_text,
      updated_at = now()
  `;
}

export async function countIndexedTasks(teamId: number): Promise<number> {
  const [row] = await client<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM taskflow_task_embeddings WHERE team_id = ${teamId}
  `;
  return Number(row?.c ?? 0) || 0;
}

export type SemanticSearchHit = {
  taskId: number;
  title: string;
  distance: number;
};

export async function semanticSearchTasks(params: {
  teamId: number;
  listScopeTeam: boolean;
  viewerUserId: number;
  queryEmbedding: number[];
  limit: number;
}): Promise<SemanticSearchHit[]> {
  assertValidEmbedding(params.queryEmbedding);
  const lim = Math.min(50, Math.max(1, Math.floor(params.limit)));
  const q = params.queryEmbedding;

  if (params.listScopeTeam) {
    const rows = await client<{ task_id: number; title: string; embedding: unknown }[]>`
      SELECT e.task_id, t.title, e.embedding
      FROM taskflow_task_embeddings e
      INNER JOIN taskflow_tasks t ON t.id = e.task_id
      WHERE e.team_id = ${params.teamId}
    `;
    return rankEmbeddingsByQuery(rows, q, lim);
  }

  const rows = await client<{ task_id: number; title: string; embedding: unknown }[]>`
    SELECT e.task_id, t.title, e.embedding
    FROM taskflow_task_embeddings e
    INNER JOIN taskflow_tasks t ON t.id = e.task_id
    WHERE e.team_id = ${params.teamId}
    AND (
      t.created_by_id = ${params.viewerUserId}
      OR t.assignee_id = ${params.viewerUserId}
      OR EXISTS (
        SELECT 1 FROM taskflow_task_assignees a
        WHERE a.task_id = t.id AND a.user_id = ${params.viewerUserId}
      )
    )
  `;
  return rankEmbeddingsByQuery(rows, q, lim);
}

function rankEmbeddingsByQuery(
  rows: { task_id: number; title: string; embedding: unknown }[],
  queryEmbedding: number[],
  limit: number,
): SemanticSearchHit[] {
  const scored: SemanticSearchHit[] = [];
  for (const r of rows) {
    const emb = parseEmbeddingJson(r.embedding);
    scored.push({
      taskId: r.task_id,
      title: r.title,
      distance: cosineDistance(emb, queryEmbedding),
    });
  }
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, limit);
}

const SYNC_BATCH = 80;
const SYNC_MAX_TASKS = 400;

export async function syncTeamTaskEmbeddings(teamId: number): Promise<{ indexed: number; skipped: number }> {
  let indexed = 0;
  let skipped = 0;
  let offset = 0;

  while (offset < SYNC_MAX_TASKS) {
    const tasks = await db
      .select({
        id: taskflowTasks.id,
        title: taskflowTasks.title,
        description: taskflowTasks.description,
      })
      .from(taskflowTasks)
      .innerJoin(taskflowBoards, eq(taskflowTasks.boardId, taskflowBoards.id))
      .where(eq(taskflowBoards.teamId, teamId))
      .orderBy(asc(taskflowTasks.id))
      .limit(SYNC_BATCH)
      .offset(offset);

    if (tasks.length === 0) break;

    const texts: string[] = [];
    const meta: { id: number; text: string }[] = [];
    for (const t of tasks) {
      const src = buildTaskEmbeddingSource(t.title, t.description);
      if (!src.trim()) {
        skipped += 1;
        continue;
      }
      texts.push(src);
      meta.push({ id: t.id, text: src });
    }

    if (texts.length > 0) {
      const vectors = await openaiEmbedTexts(texts);
      for (let i = 0; i < meta.length; i++) {
        await upsertTaskEmbedding(meta[i].id, teamId, vectors[i], meta[i].text);
        indexed += 1;
      }
    }

    offset += SYNC_BATCH;
    if (tasks.length < SYNC_BATCH) break;
  }

  return { indexed, skipped };
}

export async function getTeamSemanticSearchEnabled(teamId: number): Promise<boolean> {
  const [row] = await db
    .select({ v: teams.taskflowSemanticSearchEnabled })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  return Boolean(row?.v);
}
