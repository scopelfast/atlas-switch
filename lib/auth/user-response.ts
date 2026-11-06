import type { User } from '@/lib/db/schema';

/** Remove campos que nunca devem ir para o browser (I8.3). */
export function userForClientResponse(user: User | null) {
  if (!user) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omitir hash
  const { passwordHash, ...safe } = user;
  return safe;
}
