/** Verifica variáveis necessárias para OAuth / Graph (sem lançar até chamar OAuth). */
export function assertMicrosoftGraphEnv(): void {
  for (const k of ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_REDIRECT_URI'] as const) {
    if (!process.env[k]?.trim()) {
      throw new Error(`${k} em falta no servidor.`);
    }
  }
}
