/** Variáveis necessárias para OAuth Google Calendar (sem lançar até iniciar OAuth). */
export function assertGoogleCalendarEnv(): void {
  for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] as const) {
    if (!process.env[k]?.trim()) {
      throw new Error(`${k} em falta no servidor.`);
    }
  }
}
