/** Re-export: mesma cifra usada para refresh tokens OAuth (Microsoft, Google Calendar). */
export {
  sealOAuthRefreshToken as sealMicrosoftRefreshToken,
  openOAuthRefreshToken as openMicrosoftRefreshToken,
} from '@/lib/crypto/oauth-refresh-token';
