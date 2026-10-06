# AGENTS.md — Theodore Coffee

Sistem pemesanan, stok, dan laporan untuk booth kopi di acara sekolah/pesantren. Fokus: V1.
File ini hanya pintu masuk. Detail ada di `docs/`, jangan disalin ulang di sini.

## Stack

Next.js (App Router, TypeScript), Supabase (PostgreSQL + Auth, dikelola lewat **dashboard web**, bukan CLI), Vercel, Sentry. Package manager: **npm**.

## Perintah

```bash
npm install          # pasang dependency
npm run dev          # jalankan lokal
npm run build        # build production
npm run lint         # ESLint
npm run format       # Prettier
npm run test         # unit test
```

Perintah di atas dibuat di Fase 1 (setup). Perbarui bagian ini kalau berubah.

**Migrasi database (tanpa CLI):** tulis tiap perubahan sebagai file SQL bernomor di `supabase/migrations/` (`0001_init.sql`, `0002_...sql`), lalu dijalankan manual berurutan di Supabase Dashboard > SQL Editor. File di repo adalah catatan resmi perubahan database.

## Peta dokumen (baca hanya yang relevan untuk tugasmu)

| Dokumen | Kapan dibaca |
|---|---|
| `docs/prd.md` | Fitur V1, batas scope, kriteria sukses |
| `docs/order-flow.md` | Status order, perpindahan status, acceptance criteria |
| `docs/data-model.md` | Tabel, field, aturan data |
| `docs/permissions.md` | Siapa boleh apa, RLS, keamanan |
| `docs/api-contract.md` | Fungsi server: input, output, error, validasi |
| `docs/logging.md` | Aksi yang dicatat, kode error, aturan log |
| `docs/ui-spec.md` | Tampilan dan desain |

Abaikan `docs/_archive/` (dokumen lama).

## Aturan yang tidak boleh dilanggar

1. **Harga dihitung di server.** Jangan pernah percaya harga atau total dari klien.
2. **Status order hanya berubah lewat fungsi database** (create, confirm, cancel, start, finish), persis sesuai `docs/order-flow.md`. Pakai update bersyarat (`WHERE status = <status lama>`).
3. **Konfirmasi order = satu transaksi:** cek status, catat pembayaran, kurangi stok, ubah status, tulis log. Pembatalan order yang sudah dikonfirmasi juga satu transaksi (batalkan pembayaran, kembalikan stok).
4. **Tidak ada hapus atau ubah** untuk: order selesai/dibatalkan, laporan di Riwayat, `activity_logs`, `error_logs`. Order tidak pernah dihapus.
5. **Semua tabel menolak akses secara default (RLS).** Customer tidak mengakses tabel langsung, hanya lewat fungsi `create_order`, `get_order_status`, `cancel_order`.
6. **Secret dan `service role` hanya di server** dan environment variable. Jangan masuk kode klien atau repo.
7. **Semua aksi dan error dicatat** lewat helper log yang sama (`src/lib/log`). Jangan membuat cara log baru.
8. **Layar Barista tanpa harga dan data pembayaran.**
9. **Stok boleh minus.** Kekurangan stok saat konfirmasi hanya peringatan, bukan blokir.
10. Uang adalah bilangan bulat rupiah. Waktu `timestamptz`, "hari" memakai WIB.

## Struktur folder

```
src/app/            halaman (customer, status/[orderId], cashier, barista, admin)
src/components/     komponen UI
src/lib/            klien Supabase, validasi (zod), helper log
src/server/         logika sisi server
supabase/migrations/  migrasi SQL (tabel, RLS, fungsi), dijalankan manual di dashboard
docs/               dokumentasi
```

## Code style

TypeScript ketat (tanpa `any` kecuali dijelaskan). Nama file kebab-case, komponen PascalCase. Format dan aturan ditegakkan lewat ESLint + Prettier, jadi jalankan `npm run lint` dan `npm run format`, jangan berdebat soal gaya.

## Mode pemula (wajib diikuti)

Pengguna masih pemula dan belajar dari nol lewat proyek ini. Prioritas: **kode sederhana, mudah dibaca, dan mudah dilacak kalau error.**

**Komentar (bahasa Indonesia):**
- Setiap file diawali komentar singkat: file ini untuk apa dan dipakai di mana.
- Setiap fungsi punya komentar: tugasnya, input, output, dan **kenapa** dibuat begitu kalau tidak jelas.
- Istilah atau konsep baru dijelaskan sekali dengan bahasa sederhana (misal apa itu RLS, transaksi).
- Jangan menulis komentar yang cuma mengulang isi kode.

**Gaya kode:**
- Sederhana dan eksplisit: nama variabel dan fungsi panjang dan jelas, satu fungsi satu tugas, hindari trik atau abstraksi rumit.
- Jangan menambah library baru tanpa alasan dan izin.

**Penanganan error (supaya mudah dicari):**
- Setiap operasi yang bisa gagal (database, jaringan, input pengguna) ditangani, tidak boleh dibiarkan atau ditelan diam-diam.
- Pesan error menyebut **di mana** (nama file/fungsi) dan **apa** yang gagal, lalu dicatat lewat helper log.
- Pengguna melihat pesan ramah. Detail teknis hanya ada di log.
- Kalau ada error, jelaskan penyebabnya dengan bahasa sederhana **sebelum** memperbaiki, dan perbaiki akar masalahnya, bukan menyembunyikan error.

**Setelah tiap tugas, jelaskan:**
1. File apa yang dibuat atau diubah dan fungsinya
2. Cara mengecek manual: langkah yang dilakukan dan hasil yang diharapkan
3. Apa yang perlu dipelajari dari tugas itu (satu atau dua poin)

**Keamanan kerja:** berhenti dan tanya kalau ada pilihan penting. Jangan menjalankan perintah yang merusak data (hapus data, reset database) tanpa izin.

## Cara kerja

- **Satu tugas kecil per sesi.** Jangan membangun satu fase sekaligus.
- Baca dokumen yang relevan dulu, baru menulis kode.
- Kalau dokumen dan kode bertentangan, atau dokumen belum menjawab, **tanya dulu**. Jangan memperbaiki atau menebak sendiri.
- Tulis tes untuk alur kritis, jalankan `npm run lint` dan `npm run test` sebelum menyatakan selesai.
- Migrasi lama tidak diubah. Perubahan database selalu lewat file migrasi baru, dan jangan mengubah tabel lewat Table Editor di dashboard tanpa mencatat SQL-nya di file migrasi.

## Definisi selesai (per tugas)

- [ ] Sesuai acceptance criteria di dokumen terkait
- [ ] Lint dan test lolos
- [ ] Aksi dan error baru tercatat di log
- [ ] Akses per peran sesuai `docs/permissions.md`
- [ ] Dokumen diperbarui kalau ada keputusan yang berubah

## Jangan dilakukan

- Menambah fitur di luar V1: akun customer, diskon/promo, multi-booth, pesan antar, notifikasi WhatsApp/suara, layar antrean umum, payment gateway, mode offline penuh
- Mengubah keputusan di dokumen tanpa izin
- Menambah dependency besar tanpa alasan

## Wajib dites

Perpindahan status order, kondisi balapan (batalkan vs konfirmasi, dua Cashier atau dua Barista pada order yang sama), nomor antrean unik per hari, dan akses per peran (tiap peran tidak bisa melihat atau mengubah yang bukan haknya).