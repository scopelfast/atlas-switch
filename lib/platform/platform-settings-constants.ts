/** I8.4 — chaves e metadados partilhados entre API e UI (sem dependência de BD). */

export const PLATFORM_BOOLEAN_KEYS = [
  'integrations.google_calendar',
  'integrations.microsoft_graph',
  'integrations.whatsapp',
  'integrations.openai_api',
  'integrations.google_gemini',
  'notifications.digest_daily',
] as const;

export type PlatformBooleanKey = (typeof PLATFORM_BOOLEAN_KEYS)[number];

const KEY_SET = new Set<string>(PLATFORM_BOOLEAN_KEYS);

export function isPlatformBooleanKey(key: string): key is PlatformBooleanKey {
  return KEY_SET.has(key);
}

export const PLATFORM_SETTING_LABELS: Record<
  PlatformBooleanKey,
  { title: string; description: string; envVars: string[] }
> = {
  'integrations.google_calendar': {
    title: 'Google Calendar / Workspace',
    description:
      'Permite que utilizadores com Chronos ligem a conta Google e pré-visualizem o calendário (só leitura). Os segredos OAuth ficam apenas em variáveis de ambiente.',
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
  },
  'integrations.microsoft_graph': {
    title: 'Microsoft Graph (Outlook / Teams)',
    description:
      'Permite que utilizadores com Chronos liguem a conta Microsoft 365 e pré-visualizem o calendário (só leitura).',
    envVars: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_REDIRECT_URI'],
  },
  'integrations.whatsapp': {
    title: 'WhatsApp (mensagens transaccionais)',
    description: 'Reservado para notificações via WhatsApp Business API; não armazenar tokens na BD.',
    envVars: ['WHATSAPP_API_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
  },
  'integrations.openai_api': {
    title: 'OpenAI (API de chat)',
    description:
      'Autoriza equipas com opt-in a usar modelo OpenAI no Taskflow. A chave fica só em variável de ambiente.',
    envVars: ['OPENAI_API_KEY', 'OPENAI_CHAT_MODEL'],
  },
  'integrations.google_gemini': {
    title: 'Google Gemini (API generativa)',
    description:
      'Autoriza equipas com opt-in a usar modelo Gemini (AI Studio / Generative Language). Chave só em `.env`.',
    envVars: ['GEMINI_API_KEY', 'GEMINI_MODEL'],
  },
  'notifications.digest_daily': {
    title: 'Resumo diário por e-mail',
    description: 'Envio agregado de notificações (requer SMTP já configurado).',
    envVars: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
  },
};
