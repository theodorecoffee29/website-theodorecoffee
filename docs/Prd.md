# PRD — Theodore Coffee V1

Sistem pemesanan dan operasional untuk booth kopi di acara sekolah/pesantren.
Dokumen terkait: `order-flow.md`, `data-model.md`, `permissions.md`, `ui-spec.md`.

## 1. Tujuan

Membuat pemesanan di booth rapi, tercatat, dan bisa dilacak: dari order masuk, pembayaran, pembuatan pesanan, sampai laporan penjualan.

## 2. Masalah yang diselesaikan

| Masalah di booth | Jawaban sistem |
|---|---|
| Antrean menumpuk, urutan tidak jelas | Antrean berurutan di layar Barista + nomor antrean |
| Pesanan tidak dicatat sama sekali | Setiap order tersimpan sejak dibuat |
| Uang pernah kurang, tidak bisa dilacak | Setiap pembayaran dicatat (metode, nominal, Cashier) dan bisa dicocokkan |
| Hasil penjualan tidak diketahui | Laporan otomatis + Riwayat |

## 3. Pengguna dan perangkat

| Peran | Perangkat | Tugas |
|---|---|---|
| Customer | HP sendiri (scan QR booth), tanpa login, cukup nama | Pesan, lihat status, batalkan sebelum konfirmasi |
| Cashier | Laptop | Input order, konfirmasi order + metode bayar, batalkan |
| Barista | Laptop | Kerjakan antrean, tandai pesanan selesai |
| Admin/Owner | Fleksibel | Menu, resep, stok, laporan, akun, log |

Semua halaman responsif (tidak ada versi khusus per perangkat).

## 4. Fitur V1

**Customer** (HP, tanpa login)
1. Lihat menu (menu tampil **Habis** kalau bahan tidak cukup untuk satu porsi)
2. Pilih item dan jumlah, plus catatan per item
3. Isi nama, kirim pesanan, dapat nomor antrean
4. Lihat status: Menunggu konfirmasi → Sedang dibuat → Pesanan selesai
5. Batalkan pesanan (hanya sebelum konfirmasi, dengan popup Ya/Tidak)

**Cashier** (laptop)
6. Notifikasi pesanan online baru
7. Konfirmasi order + pilih metode bayar (QRIS atau tunai), sekaligus pencatatan pembayaran offline
8. Input order manual untuk customer yang datang ke kasir (bisa dengan waktu manual untuk cadangan kertas)
9. Batalkan order (sebelum konfirmasi)

**Barista** (laptop)
10. Antrean berurutan berdasarkan waktu konfirmasi
11. Tombol **Mulai**, lalu **Selesai**, di tiap order

**Admin/Owner** (fleksibel)
12. Kelola menu dan resep
13. Stok bahan baku (gram/ml), berkurang otomatis saat konfirmasi
14. Konfirmasi atau batalkan order sebagai cadangan Cashier
15. Laporan hari ini (live): total penjualan, rincian per asal order dan metode bayar, menu terlaris, pemakaian bahan dan sisa stok
16. Riwayat laporan (tersimpan otomatis tiap pergantian hari) + cetak PDF/struk
17. Kelola akun Cashier dan Barista
18. Log aktivitas dan log error

**Otomatis oleh sistem:** menyimpan setiap order, nomor antrean yang mulai dari 1 tiap hari, pengurangan stok, penyimpanan laporan ke Riwayat, dan pencatatan semua aktivitas dan error.

## 5. Di luar V1

Akun/login customer (poin, riwayat), diskon/promo/voucher, lebih dari satu booth, pesan antar, notifikasi (WhatsApp/suara), layar antrean umum di booth, payment gateway online, mode offline penuh. Printer thermal opsional (tidak wajib).

## 6. Alur order (ringkas)

Status yang dilihat customer: **Menunggu konfirmasi → Sedang dibuat → Pesanan selesai** (atau **Dibatalkan**).

1. Order dibuat (online oleh customer, atau diinput Cashier). Order langsung tersimpan.
2. Customer membayar di booth.
3. Cashier mengonfirmasi dan memilih metode bayar. Order muncul di layar Barista sebagai order baru.
4. Barista menekan Mulai, lalu Selesai setelah pesanan jadi. Customer online melihat statusnya berubah menjadi Pesanan selesai, customer offline dipanggil langsung.

Aturan: order muncul di layar Barista hanya setelah dikonfirmasi Cashier (atau Admin). Pembatalan hanya sebelum konfirmasi (oleh customer, Cashier, atau Admin). Detail status dan kasus tepi ada di `order-flow.md`.

## 7. Pembayaran

Dua cara: **scan QRIS yang terpasang di booth**, atau **bayar langsung** (offline). Tanpa payment gateway. Status dibayar ditandai manual oleh Cashier, jadi sistem mencatat metode, nominal, dan Cashier yang mengonfirmasi.

## 8. Laporan dan Riwayat

- Laporan hari ini tampil live: total penjualan, rincian, menu terlaris, pemakaian bahan dan sisa stok
- Tiap baris order punya dua label: **asal order** (online/Cashier) dan **metode bayar** (QRIS/langsung)
- Laporan masuk otomatis ke **Riwayat** saat pergantian hari (WIB), lalu tidak berubah lagi
- Riwayat bisa dibuka lagi dan dicetak sebagai PDF/struk
- Belum di V1: order per jam, daftar order batal

## 9. Pencatatan (audit dan error)

Semua kejadian penting dicatat otomatis:
- **Log aktivitas:** order dibuat/dikonfirmasi/dibatalkan/selesai, pembayaran dicatat, menu/resep/stok berubah, akun dibuat/diubah, login, laporan tersimpan. Isinya siapa, kapan, apa, dan nilai sebelum/sesudah.
- **Log error:** setiap kegagalan (order gagal dibuat, gagal menyimpan pembayaran, error sistem), dengan konteksnya, untuk diperbaiki kemudian. Rencana: Sentry + logging di Next.js/Supabase/Vercel.
- Log hanya bisa dibaca Admin dan tidak bisa diedit.

## 10. Non-fungsional dan risiko

- Responsif di semua perangkat, cepat dibuka di HP
- **Risiko internet:** koneksi di lokasi acara kadang putus. V1 tetap online. Cadangan: Cashier mencatat di kertas lalu menginput belakangan (order boleh diberi waktu manual). Cek koneksi di lokasi sebelum hari H.
- Aturan akses per peran ditegakkan di database (RLS), detail di `permissions.md`

## 11. Kriteria sukses

1. Semua order tercatat, tidak ada yang lolos tanpa catatan
2. Selisih uang di akhir hari bisa dilacak sampai ke order
3. Antrean berurutan dan tidak ada order yang terlewat
4. Customer tidak bingung memakai halaman pesan
5. Admin langsung tahu hasil penjualan setelah acara

## 12. Stack

Next.js, Supabase (database + auth akun internal), Vercel, Sentry.