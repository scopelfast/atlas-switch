import {
  ASSEMBLYAI_PLATFORM_SECRET_KEY,
  getPlatformSecret,
} from '@/lib/db/platform-secrets';

/** Remove BOM, aspas e prefixo `Bearer ` comuns em copy-paste da documentação. */
export function sanitizeAssemblyAiApiKeyInput(raw: string): string {
  let v = raw.trim();
  if (v.charCodeAt(0) === 0xfeff) {
    v = v.slice(1).trim();
  }
  if (/^bearer\s+/i.test(v)) {
    v = v.replace(/^bearer\s+/i, '').trim();
  }
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/**
 * Chave AssemblyAI: primeiro valor cadastrado na BD (Controle → Integrações globais),
 * senão variável de ambiente (legado / CI). Efeito imediato na BD — não exige reinício do Node.
 */
export async function resolveAssemblyAiApiKey(): Promise<string | null> {
  const fromDb = await getPlatformSecret(ASSEMBLYAI_PLATFORM_SECRET_KEY);
  if (fromDb) {
    const n = sanitizeAssemblyAiApiKeyInput(fromDb);
    return n || null;
  }
  const env = process.env.ASSEMBLYAI_API_KEY;
  if (!env) return null;
  const n = sanitizeAssemblyAiApiKeyInput(env);
  return n || null;
}

export async function assemblyAiKeyStoredInDatabase(): Promise<boolean> {
  return Boolean(await getPlatformSecret(ASSEMBLYAI_PLATFORM_SECRET_KEY));
}
