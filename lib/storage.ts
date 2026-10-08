import 'server-only';
import { db } from './db';

/**
 * Lapisan data di atas SQLite (pengganti lib/storage.ts versi Supabase).
 *
 * Semua fungsi sinkron karena better-sqlite3 sinkron. Pemanggil yang memakai
 * `await` tetap bekerja tanpa perubahan.
 */

export type LedgerRow = { data: string; version: number };
export type ReceiptRow = { id: string; name: string; type: string; size: number; actor: string; ready: number };

export function readLedger(): LedgerRow | null {
  const row = db().prepare('select data,version from ledgers where id=?').get('main') as LedgerRow | undefined;
  return row ?? null;
}

/**
 * Simpan buku besar dengan concurrency optimistik, sama seperti sebelumnya:
 * - version null  → baris belum ada, sisipkan dengan version 1 (gagal bila sudah ada)
 * - version angka → hanya berhasil bila version di database masih sama persis;
 *                   nilai baru selalu version + 1
 * Mengembalikan false bila ada penulis lain yang lebih dulu — pemanggil
 * menerjemahkannya menjadi 409.
 */
export function saveLedger(data: string, version: number | null): boolean {
  const d = db();
  if (version === null) {
    const info = d.prepare('insert into ledgers (id,data,version) values (?,?,1) on conflict(id) do nothing').run('main', data);
    return info.changes > 0;
  }
  const info = d.prepare('update ledgers set data=?, version=? where id=? and version=?').run(data, version + 1, 'main', version);
  return info.changes > 0;
}

export function receiptById(id: string): ReceiptRow | null {
  const row = db().prepare('select id,name,type,size,actor,ready from receipts where id=? and ready=1').get(id) as ReceiptRow | undefined;
  return row ?? null;
}

export function createReceipt(row: { id: string; name: string; type: string; size: number; actor: string }) {
  db().prepare('insert into receipts (id,name,type,size,actor,ready,created_at) values (?,?,?,?,?,1,?)')
    .run(row.id, row.name, row.type, row.size, row.actor, new Date().toISOString());
}

export function deleteReceipt(id: string) {
  db().prepare('delete from receipts where id=?').run(id);
}
