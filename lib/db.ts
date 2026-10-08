import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Satu koneksi SQLite untuk seluruh proses Next.js.
 *
 * Lokasi file diatur SAKU_DB_PATH (disarankan di luar repo, mis.
 * /var/lib/saku/saku.db). better-sqlite3 bersifat sinkron, jadi semua fungsi
 * pemanggilnya juga sinkron — tidak ada race antar-await.
 */
const FILE = process.env.SAKU_DB_PATH || path.join(process.cwd(), 'data', 'saku.db');
const SCHEMA_FILE = path.join(process.cwd(), 'lib', 'schema.sql');

let handle: Database.Database | null = null;

export function db(): Database.Database {
  if (!handle) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true, mode: 0o700 });
    handle = new Database(FILE);
    handle.pragma('journal_mode = WAL');
    handle.pragma('busy_timeout = 5000');
    // DDL idempoten (create table if not exists), jadi aman dijalankan setiap
    // kali proses start — dan skema baru otomatis ikut terpasang saat deploy.
    handle.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'));
    try {
      fs.chmodSync(FILE, 0o600);
    } catch {
      /* Izin file tidak bisa diubah: bukan alasan menggagalkan permintaan. */
    }
  }
  return handle;
}

export function dbFile() {
  return FILE;
}

/** Direktori penyimpanan struk. Diatur SAKU_FILES_DIR. */
export function filesDir() {
  const dir = process.env.SAKU_FILES_DIR || path.join(process.cwd(), 'data', 'receipts');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
