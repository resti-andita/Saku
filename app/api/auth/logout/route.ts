import { cookies } from 'next/headers';
import { SESSION_COOKIE, destroySession } from '@/lib/auth';
import { sameOrigin } from '@/lib/request-security';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response('Ditolak', { status: 403 });
  const jar = await cookies();
  destroySession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return new Response(null, { status: 303, headers: { Location: '/login', 'Cache-Control': 'no-store' } });
}
