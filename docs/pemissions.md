# Permissions dan Security — Theodore Coffee V1

Terkait: `prd.md`, `order-flow.md`, `data-model.md`.

## 1. Peran

| Peran | Login | Keterangan |
|---|---|---|
| Customer | Tidak | Anonim, mengakses order lewat ID order |
| Cashier | Ya (akun pribadi) | Dibuat oleh Admin |
| Barista | Ya (akun pribadi) | Dibuat oleh Admin |
| Admin | Ya (akun pribadi) | Akun pertama dibuat manual di Supabase |

Tidak ada pendaftaran publik. Semua akun internal hanya dibuat oleh Admin.

**Penggunaan bersamaan:** beberapa akun Cashier atau Barista boleh aktif di waktu yang sama, dan satu akun boleh login di lebih dari satu laptop. Tidak ada pembatasan satu sesi per akun. Antrean dan status order tersinkron di semua layar, dan aksi pada order yang sama oleh dua orang menghasilkan satu pemenang (lihat `order-flow.md`). Karena satu akun bisa dipakai di dua laptop, log aktivitas juga mencatat ID sesi/perangkat.

## 2. Matriks peran vs aksi

| Aksi | Customer | Cashier | Barista | Admin |
|---|---|---|---|---|
| Lihat menu aktif (termasuk status Habis) | Ya | Ya | Ya | Ya |
| Buat order online | Ya | - | - | - |
| Input order manual (termasuk waktu manual) | - | Ya | - | Ya |
| Lihat status order sendiri (lewat ID order) | Ya | - | - | - |
| Batalkan order saat Menunggu konfirmasi | Ya (order sendiri) | Ya | - | Ya |
| Batalkan order di antrean (sebelum Barista menekan Mulai) | - | Ya | - | Ya |
| Lihat daftar semua order beserta statusnya | - | Ya | - | Ya |
| Konfirmasi order + pilih metode bayar | - | Ya | - | Ya |
| Lihat antrean Barista (hanya yang sudah dikonfirmasi) | - | - | Ya | - |
| Tombol Mulai dan Selesai | - | - | Ya | - |
| Lihat harga dan data pembayaran | - | Ya | - | Ya |
| Lihat sisa stok (hanya baca): sisa porsi per menu dan sisa bahan | - | Ya | Ya | Ya |
| Laporan hari ini dan Riwayat (lihat dan cetak) | - | Ya | - | Ya |
| Kelola menu dan resep | - | - | - | Ya |
| Ubah stok bahan (restock dan koreksi) | - | - | - | Ya |
| Kelola akun Cashier/Barista | - | - | - | Ya |
| Lihat log aktivitas dan log error | - | - | - | Ya |

**Tidak boleh diubah atau dihapus oleh siapa pun (termasuk Admin):** order berstatus selesai atau dibatalkan, laporan di Riwayat, log aktivitas, log error.

**Layar Barista** hanya menampilkan nomor antrean, nama customer, item + jumlah, dan catatan. Tanpa harga dan data pembayaran. Ada tambahan panel sisa stok (hanya baca), yang bukan data harga atau pembayaran.

## 3. Akses customer (tanpa login)

Customer tidak mengakses tabel langsung. Semua lewat fungsi khusus di server:

| Fungsi | Yang dilakukan |
|---|---|
| `create_order` | Membuat order. Harga dihitung ulang dari `menu_items`, bukan dari kiriman klien. Memakai kunci unik anti-ganda dan pembatasan jumlah permintaan. |
| `get_order_status` | Mengembalikan data ringkas (status, nomor antrean, item) untuk satu ID order yang cocok. |
| `cancel_order` | Membatalkan order sendiri, hanya kalau statusnya masih Menunggu konfirmasi. |

- ID order berupa uuid yang panjang dan tidak bisa ditebak, dan tidak ada daftar order yang bisa dijelajahi
- ID order disimpan di browser customer, sehingga membuka QR booth lagi dari HP yang sama langsung menampilkan order aktifnya
- Halaman status customer dipasang `noindex`

## 4. Aturan database (RLS)

Semua tabel **menolak akses secara default**. Akses dibuka per kebutuhan:

| Tabel | Siapa membaca | Siapa menulis |
|---|---|---|
| profiles | Pemilik akun (dirinya sendiri), Admin (semua) | Admin |
| menu_items | Cashier dan Barista (hanya yang aktif), Admin (semua). **Customer tidak membaca tabel**, menu diambil lewat fungsi server `get_menu`. | Admin |
| ingredients, recipes | Admin (langsung). Cashier dan Barista hanya melihat sisa stok lewat fungsi server `get_stock_overview`, bukan membaca tabel. | Admin (stok hanya lewat fungsi yang mencatat pergerakan) |
| orders, order_items | Cashier dan Admin (semua). Barista lewat tampilan khusus tanpa harga, hanya status antrean dan dikerjakan. | Hanya lewat fungsi (create, confirm, cancel, start, finish) |
| payments | Cashier, Admin | Hanya fungsi konfirmasi |
| stock_movements | Admin | Hanya fungsi (konfirmasi order, koreksi Admin) |
| queue_counters | Tidak ada | Hanya fungsi |
| daily_reports | Cashier, Admin | Hanya tugas otomatis pergantian hari, tanpa update atau hapus |
| activity_logs, error_logs | Admin | Hanya sistem (tanpa update atau hapus) |

Status Habis untuk customer dikembalikan sebagai nilai ya/tidak per menu, bukan data stok.

## 5. Dasar keamanan

- **Secret:** kunci `service role` Supabase, token Sentry, dan kunci lain hanya ada di server dan environment variable Vercel. Tidak pernah masuk ke kode klien atau repo.
- **Validasi di server:** jumlah item bilangan bulat positif dengan batas maksimum, panjang nama dan catatan dibatasi, menu harus aktif, semua input divalidasi sebelum masuk database.
- **Harga selalu dihitung server,** tidak pernah dipercaya dari klien.
- **Pembatasan permintaan** pada pembuatan order oleh customer, supaya tidak bisa dibanjiri order palsu.
- **Pendaftaran publik dimatikan** di Supabase Auth. Password minimal panjang tertentu.
- **Halaman internal** (Cashier, Barista, Admin) dan halaman status customer dipasang `noindex`.
- **Aksi ditolak dicatat:** percobaan akses yang tidak diizinkan dan login gagal masuk ke log.
- **Backup database** diaktifkan di Supabase.
- **HTTPS** dari Vercel secara bawaan.

## 6. Asumsi dan belum diputuskan

- Admin boleh menginput order manual sebagai cadangan Cashier (sejalan dengan Admin boleh konfirmasi dan batalkan)
- Admin tidak memakai tombol Mulai/Selesai (itu tugas Barista)
- Durasi sesi login sebelum keluar otomatis: ditentukan saat implementasi
- Reset password: dilakukan Admin, belum ada alur lupa password mandiri