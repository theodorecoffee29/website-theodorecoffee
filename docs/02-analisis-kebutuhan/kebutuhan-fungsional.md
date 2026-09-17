# 02 Kebutuhan Fungsional

## 1. Customer

Sistem harus memungkinkan Customer untuk:

1. Mengakses website melalui QR Code.

2. Mengisi nama pemesan (Atas Nama).

3. Melihat daftar menu dan harga.

4. Memilih produk dan jumlah.

5. Memilih tingkat gula.

6. Memilih tingkat es.

7. Memilih metode brewing.

8. Memilih add-on jika tersedia.

9. Menambahkan catatan pesanan.

10. Melihat keranjang dan total pembayaran.

11. Mengubah pesanan sebelum konfirmasi.

12. Mengonfirmasi pesanan.

13. Menerima kode pesanan unik.

14. Melihat status pesanan secara realtime.

15. Melakukan pembayaran CASH.

16. Melakukan pembayaran QRIS melalui Midtrans.

17. Mengganti metode QRIS menjadi CASH jika pembayaran QRIS gagal atau kedaluwarsa.

18. Membatalkan pesanan sebelum Barista mulai membuat.

19. Melihat informasi pengembalian dana untuk pesanan yang sudah dibayar dan dibatalkan.

20. Melihat perubahan status pesanan tanpa melakukan refresh halaman.

**Catatan:** Customer tidak memiliki akun/login dan tidak memiliki riwayat transaksi pribadi berbasis akun.

---

## 2. Cashier

Sistem harus memungkinkan Cashier untuk:

1. Login.

2. Melihat menu.

3. Membuat pesanan langsung dari booth.

4. Memasukkan nama Customer.

5. Memilih produk dan jumlah.

6. Mengatur gula.

7. Mengatur es.

8. Memilih metode brewing.

9. Memilih add-on.

10. Menambahkan catatan.

11. Melihat total harga.

12. Menerima pembayaran CASH.

13. Melihat pembayaran QRIS/Midtrans.

14. Mengonfirmasi pembayaran.

15. Menghasilkan kode pesanan otomatis.

16. Melihat pesanan dari website.

17. Menerima atau menolak pesanan online.

18. Melihat status pesanan.

19. Mengedit pesanan sebelum Barista mulai membuat.

20. Membatalkan pesanan sesuai aturan sistem.

21. Melihat riwayat transaksi.

22. Mencari transaksi berdasarkan kode pesanan.

23. Melihat detail transaksi.

24. Membuat dan mencetak/reprint Struk PDF.

25. Menerima notifikasi realtime ketika pesanan selesai dibuat Barista.

### Aturan Edit Pesanan

Cashier dapat mengubah:

- Produk
- Jumlah
- Customization
- Add-on
- Catatan

Jika pesanan sudah dibayar dan kemudian diedit:

- Jika total bertambah, terdapat kekurangan pembayaran.
- Jika total berkurang, terdapat kelebihan pembayaran.
- Jika total sama, tidak terdapat selisih pembayaran.

Jika Barista sudah menekan **BUAT PESANAN**, pesanan menjadi terkunci.

---

## 3. Barista/Dapur

Sistem harus memungkinkan Barista untuk:

1. Login.

2. Melihat pesanan masuk.

3. Mendapatkan notifikasi pesanan baru.

4. Melihat nama Customer.

5. Melihat kode pesanan.

6. Melihat detail menu.

7. Melihat jumlah.

8. Melihat tingkat gula.

9. Melihat tingkat es.

10. Melihat metode brewing.

11. Melihat catatan Customer.

12. Menekan **BUAT PESANAN**.

13. Mengubah status menjadi **SEDANG DIBUAT**.

14. Melihat pesanan aktif.

15. Menangani beberapa pesanan secara bersamaan.

16. Menekan **PESANAN SELESAI**.

17. Mengubah status menjadi **SELESAI**.

18. Melihat riwayat pesanan selesai.

### Aturan Produksi

```text
MENUNGGU DIPROSES
        ↓
SEDANG DIBUAT
        ↓
SELESAI
```
Barista:
- Tidak dapat mengedit pesanan.
- Tidak dapat membatalkan pesanan.
- Tidak dapat mengubah pembayaran.
- Tidak dapat melakukan refund.
- Tidak dapat mengubah stok secara manual.
- Tidak dapat mencetak struk.
- Tidak ada batas maksimum jumlah pesanan yang dapat berstatus SEDANG DIBUAT.

FIFO tetap digunakan sebagai prioritas antrean.
4. Admin/Owner

Sistem harus memungkinkan Admin/Owner untuk:

## 4.1 Dashboard

Melihat total transaksi hari ini.

Melihat total omzet hari ini.

Melihat jumlah pesanan hari ini.

Melihat produk terlaris.

Melihat bahan dengan stok rendah.

Melihat pesanan yang sedang diproses.

Melihat pesanan yang menunggu.

Melihat ringkasan pembayaran CASH.

Melihat ringkasan pembayaran QRIS/Midtrans.

Melihat grafik penjualan.

## 4.2 Manajemen Produk/Menu

Menambah produk/menu.

Mengedit produk/menu.

Menghapus produk/menu.

Mengubah harga.

Mengelola kategori.

Mengunggah gambar produk.

Mengaktifkan/nonaktifkan produk.

Mengatur deskripsi.

Mengatur ketersediaan produk.

Mengatur apakah produk dapat dipesan secara online.

Mengelola pilihan gula.

Mengelola pilihan es.

Mengelola metode brewing.

Mengelola add-on.

## 4.3 Manajemen Bahan dan Stok

Menambah bahan.

Mengedit bahan.

Menghapus bahan.

Menentukan satuan bahan, seperti gram, kilogram, mililiter, liter, pcs, dan lainnya.

Menentukan stok awal.

Menambah stok saat restock.

Mengurangi stok secara manual.

Melakukan koreksi stok.

Melihat stok saat ini.

Menentukan minimum stok.

Menerima peringatan stok rendah.

Melihat riwayat stok masuk.

Melihat riwayat stok keluar.

Melihat pengguna yang mengubah stok.

Melihat tanggal dan waktu perubahan stok.

## 4.4 Manajemen Resep

Menambah resep.

Mengedit resep.

Menghapus resep.

Memilih bahan untuk resep.

Menentukan jumlah bahan.

Menentukan satuan penggunaan bahan.

Menggunakan beberapa bahan dalam satu resep.

Melihat detail resep setiap produk.

Mengaktifkan/nonaktifkan resep.

Sistem mengurangi stok secara otomatis berdasarkan resep ketika transaksi berhasil.

Sistem mencegah atau memberikan informasi jika bahan yang dibutuhkan tidak mencukupi.

Melihat riwayat penggunaan bahan berdasarkan transaksi.

Contoh resep:

```text
LATTE
├── Espresso 18 gram
├── Milk 150 ml
└── Sugar 10 gram
```

Jika satu Latte terjual:

```text
Milk 10.000 ml
        ↓
     -150 ml
        ↓
Milk 9.850 ml
```

# 5. Pesanan dan Transaksi

1. Sistem harus memungkinkan Admin/Owner untuk:

2. Melihat seluruh pesanan.

3. Melihat detail pesanan.

4. Melihat pesanan online.

5. Melihat pesanan offline.

6. Mencari pesanan berdasarkan kode pesanan.

7. Mencari pesanan berdasarkan nama Customer.

8. Memfilter berdasarkan status.

9. Memfilter berdasarkan metode pembayaran.

10. Melihat detail pembayaran.

11. Melihat status pembayaran Midtrans.

12. Melihat transaksi CASH.

13. Mengedit pesanan sesuai aturan sistem.

14. Membatalkan pesanan sesuai aturan sistem.

15. Melihat pesanan yang dibatalkan.

16. Melihat riwayat perubahan pesanan.

17. Melihat pengguna yang melakukan perubahan.

18. Melihat tanggal dan waktu perubahan.

19. Membuat Struk PDF.

20. Mencetak/reprint Struk PDF.

21. Melihat kekurangan atau kelebihan pembayaran.

22. Mencatat refund manual.

23. Melihat riwayat refund.

# 6. Laporan

Admin/Owner dapat melihat:

1. Penjualan harian.

2. Penjualan mingguan.

3. Penjualan bulanan.

4. Penjualan tahunan.

5. Revenue/omzet.

6. Jumlah transaksi.

7. Produk terlaris.

8. Produk paling sedikit terjual.

9. Penggunaan bahan.

10. Laporan stok.

11. Laporan stok masuk.

12. Laporan stok keluar.

13. Transaksi CASH.

14. Transaksi QRIS/Midtrans.

15. Transaksi online.

16. Transaksi offline.

17. Transaksi dibatalkan.

18. Refund.

19. Filter berdasarkan tanggal/periode.

20. Export laporan ke PDF.

21. Export laporan ke Excel.

# 7. User dan Role

Admin/Owner dapat mengelola akun internal:

## 7.1 Cashier

1. Menambah akun.

2. Mengedit akun.

3. Menonaktifkan akun.

4. Menghapus akun.

5. Reset password.

## 7.2 Barista

1. Menambah akun.

2. Mengedit akun.

3. Menonaktifkan akun.

4. Menghapus akun.

5. Reset password.

## 7.3 Admin/Owner

1. Menambah akun.

2. Mengedit akun.

3. Menonaktifkan akun.

4. Menghapus akun.

5. Reset password.

## 7.4 Pengelolaan Umum

1. Mengelola role.

2. Melihat daftar user.

3. Melihat status aktif/nonaktif.

4. Melihat aktivitas user.

5. Melihat waktu login terakhir.

> Customer tidak termasuk dalam pengelolaan akun internal karena Customer tidak memiliki akun pada V1.
# 8. Pembayaran

Metode pembayaran V1:

1. CASH.
2. QRIS → Midtrans.

## Alur Pembayaran QRIS

```text
Customer
    ↓
Membuat Order
    ↓
Cashier menerima order
    ↓
Customer checkout
    ↓
Midtrans
    ↓
QRIS
    ↓
Customer melakukan pembayaran
    ↓
Midtrans
    ↓
Webhook
    ↓
Next.js API
    ↓
Supabase
    ↓
Status pembayaran diperbarui
    ↓
Order dapat diproses
```

- Customer tidak memiliki tombol SAYA SUDAH BAYAR.
- Status pembayaran digital diperoleh dari sistem pembayaran Midtrans melalui mekanisme yang disediakan.

# 9. Status Pesanan

Status utama:

```text
MENUNGGU KONFIRMASI
        ↓
MENUNGGU PEMBAYARAN
        ↓
DIBAYAR
        ↓
MENUNGGU DIPROSES
        ↓
SEDANG DIBUAT
        ↓
SELESAI
```

Status tambahan:

- DITOLAK.<br>
- DIBATALKAN.

## Definisi Status

1. **MENUNGGU KONFIRMASI:** order online dikirim Customer dan menunggu konfirmasi Cashier.

2. **MENUNGGU PEMBAYARAN:** order telah diterima tetapi pembayaran belum selesai.

3. **DIBAYAR:** pembayaran telah diterima atau diverifikasi.

4. **MENUNGGU DIPROSES:** order sudah memenuhi syarat produksi dan menunggu Barista.

5. **SEDANG DIBUAT:** order sedang dibuat oleh Barista.

6. **SELESAI:** minuman telah selesai dibuat dan siap diambil.

7. **DITOLAK:** order online ditolak Cashier sebelum pembayaran.

8. **DIBATALKAN:** order dibatalkan sesuai aturan sistem.

> Tidak terdapat status SIAP DIAMBIL dan SUDAH DIAMBIL.

# 10. Realtime

Sistem harus menyediakan pembaruan realtime untuk:

1. Status pesanan Customer.

2. Pesanan baru pada Cashier.

3. Perubahan status pesanan.

4. Pesanan yang masuk ke Barista.

5. Pesanan yang selesai dibuat Barista.

6. Notifikasi Cashier.

## Customer

1. Ketika pesanan sedang dibuat:

   🟡 Pesananmu sedang dibuat

2. Ketika Barista selesai:

   🟢 Pesananmu selesai dan siap diambil

3. Perubahan status ditampilkan tanpa Customer melakukan refresh halaman.

## Cashier

1. Jika Barista menyelesaikan pesanan saat Cashier sedang berada di halaman lain:

   🟢 Pesanan Selesai — Nama Customer — Kode Pesanan

2. Notifikasi ditampilkan sebagai toast kecil, tidak memindahkan halaman, tidak membuka modal, dan menghilang otomatis.

3. Cashier juga memiliki halaman Pesanan untuk melihat daftar pesanan dan statusnya.

# 11. Stok dan Ketersediaan Produk

1. Jika bahan yang diperlukan tidak mencukupi, produk tidak dapat dipesan.

Contoh:

```text
LATTE

Milk tersedia : 100 ml
Kebutuhan     : 150 ml
```

Hasil:

```text
❌ LATTE TIDAK TERSEDIA
```

>Sistem juga melakukan pemeriksaan ulang ketika Customer memilih produk.

Jika stok berubah ketika Customer masih membuka halaman menu:

```text
Customer memilih LATTE
        ↓
Sistem memeriksa stok terbaru
        ↓
Stok tidak mencukupi
        ↓
❌ Produk tidak dapat dipesan
```

## Pembatalan

1. Jika order belum dibayar:

   DIBATALKAN

   Tidak ada refund.

2. Jika order sudah dibayar:
```text
   DIBATALKAN

        ↓

   Refund dilakukan secara manual

        ↓

   Refund dicatat dalam sistem.
   ```
   
# 12. Audit Log dan Error Log

Semua aktivitas penting dalam sistem harus memiliki jejak/log.

## 12.1 Aktivitas Berhasil

Status:

> SUCCESS

Contoh:

- Login berhasil.
- Logout.
- Penambahan data.
- Pengeditan data.
- Penghapusan data.
- Perubahan harga.
- Perubahan stok.
- Perubahan resep.
- Perubahan pesanan.
- Pembatalan.
- Konfirmasi pembayaran.
- Refund.
- Perubahan user/role.
- Perubahan pengaturan.
- Export laporan.
- Generate Struk PDF.

## 12.2 Aktivitas Gagal

Status:

> FAILED

Contoh:

- Login gagal.
- Pembayaran gagal.
- Refund gagal.
- Export gagal.
- Generate Struk PDF gagal.
- Perubahan data gagal.
- Perubahan stok gagal.

## 12.3 Error Sistem

Status:

> ERROR

Contoh:

- Application error.
- Database error.
- API error.
- Midtrans/webhook error.
- Supabase error.
- Error proses otomatis.

## Data Log

Jika diperlukan, log dapat menyimpan:

- Waktu.
- Jenis aktivitas.
- Status.
- User/actor.
- Role.
- Action.
- Data atau objek terkait.
- Order ID.
- IP/session/device jika diperlukan.
- Pesan error.
- Perubahan data sebelum dan sesudah.

Sistem tidak boleh menyimpan password, secret key, token rahasia, credential Midtrans, atau data sensitif lainnya dalam log.

## Prinsip

>Kalau sesuatu yang penting terjadi di sistem, harus ada jejaknya.
# 13. Backup dan Recovery

Admin/Owner dapat:

- Melihat status backup database.
- Melihat waktu backup terakhir.
- Membuat backup manual.
- Download/export data backup.
- Melakukan restore data dari backup.
- Melihat riwayat backup.
- Melihat riwayat restore.
- Mendapatkan notifikasi jika backup gagal.
- Melihat backup yang gagal pada log.
- Melihat restore yang gagal pada log.

> Catatan: implementasi teknis backup dan recovery akan disesuaikan dengan kemampuan serta batasan Supabase dan layanan yang digunakan.

# 14. Production Queue

Production Queue digunakan untuk mengatur pesanan yang akan dibuat Barista.

## Admin/Owner

Admin/Owner hanya dapat memantau:

- Production queue aktif.
- Waiting queue.
- Jumlah pesanan dalam antrean.
- Status produksi.
- Barista yang mengerjakan pesanan.
- Waktu masuk antrean.
- Waktu mulai produksi.
- Waktu selesai produksi.
- Riwayat production queue.

Admin/Owner tidak dapat:

- Mengubah urutan FIFO.
- Mengubah status produksi.
- Menghapus pesanan dari queue.
- Menekan BUAT PESANAN.
- Menekan PESANAN SELESAI.

## Aturan Queue

1. Order online dan offline menggunakan sistem order yang sama setelah memenuhi syarat produksi.

2. Order yang belum dibayar tidak masuk proses produksi.

3. FIFO digunakan sebagai prioritas antrean.

4. Barista dapat mengerjakan beberapa order secara bersamaan.

5. Tidak ada batas maksimum jumlah order berstatus SEDANG DIBUAT.

6. Setelah Barista menyelesaikan order, order berstatus SELESAI dan keluar dari antrean produksi aktif.
# 15. Aturan Alur Online dan Offline

## 15.1 Online

```text
Customer
↓
Scan QR
↓
Isi Atas Nama
↓
Pilih Menu
↓
Customization
↓
Keranjang
↓
Konfirmasi
↓
MENUNGGU KONFIRMASI
↓
Cashier menerima/menolak
↓
Jika diterima
↓
Pembayaran
↓
DIBAYAR
↓
MENUNGGU DIPROSES
↓
Barista
↓
SEDANG DIBUAT
↓
SELESAI
```

## 15.2 Offline/Booth

```text
Customer datang ke booth
↓
Cashier memasukkan nama
↓
Cashier memilih menu
↓
Customization
↓
Customer melakukan pembayaran
↓
Cashier mengonfirmasi pembayaran
↓
Cashier menekan PESAN
↓
Sistem membuat kode pesanan
↓
MENUNGGU DIPROSES
↓
Barista
↓
SEDANG DIBUAT
↓
SELESAI
```

## Aturan Umum

- Semua order, baik online maupun offline, harus melalui Cashier sebelum masuk ke proses produksi Barista.
- Tidak terdapat alur langsung:
  - Customer → Barista
  - Website → Barista

# 16. Aturan Pembatalan

- Customer dapat membatalkan pesanan selama Barista belum mulai membuat pesanan.
- Jika pesanan belum dibayar:
  - DIBATALKAN.
  - Tidak diperlukan refund.
- Jika pesanan sudah dibayar:
```  
   DIBATALKAN.
      ↓
   Refund manual.
      ↓
   Status/riwayat refund dicatat.
```
> Setelah Barista menekan BUAT PESANAN dan status 
menjadi SEDANG DIBUAT, pesanan tidak dapat dibatalkan melalui alur pembatalan normal.
# 17. Aturan Penguncian Pesanan

Sebelum Barista mulai membuat:

- Customer dapat mengubah pesanan sebelum konfirmasi.
- Cashier dapat mengubah pesanan sesuai hak akses dan aturan sistem.

Setelah Barista menekan:

- BUAT PESANAN

status berubah menjadi:

- SEDANG DIBUAT

Pesanan kemudian dikunci.

Pada kondisi tersebut:

- Customer tidak dapat mengedit.
- Cashier tidak dapat mengedit.
- Barista tidak dapat mengedit.
- Pesanan tidak dapat dibatalkan melalui alur normal.

# 18. Struk PDF

Struk PDF tersedia untuk:

- Cashier.
- Admin/Owner.

Cashier dapat membuat Struk PDF dari:

- Halaman Pesanan/Buat Pesanan.
- Riwayat Transaksi.

>Admin/Owner dapat membuat atau melakukan reprint Struk PDF dari data transaksi.

Struk minimal memuat:

- Theodore Coffee.
- Kode pesanan.
- Nama Customer.
- Tanggal dan waktu.
- Daftar produk.
- Jumlah.
- Detail customization.
- Subtotal.
- Total.
- Metode pembayaran.
- Ucapan terima kasih.

>Barista dan Customer tidak memiliki fitur pembuatan/reprint Struk PDF.
# 19. Hak Akses Aktor

| Fitur | Customer | Cashier | Barista | Admin/Owner |
|---|---|---|---|---|
| Login | ❌ | ✅ | ✅ | ✅ |
| Melihat menu | ✅ | ✅ | ✅ | ✅ |
| Membuat order | ✅ Online | ✅ Offline | ❌ | Sesuai kebutuhan |
| Edit order | Sebelum konfirmasi | Sebelum produksi | ❌ | Sesuai aturan |
| Konfirmasi order online | ❌ | ✅ | ❌ | ❌ |
| Pembayaran | ✅ | ✅ | ❌ | Monitoring |
| Produksi | ❌ | ❌ | ✅ | Monitoring |
| Edit stok manual | ❌ | ❌ | ❌ | ✅ |
| Kelola resep | ❌ | ❌ | ❌ | ✅ |
| Kelola produk | ❌ | ❌ | ❌ | ✅ |
| Kelola user | ❌ | ❌ | ❌ | ✅ |
| Laporan | ❌ | Riwayat transaksi | Riwayat produksi | ✅ |
| Struk PDF | ❌ | ✅ | ❌ | ✅ |
| Audit log | ❌ | Sesuai akses | Sesuai akses | ✅ |
| Backup/Recovery | ❌ | ❌ | ❌ | ✅ |
| Monitoring production queue | ❌ | Melihat pesanan | Mengelola produksi | Monitoring |