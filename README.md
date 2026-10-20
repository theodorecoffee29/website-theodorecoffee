# ☕ Theodore Coffee — Sistem Booth Kopi

## Tentang

Sistem pemesanan, stok, dan laporan untuk booth kopi di acara sekolah/pesantren: customer pesan lewat HP tanpa login, Cashier mengonfirmasi pembayaran, Barista mengerjakan antrean, dan Admin mengelola menu, resep, stok, laporan, akun, serta log. **Status: V1 masih dalam pengembangan** — sebagian tahap (Fase) belum selesai, rincian scope ada di `docs/Prd.md`.

## Tumpukan teknologi dan prasyarat

- **Next.js** (App Router, TypeScript) + **React** untuk aplikasi web.
- **Supabase** (PostgreSQL + Auth) untuk database, login staf, dan fungsi database; migrasi dikelola dengan **Supabase CLI** lewat `npx supabase`.
- **Vitest** untuk unit test, **ESLint + Prettier** untuk gaya kode.
- Prasyarat: **Node.js 22** (proyek memakai `@types/node` ^22 — cek dengan `node --version`), **npm** (proyek ini hanya memakai npm, bukan yarn/pnpm), dan akun Supabase.

## Setup lokal dari nol

### 1. Ambil kode

```bash
git clone https://github.com/theodorecoffee29/website-theodorecoffee.git
cd website-theodorecoffee
```

### 2. Pasang dependensi

```bash
npm install
```

Selain dependensi aplikasi, perintah ini juga memasang **Supabase CLI** karena `supabase` sudah terdaftar sebagai devDependency proyek. Karena itu tidak perlu memasang CLI secara global: cukup pakai `npx supabase ...` (npx otomatis memakai versi milik proyek).

### 3. Salin dan isi file environment

```bash
# macOS / Linux
cp .env.example .env.local

# Windows (PowerShell)
Copy-Item .env.example .env.local
```

Isi `.env.local` dengan **tiga** variabel di bawah ini. Semua nilainya diambil dari **Supabase Dashboard → Project Settings → API** pada **project development**. Jangan menulis nilai di mana pun selain `.env.local`:

| Variabel | Diambil dari (dashboard Supabase) |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → **anon / public** (kunci publik) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → **service_role** (kunci ini RAHASIA; tekan tombol tampilan/eye untuk membacanya) |

Catatan: `NEXT_PUBLIC_` berarti nilainya ikut masuk ke kode browser, jadi hanya kunci publik (URL dan anon) yang boleh berawalan itu. `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai sisi server.

### 4. Login dan link Supabase CLI ke project development

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

`<PROJECT_REF>` adalah kode project milikmu: di Supabase Dashboard buka **Project Settings → General → Reference ID**, lalu salin nilainya. Pastikan yang di-link adalah **project development**, bukan production.

### 5. Jalankan migrasi database

```bash
npx supabase db push --dry-run   # lihat dulu SQL yang akan dijalankan
npx supabase db push             # jalankan kalau sudah sesuai
```

### 6. Isi data contoh (HANYA development)

Buka **Supabase Dashboard → SQL Editor** (project development), tempel **seluruh isi** file `supabase/seed/dev_seed.sql`, lalu tekan Run. File ini berisi menu, bahan, dan resep contoh; aman dijalankan berulang kali. **Jangan pernah menjalankan file ini di production.**

### 7. Buat akun Admin pertama

1. Di dashboard: **Authentication → Users → Add user**, isi email dan kata sandi, lalu buat akunnya (pakai auto-confirm, atau konfirmasi emailnya setelah dibuat). Setelah akun muncul di daftar, **salin User UID**-nya.
2. Buka **SQL Editor** (project development) dan jalankan satu perintah ini (ganti isinya, jangan pakai nilai contoh apa pun):

```sql
insert into public.profiles (id, name, role)
values ('<User UID dari Authentication>', '<Nama Tampilan>', 'admin');
```

Kolom `profiles` tidak memuat email (emailnya disimpan di Supabase Auth), jadi yang dibutuhkan hanya id, nama, dan peran. Tanpa baris ini, login akan ditolak.

### 8. Jalankan aplikasi

```bash
npm run dev
```

Buka <http://localhost:3000>.

## Perintah sehari-hari

| Perintah | Fungsi |
|---|---|
| `npm run dev` | server development dengan hot reload |
| `npm run build` | build produksi |
| `npm run lint` | periksa gaya kode dengan ESLint |
| `npm run format` | tulis ulang format semua file di `src/**` dengan Prettier |
| `npm run test` | jalankan unit test (Vitest) |

Bonus: `npm start` menjalankan hasil `npm run build`.

## Struktur folder

```
src/app/              halaman (customer, status, cashier, barista, admin) dan route API
src/components/       komponen tampilan (hanya menerima props, tanpa panggilan API)
src/features/         logika per area: hook, pemanggil API, teks
src/lib/              klien Supabase, validasi (zod), helper log
src/lib/server/       logika sisi server
supabase/migrations/  migrasi SQL (tabel, RLS, fungsi)
supabase/seed/        data contoh untuk development
supabase/tests/       skrip tes SQL untuk development
docs/                 dokumentasi
```

## Peta dokumen

- `docs/Prd.md` — fitur V1, batas scope, kriteria sukses
- `docs/Order-flow.md` — status order dan perpindahan antar status
- `docs/data-model.md` — tabel, field, aturan data
- `docs/pemissions.md` — siapa boleh apa, RLS, keamanan (nama filenya memang `pemissions`)
- `docs/api-contract.md` — fungsi server: input, output, error, validasi
- `docs/logging.md` — aksi yang dicatat, kode error, aturan log
- `docs/archive/` — dokumen lama, abaikan

## Alur migrasi database

Setiap perubahan database adalah satu file SQL baru di `supabase/migrations/`.

```bash
npx supabase migration new <nama_migrasi>   # membuat file kosong (timestamp otomatis)
# ... isi file SQL-nya ...
npx supabase db push --dry-run              # tinjau dulu
npx supabase db push                        # terapkan
npx supabase migration list                 # cek status migrasi
```

- **Migrasi yang sudah terpasang tidak pernah diedit.** Kalau ada kesalahan, koreksi lewat migrasi **baru** (misalnya file `*_fix.sql`).
- File yang ada di repo adalah catatan resmi perubahan database.

**Menjalankan skrip tes:** salin **utuh** satu file dari `supabase/tests/` ke **SQL Editor project development**, lalu Run satu blok (jangan per baris). Hasilnya berupa pesan **error** yang berawalan `RINGKASAN TES` — itu **diseengaja**: bloknya memang diakhiri dengan exception supaya seluruh perubahan dibatalkan dan tidak ada data tes yang tertinggal. Baca ringkasannya untuk tahu pemeriksaan mana yang lolos atau gagal. Skrip tes juga hanya untuk development.

## Aturan keamanan singkat

- **Jangan commit `.env.local` dan `opencode.json`** — keduanya sudah masuk `.gitignore`.
- Kunci rahasia (`SUPABASE_SERVICE_ROLE_KEY`, kata sandi) **hanya di server**, tidak pernah di kode klien, log, atau dokumen.
- **Jangan jalankan data contoh (`supabase/seed/`) atau skrip tes (`supabase/tests/`) di production.**
- Selalu **cek nama project di dashboard** sebelum menjalankan SQL apa pun.

## Keterbatasan yang diketahui

- **Pembatas permintaan masih di memori** (`src/lib/server/pembatas-permintaan.ts`): hanya akurat untuk satu instance; di banyak instance batasnya jadi berlipat, dan pembatasan per IP berisiko menolak banyak customer yang memakai WiFi booth yang sama.
- **pg_cron harus diaktifkan dulu di project** (Dashboard → Database → Extensions) sebelum jadwal penyimpanan laporan harian bisa terpasang; tanpa itu laporan tidak tersimpan otomatis. Catatan: project Supabase gratis bisa dijeda/dinonaktifkan sementara oleh sistem.
- **Uji beban dan pelonggaran pembatas per IP dijadwalkan di Fase 8** (lihat `docs/api-contract.md` bagian 7).
- **Tampilan masih sementara sampai Fase 7**: HTML polos tanpa desain final; logika tidak ikut berubah saat tampilan diganti.

## Pemecahan masalah

1. **Halaman 404** untuk alamat yang dibuka → rute itu memang belum dibuat. Cek dulu folder `src/app/` apakah `page.tsx`/`route.ts`-nya sudah ada.
2. **Login selalu gagal** → biasanya akun belum terkonfirmasi (cek Authentication → Users) atau belum ada baris di `public.profiles` (langkah 7 di atas). Akun nonaktif juga akan ditolak.
3. **`function does not exist` setelah `db push`** → SQL Editor menunjuk project yang salah, atau migrasinya belum masuk. Cocokkan nama project di dashboard dan jalankan `npx supabase migration list`.
4. **Error JSON saat memanggil fungsi database** → fungsi dibuat dengan **argumen bernama** (`p_...`), bukan posisi. Pastikan pemanggilan `rpc()` memakai nama argumen sesuai `docs/api-contract.md`.
5. **Setelah mengubah `.env.local`, nilainya tidak berubah** → hentikan `npm run dev` lalu jalankan lagi; server hanya membaca environment saat start.
6. **Laporan tidak tersimpan otomatis tiap hari** → ekstensi/pg_cron belum aktif di project, lihat bagian Keterbatasan.
7. **Error `RATE_LIMITED` (terlalu banyak permintaan)** → pembatas permintaan aktif (10 kali per menit per IP); tunggu periode berikutnya, atau kurangi polling.
