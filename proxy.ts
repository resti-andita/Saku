import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware (Next 16: proxy.ts) — TIDAK menyentuh database.
 *
 * Middleware berjalan di runtime Edge, tempat better-sqlite3 tidak tersedia.
 * Karena itu di sini hanya ada pemeriksaan cepat: apakah cookie sesi ada.
 * Itu BUKAN autentikasi — verifikasi sesi yang sebenarnya dilakukan di server
 * (app/chatgpt-auth.ts) pada setiap halaman dan setiap route /api.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');

  const { pathname } = request.nextUrl;
  const isPublic = pathname === '/login' || pathname.startsWith('/api/auth/');
  if (isPublic || request.cookies.has('saku_session')) return response;

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Silakan masuk kembali.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = { matcher: ['/', '/login', '/api/:path*'] };
