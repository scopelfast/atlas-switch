export type TaskflowCloudAiProviderId = 'openai' | 'gemini';

export type TaskflowCloudAiChatResult = {
  text: string;
  promptTokens: number;
  completionTokens: number;
};

const MAX_PROMPT_CHARS = 12_000;

function assertPrompt(prompt: string): string {
  const t = prompt.trim();
  if (!t) {
    throw new Error('Indique um texto para enviar ao modelo.');
  }
  if (t.length > MAX_PROMPT_CHARS) {
    throw new Error(`O texto excede ${MAX_PROMPT_CHARS} caracteres.`);
  }
  return t;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** OpenAI Chat Completions (API key em `OPENAI_API_KEY`). */
export async function openaiChatCompletion(userPrompt: string): Promise<TaskflowCloudAiChatResult> {
  const text = assertPrompt(userPrompt);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY não está definida no servidor.');
  }
  const model = (process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini').trim();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: text }],
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = (await readJsonSafe(res)) as Record<string, unknown> | null;
  if (!res.ok) {
    const err = body && typeof body.error === 'object' && body.error && 'message' in body.error
      ? String((body.error as { message?: unknown }).message)
      : res.statusText;
    throw new Error(err || 'Falha na API OpenAI.');
  }
  const choices = body?.choices as unknown;
  const first =
    Array.isArray(choices) && choices[0] && typeof choices[0] === 'object'
      ? (choices[0] as { message?: { content?: unknown } })
      : null;
  const out =
    first?.message && typeof first.message.content === 'string' ? first.message.content.trim() : '';
  if (!out) {
    throw new Error('Resposta vazia do modelo OpenAI.');
  }
  const usage = body?.usage as { prompt_tokens?: unknown; completion_tokens?: unknown } | undefined;
  const promptTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
  const completionTokens =
    typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : 0;
  return { text: out, promptTokens, completionTokens };
}

/** Google Gemini (chave em `GEMINI_API_KEY` — AI Studio / Generative Language API). */
export async function geminiGenerateContent(userPrompt: string): Promise<TaskflowCloudAiChatResult> {
  const text = assertPrompt(userPrompt);
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY não está definida no servidor.');
  }
  const model = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = (await readJsonSafe(res)) as Record<string, unknown> | null;
  if (!res.ok) {
    const errObj = body?.error as { message?: unknown } | undefined;
    const err = typeof errObj?.message === 'string' ? errObj.message : res.statusText;
    throw new Error(err || 'Falha na API Gemini.');
  }
  const candidates = body?.candidates as unknown;
  const c0 =
    Array.isArray(candidates) && candidates[0] && typeof candidates[0] === 'object'
      ? (candidates[0] as { content?: { parts?: unknown } })
      : null;
  const parts = c0?.content?.parts;
  const part0 =
    Array.isArray(parts) && parts[0] && typeof parts[0] === 'object'
      ? (parts[0] as { text?: unknown })
      : null;
  const out = typeof part0?.text === 'string' ? part0.text.trim() : '';
  if (!out) {
    throw new Error('Resposta vazia do modelo Gemini.');
  }
  const meta = body?.usageMetadata as
    | { promptTokenCount?: unknown; candidatesTokenCount?: unknown }
    | undefined;
  const promptTokens = typeof meta?.promptTokenCount === 'number' ? meta.promptTokenCount : 0;
  const completionTokens =
    typeof meta?.candidatesTokenCount === 'number' ? meta.candidatesTokenCount : 0;
  return { text: out, promptTokens, completionTokens };
}

export async function runTaskflowCloudAiChat(
  provider: TaskflowCloudAiProviderId,
  userPrompt: string,
): Promise<TaskflowCloudAiChatResult> {
  if (provider === 'openai') {
    return openaiChatCompletion(userPrompt);
  }
  return geminiGenerateContent(userPrompt);
}
