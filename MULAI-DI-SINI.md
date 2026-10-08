# Saku — instalasi GitHub + Vercel + Supabase

Paket ini adalah salinan migrasi Tour Ledger. Tampilan, perhitungan cash advance,
reimburse, kelompok hari, ekspor laporan, riwayat tim, dan pengaturan tampilan
berasal dari aplikasi asli. Login diganti menjadi email dan kata sandi Supabase.
Semua anggota yang diberi akses berbagi satu buku kas, seperti aplikasi awal.

## Status

Kode dapat diuji dan dibangun tanpa kredensial. Agar dapat digunakan, jalankan SQL,
buat akun anggota, dan isi empat environment variables di bawah.
Paket ini TIDAK memuat data transaksi atau struk dari website lama.
Jangan mengganti website lama sebelum data lama selesai dipindahkan dan dibandingkan.
Pengujian terhadap akun Supabase dan deployment Vercel milikmu belum dilakukan.

## 1. Buat penyimpanan Supabase

1. Buka https://supabase.com/dashboard dan masuk.
2. Buat project baru khusus Saku. Pilih wilayah yang dekat dengan pengguna.
3. Buat password database yang kuat dan simpan sendiri.
4. Buka SQL Editor, buat query baru, salin seluruh isi `supabase/setup.sql`, lalu Run.
5. Di Authentication → Users, buat pengguna dengan email dan password milikmu.
   Jika memakai dialog Add user/Create user, aktifkan Auto Confirm User jika tersedia.
   Tidak perlu mengirim undangan email untuk langkah ini.
6. Nonaktifkan pendaftaran pengguna baru pada pengaturan Authentication.
   Tambahkan anggota lain secara manual bila diperlukan.
7. Ambil Project URL, publishable/anon key, dan secret/service_role key dari
   pengaturan API/Connect project. Nama menu bisa berbeda menurut versi dashboard.

Struk disimpan pada bucket private `receipts`; tidak perlu membuat bucket public
atau menambah policy akses anonymous. SQL membatasi tabel agar hanya server Saku
bisa membaca dan menulis.

## 2. Unggah kode ke GitHub Babaji222/Saku

1. Ekstrak ZIP ini di komputer.
2. Buka repository https://github.com/Babaji222/Saku.
3. Pilih “uploading an existing file” / “mengunggah file yang sudah ada”.
4. Buka folder hasil ekstraksi dan unggah ISINYA. File `package.json` harus berada
   langsung di halaman utama repository, bukan di dalam folder tambahan.
5. Sertakan folder `app`, `components`, `hooks`, `lib`, `public`, `supabase`,
   `tests`, `vendor` serta file konfigurasi dan `package-lock.json`.
6. Jangan unggah `.env.local`, password, atau secret key. Paket hanya berisi
   `.env.example` dengan nilai contoh, bukan kredensial asli.
7. Commit changes ke branch `main`.

## 3. Pengaturan Vercel

Pada halaman impor repository Saku:

- Project Name: `saku`
- Framework Preset: **Next.js**
- Root Directory: `./`
- Build Command: `npm run build`
- Install Command: `npm ci`
- Output Directory: default Next.js (tidak perlu diisi manual)
- Node.js: **22.x**

Tambahkan di Environment Variables:

| Nama | Nilai |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Project URL Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Publishable key atau legacy anon key |
| SUPABASE_SERVICE_ROLE_KEY | Secret key atau legacy service_role key |
| SAKU_ALLOWED_EMAILS | Email akun yang boleh masuk; pisahkan dengan koma untuk beberapa orang |

Kunci rahasia hanya boleh berada di environment Vercel/server. Jangan memberi
awalan NEXT_PUBLIC pada SUPABASE_SERVICE_ROLE_KEY dan jangan mengirimnya lewat chat.
Isi daftar email dengan akun sebenarnya, bukan nilai contoh `.env.example`.

Setelah SQL, akun, kode GitHub, dan variabel lengkap, klik Deploy.
Jika mengubah NEXT_PUBLIC variables setelah build, lakukan Redeploy agar
unggah struk menggunakan pengaturan baru.

## 4. Periksa sebelum digunakan

- Buka URL hasil deploy. Pengunjung tanpa login harus diarahkan ke halaman Masuk.
- Login dengan email yang sudah dibuat dan masuk daftar izin.
- Buat trip percobaan, isi CA, tambah transaksi, edit, dan uji reimburse.
- Unggah satu gambar dan PDF, buka kembali struk. Batasnya 10 MB per file.
- Refresh halaman dan pastikan data bertahan. Coba dengan akun tim kedua.
- Ekspor laporan dan cocokkan saldo.
- Klik Keluar, lalu pastikan URL `/api/ledger` tidak dapat dibuka tanpa login.

Unggahan dikirim langsung ke Supabase dengan izin sementara sehingga tidak
melewati batas request body Vercel. Struk yang dibuka menggunakan tautan privat
berumur 60 detik dan diunduh. Semua anggota yang diizinkan dapat melihat buku kas
serta struk bersama. Menghapus akses: hapus email dari SAKU_ALLOWED_EMAILS lalu
redeploy; sesi tidak akan mendapat akses aplikasi pada permintaan berikutnya.

## 5. Data lama — tahap terpisah, belum dilakukan

Kode aplikasi dan data transaksi adalah dua hal berbeda. Data, struk, pengaturan
tersimpan, serta riwayat dari ChatGPT Sites belum ikut ZIP. Tetap gunakan aplikasi
lama untuk catatan asli sampai proses pemindahan data selesai. Diperlukan ekspor
buku kas lengkap dan seluruh file struk; setelah diimpor, cocokkan jumlah trip,
transaksi, total CA, saldo, reimburse, dan keterkaitan struk sebelum beralih.

## Menjalankan di komputer (opsional)

Gunakan Node.js 22.x. Jalankan `npm ci`, salin `.env.example` menjadi `.env.local`,
isi variabel, lalu jalankan `npm run dev`. Uji kode dengan `npm test`,
`npm run typecheck`, dan `npm run build`.

## Pemecahan masalah

- “Aplikasi belum selesai disiapkan”: salah satu dari empat variabel belum diisi.
- Gagal masuk: cek akun Supabase, konfirmasi email, password, dan daftar email izin.
- Data gagal dimuat: cek SQL sudah dijalankan dan secret key benar.
- Struk gagal: cek bucket private receipts, URL/key publik, format dan ukuran file.
- Vercel masih memilih Other: pastikan package.json berada di root repository,
  lalu pilih Next.js.
- Password terlupa: pengelola mengatur ulang melalui dashboard Supabase.

Rujukan implementasi:
https://supabase.com/docs/guides/auth/server-side/creating-a-client
https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
https://vercel.com/docs/functions/limitations
