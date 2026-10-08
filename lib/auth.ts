import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';

/**
 * Autentikasi pengganti Supabase Auth: email + kata sandi, sesi di SQLite.
 *
 * - Kata sandi di-hash dengan scrypt (modul crypto bawaan Node — tanpa
 *   dependensi native tambahan), garam acak per pengguna.
 * - Token sesi acak 32 byte; yang disimpan di database hanya SHA-256-nya,
 *   jadi bocornya file database tidak langsung memberi sesi yang bisa dipakai.
 * - Daftar email yang boleh masuk tetap dari SAKU_ALLOWED_EMAILS, sama seperti
 *   sebelumnya, sehingga perilaku allowlist tidak berubah.
 */
export const SESSION_COOKIE = 'saku_session';
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function configured() {
  return !!(process.env.SAKU_ALLOWED_EMAILS || '').trim();
}

export function allowed(email: string) {
  return (process.env.SAKU_ALLOWED_EMAILS || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(String(email || '').trim().toLowerCase());
}

function sha(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string) {
  try {
    const [scheme, n, r, p, salt, key] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(key, 'base64');
    const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export type StoredUser = { email: string; name: string };

export function userByEmail(email: string): StoredUser | null {
  const row = db().prepare('select email,name from users where email=?').get(String(email || '').trim().toLowerCase()) as StoredUser | undefined;
  return row ?? null;
}

export function createSession(email: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  db().prepare('insert into sessions (token_hash,email,created_at,expires_at) values (?,?,?,?)')
    .run(sha(token), email.trim().toLowerCase(), now.toISOString(), expires.toISOString());
  return { token, expires };
}

export function sessionEmail(token: string | undefined | null) {
  if (!token) return null;
  const hash = sha(token);
  const row = db().prepare('select email,expires_at from sessions where token_hash=?').get(hash) as { email: string; expires_at: string } | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    db().prepare('delete from sessions where token_hash=?').run(hash);
    return null;
  }
  return row.email;
}

export function destroySession(token: string | undefined | null) {
  if (token) db().prepare('delete from sessions where token_hash=?').run(sha(token));
}

/**
 * Verifikasi kredensial. Mengembalikan null bila email tidak di allowlist, tidak
 * terdaftar, atau kata sandi salah — tanpa membedakan ketiganya kepada pemanggil.
 */
export function signIn(email: string, password: string) {
  const mail = String(email || '').trim().toLowerCase();
  if (!allowed(mail)) return null;
  const row = db().prepare('select email,name,pass_hash from users where email=?').get(mail) as { email: string; name: string; pass_hash: string } | undefined;
  if (!row) {
    // Samakan biaya komputasi agar ketiadaan akun tidak terlihat dari waktu balasan.
    hashPassword(String(password || ''));
    return null;
  }
  if (!verifyPassword(String(password || ''), row.pass_hash)) return null;
  return { email: row.email, name: row.name, ...createSession(row.email) };
}

export async function cookieToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Email pengguna yang sedang masuk, sudah diverifikasi terhadap allowlist. */
export async function currentEmail() {
  const email = sessionEmail(await cookieToken());
  return email && allowed(email) ? email : null;
}

/**
 * Atribut cookie sesi.
 *
 * `Secure` WAJIB aktif begitu aplikasi diakses lewat HTTPS. Tetapi browser
 * menolak menyimpan cookie bertanda `Secure` bila halaman disajikan lewat HTTP
 * polos, sehingga sesi tidak pernah tersimpan dan login tampak gagal.
 * SAKU_INSECURE_COOKIES=1 mematikan atribut itu — pakai HANYA selama aplikasi
 * masih diakses lewat IP tanpa TLS, dan hapus begitu domain + HTTPS siap.
 */
export function sessionCookieOptions(expires: Date) {
  const insecure = process.env.SAKU_INSECURE_COOKIES === '1';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: !insecure && process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  };
}
