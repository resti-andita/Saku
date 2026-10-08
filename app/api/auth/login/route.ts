import { cookies } from 'next/headers';
import { SESSION_COOKIE, configured, signIn } from '@/lib/auth';
import { sameOrigin } from '@/lib/request-security';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Permintaan ditolak.' }, { status: 403 });
  if (!configured()) return Response.json({ error: 'Pengaturan belum lengkap.' }, { status: 503 });
  try {
    const { email, password } = await req.json();
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 1024) {
      return Response.json({ error: 'Email atau kata sandi tidak sesuai, atau akun belum diberi akses.' }, { status: 401 });
    }
    const session = signIn(email, password);
    if (!session) {
      return Response.json({ error: 'Email atau kata sandi tidak sesuai, atau akun belum diberi akses.' }, { status: 401 });
    }
    const jar = await cookies();
    jar.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: session.expires,
    });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Tidak dapat masuk. Coba lagi.' }, { status: 400 });
  }
}
