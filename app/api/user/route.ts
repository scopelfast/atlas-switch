import { userForClientResponse } from '@/lib/auth/user-response';
import { getUser } from '@/lib/db/queries';

export async function GET() {
  const user = await getUser();
  return Response.json(userForClientResponse(user));
}
