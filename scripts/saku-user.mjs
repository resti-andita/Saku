#!/usr/bin/env node
/**
 * Kelola akun Saku di database SQLite.
 *
 *   node scripts/saku-user.mjs add <email> [nama]
 *   node scripts/saku-user.mjs passwd <email>
 *   node scripts/saku-user.mjs list
 *   node scripts/saku-user.mjs remove <email>
 *   node scripts/saku-user.mjs purge-sessions
 *
 * Kata sandi ditanyakan tersembunyi (tidak muncul di layar, shell, maupun
 * riwayat perintah). Skema hash HARUS sama dengan lib/auth.ts.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const FILE = process.env.SAKU_DB_PATH || path.join(process.cwd(), 'data', 'saku.db');
const SCHEMA_FILE = path.join(process.cwd(), 'lib', 'schema.sql');

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      let data = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (chunk) => { data += chunk; });
      stdin.on('end', () => { process.stdout.write('\n'); resolve(String(data.split('\n')[0])); });
      stdin.on('error', reject);
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const finish = (result) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(result);
    };
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') return finish(value);
      if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }
      if (ch === '\u007f' || ch === '\b') { value = value.slice(0, -1); return; }
      value += ch;
    };
    stdin.on('data', onData);
  });
}

function open() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true, mode: 0o700 });
  const fresh = !fs.existsSync(FILE);
  const db = new Database(FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  // Skema dibuat di sini juga supaya urutan tidak rapuh: skrip admin boleh jalan
  // lebih dulu tanpa perlu aplikasi dijalankan sekali.
  db.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  try { fs.chmodSync(FILE, 0o600); } catch {}
  if (fresh) console.log(`Database baru dibuat: ${FILE}`);
  return db;
}

const [command, email, name] = process.argv.slice(2);
const mail = (email || '').trim().toLowerCase();

if (command === 'list') {
  const db = open();
  const users = db.prepare('select email,name,created_at from users order by created_at').all();
  const sessions = db.prepare('select email,count(*) n from sessions group by email').all();
  if (!users.length) console.log('Belum ada akun.');
  for (const u of users) {
    const s = sessions.find((x) => x.email === u.email);
    console.log(`  ${u.email}  ·  ${u.name}  ·  ${s ? s.n : 0} sesi aktif  ·  dibuat ${u.created_at.slice(0, 10)}`);
  }
} else if (command === 'add') {
  if (!mail) { console.error('Pakai: node scripts/saku-user.mjs add <email> [nama]'); process.exit(1); }
  const db = open();
  if (db.prepare('select 1 from users where email=?').get(mail)) { console.error(`Akun ${mail} sudah ada.`); process.exit(1); }
  const pass = await askHidden(`Kata sandi untuk ${mail}: `);
  if (pass.length < 10) { console.error('Kata sandi minimal 10 karakter.'); process.exit(1); }
  db.prepare('insert into users (email,name,pass_hash,created_at) values (?,?,?,?)')
    .run(mail, (name || mail).trim(), hashPassword(pass), new Date().toISOString());
  console.log(`Akun ${mail} dibuat.`);
  const allow = (process.env.SAKU_ALLOWED_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.includes(mail)) {
    console.log(`Catatan: ${mail} BELUM ada di SAKU_ALLOWED_EMAILS — tambahkan dulu agar bisa masuk.`);
  }
} else if (command === 'passwd') {
  if (!mail) { console.error('Pakai: node scripts/saku-user.mjs passwd <email>'); process.exit(1); }
  const db = open();
  if (!db.prepare('select 1 from users where email=?').get(mail)) { console.error(`Akun ${mail} tidak ada.`); process.exit(1); }
  const pass = await askHidden(`Kata sandi baru untuk ${mail}: `);
  if (pass.length < 10) { console.error('Kata sandi minimal 10 karakter.'); process.exit(1); }
  db.prepare('update users set pass_hash=? where email=?').run(hashPassword(pass), mail);
  db.prepare('delete from sessions where email=?').run(mail);
  console.log(`Kata sandi ${mail} diperbarui; semua sesi lamanya dicabut.`);
} else if (command === 'remove') {
  if (!mail) { console.error('Pakai: node scripts/saku-user.mjs remove <email>'); process.exit(1); }
  const db = open();
  const info = db.prepare('delete from users where email=?').run(mail);
  db.prepare('delete from sessions where email=?').run(mail);
  console.log(info.changes ? `Akun ${mail} dihapus.` : `Akun ${mail} tidak ada.`);
} else if (command === 'purge-sessions') {
  const db = open();
  const info = db.prepare('delete from sessions where expires_at <= ?').run(new Date().toISOString());
  console.log(`${info.changes} sesi kedaluwarsa dihapus.`);
} else {
  console.log(`Pakai:
  node scripts/saku-user.mjs add <email> [nama]
  node scripts/saku-user.mjs passwd <email>
  node scripts/saku-user.mjs list
  node scripts/saku-user.mjs remove <email>
  node scripts/saku-user.mjs purge-sessions`);
}
