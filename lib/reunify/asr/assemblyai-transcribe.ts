/**
 * AssemblyAI v2 — áudio pré-gravado (E8.18).
 * Chave: cadastro na BD (Controle) ou `ASSEMBLYAI_API_KEY` no ambiente. O áudio é enviado aos servidores AssemblyAI.
 *
 * Contrato actual (2026): `speech_models` é obrigatório em cada `POST /v2/transcript` — ver
 * https://www.assemblyai.com/docs/pre-recorded-audio/select-the-speech-model
 */

import { resolveAssemblyAiApiKey } from '@/lib/reunify/assemblyai-api-key';

const BASE = 'https://api.assemblyai.com/v2';

/** Modelos recomendados na doc: U3 Pro onde há suporte (incl. pt), fallback U2. */
const DEFAULT_SPEECH_MODELS = ['universal-3-pro', 'universal-2'] as const;

export async function transcribeBufferWithAssemblyAi(buffer: Buffer): Promise<{ text: string }> {
  const key = await resolveAssemblyAiApiKey();
  if (!key) {
    throw new Error(
      'Chave AssemblyAI em falta: cadastre em Integrações globais (Controle) ou defina ASSEMBLYAI_API_KEY.',
    );
  }

  const uploadRes = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: {
      authorization: key,
      'content-type': 'application/octet-stream',
    },
    body: buffer,
    signal: AbortSignal.timeout(180_000),
  });
  const uploadRaw = await uploadRes.text().catch(() => '');
  let uploadJson = {} as { upload_url?: string; error?: string };
  try {
    uploadJson = JSON.parse(uploadRaw) as { upload_url?: string; error?: string };
  } catch {
    /* corpo não-JSON (ex. proxy) */
  }
  if (!uploadRes.ok) {
    const fallback =
      uploadRaw && uploadRaw.length < 400 ? uploadRaw.trim() : uploadRes.statusText || 'HTTP';
    throw new Error(uploadJson.error || `Falha no upload para AssemblyAI (${uploadRes.status}): ${fallback}`);
  }
  const audioUrl = typeof uploadJson.upload_url === 'string' ? uploadJson.upload_url : '';
  if (!audioUrl) {
    throw new Error('Resposta AssemblyAI sem upload_url.');
  }

  const createBody: Record<string, unknown> = {
    audio_url: audioUrl,
    speech_models: [...DEFAULT_SPEECH_MODELS],
    language_detection: true,
  };

  const createRes = await fetch(`${BASE}/transcript`, {
    method: 'POST',
    headers: {
      authorization: key,
      'content-type': 'application/json',
    },
    body: JSON.stringify(createBody),
    signal: AbortSignal.timeout(60_000),
  });
  const createRaw = await createRes.text().catch(() => '');
  let createJson = {} as { id?: string; error?: string };
  try {
    createJson = JSON.parse(createRaw) as { id?: string; error?: string };
  } catch {
    /* ignore */
  }
  if (!createRes.ok) {
    const fallback =
      createRaw && createRaw.length < 500 ? createRaw.trim() : createRes.statusText || 'HTTP';
    throw new Error(
      createJson.error ||
        `Falha ao criar transcrição AssemblyAI (${createRes.status}): ${fallback}`,
    );
  }
  const transcriptId = typeof createJson.id === 'string' ? createJson.id : '';
  if (!transcriptId) {
    throw new Error('Resposta AssemblyAI sem id de transcrição.');
  }

  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    const pollRes = await fetch(`${BASE}/transcript/${transcriptId}`, {
      headers: { authorization: key },
      signal: AbortSignal.timeout(30_000),
    });
    const poll = (await pollRes.json().catch(() => ({}))) as {
      status?: string;
      text?: string;
      error?: string;
    };
    if (!pollRes.ok) {
      throw new Error(poll.error || 'Falha ao consultar transcrição AssemblyAI.');
    }
    const status = typeof poll.status === 'string' ? poll.status : '';
    if (status === 'completed') {
      const text = typeof poll.text === 'string' ? poll.text.trim() : '';
      return { text: text || '(sem texto reconhecido)' };
    }
    if (status === 'error') {
      throw new Error(poll.error || 'AssemblyAI reportou erro na transcrição.');
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error('Tempo esgotado à espera da AssemblyAI (tente ficheiro mais curto).');
}
