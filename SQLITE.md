# Saku dengan SQLite — catatan perubahan

Cabang ini memindahkan Saku dari Supabase + Vercel ke **SQLite + berkas lokal**,
supaya bisa dijalankan sebagai satu proses di VPS sendiri tanpa layanan luar.

> Dokumen `README.md` dan `MULAI-DI-SINI.md` masih menjelaskan alur Supabase +
> Vercel. Yang berlaku untuk cabang ini adalah berkas yang sedang kamu baca.

## Yang berubah

| Sebelumnya | Sekarang |
|---|---|
| Query lewat `@supabase/supabase-js` | SQL langsung ke SQLite (`better-sqlite3`) |
| Auth Supabase (email + kata sandi) | Sesi sendiri: scrypt + cookie bertanda acak, tabel `sessions` |
| Struk diunggah browser ke Supabase Storage | Struk dikirim ke `POST /api/receipts`, disimpan di disk |
| Tautan bertanda tangan untuk membuka struk | `GET /api/receipts?id=…` menyajikan berkas setelah cek login |
| `supabase/setup.sql` | `lib/schema.sql` (dijalankan otomatis saat start) |
| 4 variabel lingkungan Supabase | 3 variabel: `SAKU_ALLOWED_EMAILS`, `SAKU_DB_PATH`, `SAKU_FILES_DIR` |

Model keamanan tetap sama: **tidak ada data yang bisa dibaca dari browser tanpa
login.** Semua akses data lewat route server yang memverifikasi sesi.

## Menjalankan

```bash
export SAKU_ALLOWED_EMAILS="nama@contoh.com"
export SAKU_DB_PATH=/var/lib/saku/saku.db
export SAKU_FILES_DIR=/var/lib/saku/receipts

npm ci
npm run build
node scripts/saku-user.mjs add nama@contoh.com "Nama"   # kata sandi ditanya tersembunyi
npm start
```

`npm start` menjalankan `next start`. Port diatur dengan `-p`, mis.
`npm start -- -p 3000`.

Tidak ada variabel yang perlu ada saat build — mengubah daftar email atau lokasi
database **tidak** memerlukan build ulang (beda dengan `NEXT_PUBLIC_*` Supabase).

## Variabel lingkungan

| Variabel | Isi |
|---|---|
| `SAKU_ALLOWED_EMAILS` | daftar email yang boleh masuk, dipisah koma |
| `SAKU_DB_PATH` | lokasi berkas database SQLite |
| `SAKU_FILES_DIR` | direktori penyimpanan struk |
| `SAKU_INSECURE_COOKIES` | `1` = matikan atribut `Secure` pada cookie sesi |

`SAKU_INSECURE_COOKIES=1` hanya untuk saat aplikasi masih diakses lewat **HTTP
polos** (mis. IP tanpa domain). Tanpa itu, browser menolak menyimpan cookie sesi
di HTTP sehingga login tidak pernah bertahan dan aplikasi tampak rusak. Hapus
flag ini begitu HTTPS aktif — selama menyala, kata sandi dan cookie lewat
jaringan tanpa enkripsi.

## Mengelola akun

```bash
node scripts/saku-user.mjs add <email> [nama]   # buat akun (min. 10 karakter)
node scripts/saku-user.mjs passwd <email>       # ganti kata sandi + cabut sesi lama
node scripts/saku-user.mjs list                 # daftar akun + jumlah sesi aktif
node scripts/saku-user.mjs remove <email>
node scripts/saku-user.mjs purge-sessions       # bersihkan sesi kedaluwarsa
```

Email harus ada di `SAKU_ALLOWED_EMAILS` **dan** terdaftar di tabel `users`.
Dua lapis ini disengaja.

## Cadangan

Seluruh data ada di satu berkas. Salin dengan aman (tanpa menyentuh berkas yang
sedang dipakai) — SQLite punya perintah khusus untuk itu:

```bash
sqlite3 /var/lib/saku/saku.db ".backup '/backup/saku-$(date +%F).db'"
```

Struk ada di `SAKU_FILES_DIR`; keduanya perlu dicadangkan bersamaan.

## Uji

```bash
npm test                      # 13 pemeriksaan bawaan (CSRF, tanda tangan struk, saldo)
npm run typecheck             # tsc --noEmit
PORT=4300 bash tests/e2e.sh   # 30 pemeriksaan end-to-end terhadap server yang hidup
```

`tests/e2e.sh` memerlukan server yang sedang berjalan dan satu akun uji.

## Perbaikan bug yang ditemukan saat pengerjaan

1. **`lib/request-security.ts` — semua POST akan ditolak 403 di server sendiri.**
   `sameOrigin()` membandingkan header `Origin` dengan `new URL(req.url).origin`.
   Next menormalkan `req.url` ke host internalnya (selalu `localhost:3000`),
   sehingga di domain/port apa pun pemeriksaan itu gagal. Sekarang pemakaian
   `req.url` diganti header `Host`/`X-Forwarded-Host`. **Tanpa perbaikan ini
   aplikasi tidak bisa menyimpan apa pun di VPS.**
2. **`package-lock.json` tidak sinkron** dengan `package.json` (commit
   "@radix-ui/react-tabs dependency"), sehingga `npm ci` gagal di mesin bersih.
   Lock sudah diperbarui.
3. **`npm run typecheck` gagal** karena `components/ui/{combobox,input-group,sidebar}.tsx`
   merujuk berkas yang tidak ada dan tidak dipakai aplikasi. Ketiganya dihapus.

## Yang perlu diperiksa manusia

Kata sandi di-hash dengan scrypt dari modul `crypto` bawaan Node (parameter
N=16384, r=8, p=1, garam 16 byte acak per pengguna), dan cookie sesi hanya
menyimpan SHA-256 token di database. Ini pekerjaan yang belum ditinjau pihak
ketiga — mintalah peninjauan bila aplikasi ini akan dibuka ke publik dengan data
keuangan sungguhan.
