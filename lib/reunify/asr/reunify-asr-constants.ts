export const REUNIFY_ASR_PROVIDERS = ['none', 'assemblyai', 'vosk'] as const;
export type ReunifyAsrProvider = (typeof REUNIFY_ASR_PROVIDERS)[number];

export function isReunifyAsrProvider(v: string): v is ReunifyAsrProvider {
  return (REUNIFY_ASR_PROVIDERS as readonly string[]).includes(v);
}
