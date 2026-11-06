/** E8.15 — embeddings OpenAI (text-embedding-3-small, 1536 dim). Requer OPENAI_API_KEY e toggle I8.4. */

export const SEMANTIC_EMBEDDING_DIM = 1536 as const;

export async function openaiEmbedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY em falta no servidor.');
  }
  const model = (process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small').trim();
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: texts,
      dimensions: SEMANTIC_EMBEDDING_DIM,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { index: number; embedding: number[] }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    const msg = json.error?.message || 'Falha na API de embeddings OpenAI.';
    throw new Error(msg);
  }
  const data = Array.isArray(json.data) ? json.data : [];
  const sorted = [...data].sort((a, b) => a.index - b.index);
  const out: number[][] = [];
  for (const row of sorted) {
    if (!Array.isArray(row.embedding) || row.embedding.length !== SEMANTIC_EMBEDDING_DIM) {
      throw new Error('Dimensão de embedding inesperada.');
    }
    out.push(row.embedding);
  }
  if (out.length !== texts.length) {
    throw new Error('Número de embeddings diferente do pedido.');
  }
  return out;
}
