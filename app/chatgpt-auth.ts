import { redirect } from 'next/navigation';
import { configured, currentEmail, userByEmail } from '@/lib/auth';

/**
 * Nama lama dipertahankan agar seluruh pemanggil di aplikasi tidak berubah.
 * Autentikasi sekarang memakai sesi SQLite (lib/auth.ts), bukan Supabase.
 */
export type ChatGPTUser = { userId: string; displayName: string; email: string; fullName: string | null };

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  if (!configured()) return null;
  const email = await currentEmail();
  if (!email) return null;
  const name = userByEmail(email)?.name || email;
  return { userId: email, email, displayName: name, fullName: name };
}

export async function requireChatGPTUser(_returnTo: string) {
  const user = await getChatGPTUser();
  if (!user) redirect('/login');
  return user;
}
