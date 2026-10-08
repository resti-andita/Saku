import 'server-only';
import { db } from './db';
import type { ChatGPTUser } from '@/app/chatgpt-auth';

/**
 * Catatan aktivitas anggota. Ini pengganti RPC record_saku_access versi Supabase,
 * dengan semantik upsert yang sama: first_seen sekali saja, last_edit hanya
 * diperbarui bila ada tindakan.
 */
export function recordAccess(user: ChatGPTUser, action?: string) {
  const now = new Date().toISOString();
  db().prepare(
    `insert into team_access (user_id,name,first_seen,last_seen,last_edit,last_action)
     values (?,?,?,?,?,?)
     on conflict(user_id) do update set
       name=excluded.name,
       last_seen=excluded.last_seen,
       last_edit=coalesce(excluded.last_edit, team_access.last_edit),
       last_action=coalesce(excluded.last_action, team_access.last_action)`
  ).run(user.email, user.displayName, now, now, action ? now : null, action || null);
}

export function listMembers() {
  return db().prepare('select * from team_access order by last_seen desc limit 200').all();
}
