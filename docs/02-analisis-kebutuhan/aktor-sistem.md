# 01 Aktor-Sistem

## 1. Gambaran Umum

Sistem Informasi Theodore Coffee merupakan sistem yang digunakan untuk membantu proses pemesanan, transaksi, pengelolaan pesanan, produksi minuman, pengelolaan bahan dan stok, laporan, serta pengelolaan sistem.

Pada versi 1 (V1), sistem memiliki empat aktor utama:

1. Customer
2. Cashier
3. Barista/Dapur
4. Admin/Owner

Aktor Manager belum termasuk dalam versi 1 dan direncanakan untuk ditambahkan ketika Theodore Coffee berkembang menjadi café dengan skala yang lebih besar.

Sistem membedakan pesanan menjadi dua jenis:

- **Online** — pesanan dibuat oleh Customer melalui website.
- **Offline** — pesanan dibuat oleh Customer secara langsung melalui Cashier di booth.

Meskipun sumber pesanan berbeda, seluruh pesanan yang akan diproduksi harus melewati Cashier terlebih dahulu sebelum masuk ke antrean produksi Barista.

---

## 2. Aktor Sistem

| No | Aktor | Status V1 | Fungsi Utama |
|---|---|---|---|
| 1 | Customer | Aktif | Melihat menu, membuat pesanan online, melakukan pembayaran, dan memantau pesanan |
| 2 | Cashier | Aktif | Mengelola pesanan offline, memvalidasi pesanan online, menangani pembayaran, dan mengatur antrean |
| 3 | Barista/Dapur | Aktif | Memproses dan menyelesaikan pesanan |
| 4 | Admin/Owner | Aktif | Mengelola keseluruhan sistem, data, stok, laporan, pengguna, dan pengaturan |
| 5 | Manager | Belum V1 | Akan ditambahkan pada pengembangan café berikutnya |

---

## 3. Aktor Customer

### 3.1 Identitas Customer

Customer tidak perlu membuat akun.

Customer mengakses website melalui QR Code yang disediakan oleh Theodore Coffee.

Customer hanya perlu memasukkan:

- Nama lengkap

Tidak diperlukan:

- Username
- Password
- Email
- Nomor telepon

Sistem memberikan akses terbatas kepada Customer hanya untuk proses pemesanan, pembayaran, dan pemantauan pesanan miliknya.

### 3.2 Hak Akses Customer

Customer dapat:

1. Mengakses website melalui QR Code.
2. Memasukkan nama.
3. Melihat daftar menu.
4. Melihat harga menu.
5. Memilih produk.
6. Menentukan jumlah produk.
7. Memilih tingkat gula.
8. Memilih tingkat es.
9. Memilih metode brewing.
10. Memilih add-on jika tersedia.
11. Menambahkan catatan pesanan.
12. Melihat keranjang.
13. Melihat subtotal dan total pembayaran.
14. Melakukan checkout.
15. Mengonfirmasi pesanan sebelum dikirim.
16. Melakukan pembayaran melalui QRIS setelah pesanan diterima oleh Cashier.
17. Melihat status pesanan secara realtime.
18. Melihat riwayat pesanan yang berkaitan dengan akses pesanan miliknya.
19. Membatalkan pesanan selama pesanan belum mulai diproses oleh Barista.

Customer tidak dapat:

- Mengubah harga.
- Mengubah status pesanan.
- Mengubah status pembayaran.
- Mengakses dashboard internal.
- Mengakses data Customer lain.
- Mengubah pesanan setelah pesanan dikonfirmasi dan dikunci.
- Membatalkan pesanan setelah Barista mulai memproses pesanan.

### 3.3 Aturan Konfirmasi Pesanan Customer

Sebelum pesanan dikirim ke sistem, Customer harus melakukan konfirmasi.

Alurnya:

    Customer memilih menu
            ↓
    Mengatur customization
            ↓
    Melihat keranjang
            ↓
    Checkout
            ↓
    Popup konfirmasi pesanan
            ↓
    ┌───────────────────────┐
    │   Mau Ubah Lagi       │
    │          atau         │
    │          Ya           │
    └───────────────────────┘

Jika Customer memilih:

**`Mau Ubah Lagi`**

Maka Customer kembali ke halaman pemesanan untuk mengubah pesanan.

Jika Customer memilih:

**`Ya`**

Maka pesanan dikunci dan dikirim ke Cashier.

Setelah memilih `Ya`, Customer tidak dapat mengubah isi pesanan.

---

## 4. Aktor Cashier

Cashier merupakan aktor yang berfungsi sebagai pengelola transaksi dan gerbang utama seluruh pesanan sebelum masuk ke produksi Barista.

Cashier menangani pesanan Offline secara langsung dan melakukan validasi terhadap pesanan Online.

### 4.1 Hak Akses Cashier

Cashier dapat:

1. Login ke sistem.
2. Melihat dashboard Cashier.
3. Melihat menu.
4. Membuat pesanan Offline.
5. Memasukkan nama Customer Offline.
6. Memilih produk.
7. Menentukan jumlah produk.
8. Memilih tingkat gula.
9. Memilih tingkat es.
10. Memilih metode brewing.
11. Menambahkan catatan.
12. Melihat total pembayaran.
13. Menerima pembayaran Cash.
14. Menerima pembayaran QRIS.
15. Mengonfirmasi pembayaran.
16. Menghasilkan kode atau nomor pesanan.
17. Melihat pesanan Online.
18. Menerima pesanan Online.
19. Menolak pesanan Online apabila tidak dapat ditangani.
20. Melihat status pesanan.
21. Mengonfirmasi pesanan yang telah dibayar untuk masuk ke antrean produksi.
22. Mengelola antrean produksi sesuai aturan FIFO.
23. Membatalkan pesanan sesuai aturan sistem.
24. Mengedit pesanan sesuai hak akses dan status pesanan.
25. Melihat riwayat transaksi.
26. Mencari transaksi berdasarkan kode pesanan.
27. Melihat detail transaksi.
28. Membuat PDF struk.
29. Mencetak struk.
30. Melakukan cetak ulang struk.

Cashier dapat melihat data menu tetapi tidak memiliki hak untuk mengubah data menu utama.

### 4.2 Aturan Pesanan Online untuk Cashier

Pesanan Online yang dikirim Customer tidak langsung masuk ke antrean produksi.

Cashier terlebih dahulu memeriksa pesanan.

Cashier dapat memilih:

- `TERIMA`
- `TOLAK`

Jika pesanan ditolak:

    Pesanan Online
          ↓
       Cashier
          ↓
       DITOLAK
          ↓
    Customer menerima
    informasi penolakan

Customer belum melakukan pembayaran sehingga tidak diperlukan proses pengembalian dana.

Jika pesanan diterima:

    Pesanan Online
          ↓
       Cashier
          ↓
       DITERIMA
          ↓
    Customer mendapat
    instruksi pembayaran
          ↓
    Customer membayar melalui QRIS
          ↓
    Pembayaran berhasil
          ↓
    Pembayaran diverifikasi
          ↓
    Cashier mengonfirmasi
          ↓
    Masuk antrean produksi
          ↓
       Barista

Pesanan yang sudah diterima tetapi belum dibayar tidak masuk ke antrean produksi.

---

## 5. Aktor Barista/Dapur

Barista/Dapur bertanggung jawab terhadap proses produksi minuman.

Barista hanya menerima pesanan yang telah melewati Cashier dan telah memenuhi syarat untuk diproduksi.

Barista tidak menangani proses pembayaran.

### 5.1 Hak Akses Barista

Barista dapat:

1. Login ke sistem.
2. Melihat antrean produksi.
3. Menerima notifikasi pesanan baru.
4. Melihat nama Customer.
5. Melihat kode pesanan.
6. Melihat jenis pesanan Online atau Offline.
7. Melihat seluruh detail menu.
8. Melihat jumlah produk.
9. Melihat tingkat gula.
10. Melihat tingkat es.
11. Melihat metode brewing.
12. Melihat add-on.
13. Melihat catatan Customer.
14. Menekan tombol `BUAT PESANAN`.
15. Mengubah status menjadi `SEDANG DIBUAT`.
16. Melihat pesanan yang sedang dikerjakan.
17. Menekan tombol `PESANAN SELESAI`.
18. Mengubah status pesanan menjadi `SIAP DIAMBIL`.
19. Melihat riwayat pesanan yang telah selesai.

Barista tidak dapat:

- Mengubah isi pesanan.
- Membatalkan pesanan.
- Mengubah harga.
- Mengubah pembayaran.
- Mengelola transaksi.
- Menerima atau menolak pesanan Online.
- Mengatur urutan antrean.
- Mencetak struk.
- Mencetak label.

---

## 6. Aktor Admin/Owner

Admin/Owner merupakan aktor dengan hak akses tertinggi dalam sistem Theodore Coffee V1.

Admin/Owner bertanggung jawab terhadap pengelolaan sistem, produk, bahan, stok, resep, transaksi, laporan, pengguna, dan konfigurasi sistem.

### 6.1 Dashboard dan Monitoring

Admin/Owner dapat:

1. Login.
2. Melihat dashboard.
3. Melihat transaksi hari ini.
4. Melihat total penjualan atau omzet.
5. Melihat jumlah pesanan.
6. Melihat produk terlaris.
7. Melihat stok yang rendah.
8. Melihat pesanan yang sedang aktif.

### 6.2 Pengelolaan Produk

Admin/Owner dapat:

1. Menambahkan produk.
2. Mengedit produk.
3. Menghapus produk.
4. Menentukan harga.
5. Mengelola kategori.
6. Mengunggah gambar produk.
7. Mengaktifkan atau menonaktifkan produk.

### 6.3 Pengelolaan Customization

Admin/Owner dapat mengelola:

- Pilihan tingkat gula.
- Pilihan tingkat es.
- Metode brewing.
- Add-on.

### 6.4 Pengelolaan Bahan dan Stok

Admin/Owner dapat:

1. Menambahkan bahan.
2. Mengedit bahan.
3. Menghapus bahan.
4. Menambahkan stok.
5. Mengurangi stok.
6. Melakukan koreksi stok.
7. Melihat stok saat ini.
8. Melihat riwayat pergerakan stok.
9. Menentukan batas minimum stok.
10. Melihat peringatan stok rendah.

### 6.5 Pengelolaan Resep

Admin/Owner dapat:

1. Membuat resep.
2. Mengedit resep.
3. Menghapus resep.
4. Menentukan jumlah bahan yang digunakan dalam setiap produk.
5. Mengatur hubungan antara produk dan bahan.
6. Menggunakan resep sebagai dasar pengurangan stok otomatis ketika produk terjual.

### 6.6 Pengelolaan Transaksi dan Pesanan

Admin/Owner dapat:

1. Melihat seluruh transaksi.
2. Melihat detail transaksi.
3. Mencari transaksi.
4. Membatalkan transaksi sesuai aturan sistem.
5. Mengedit transaksi sesuai hak akses dan status transaksi.
6. Melihat pesanan Online.
7. Melihat pesanan Offline.
8. Membuat PDF struk.
9. Mencetak struk.
10. Mencetak ulang struk.

### 6.7 Laporan

Admin/Owner dapat melihat dan menghasilkan:

- Laporan penjualan harian.
- Laporan penjualan mingguan.
- Laporan penjualan bulanan.
- Laporan penjualan tahunan.
- Laporan produk terlaris.
- Laporan stok.
- Laporan penggunaan bahan.
- Laporan transaksi.
- Laporan pendapatan.

Laporan dapat diekspor ke:

- PDF
- Excel

### 6.8 Pengelolaan Pengguna

Admin/Owner dapat mengelola akun internal:

- Cashier
- Barista
- Admin

Admin/Owner dapat:

1. Membuat akun.
2. Mengedit akun.
3. Menghapus akun.
4. Mengatur role pengguna.

Customer tidak menggunakan akun internal sehingga pengelolaan akun Customer tidak menjadi bagian dari sistem V1.

### 6.9 Pengaturan Sistem

Admin/Owner dapat mengatur:

1. Nama Theodore Coffee.
2. Logo.
3. Informasi booth.
4. QRIS.
5. Pengaturan printer struk atau label.
6. Kapasitas antrean produksi.
7. Activity log.

---

## 7. Aktor Manager

Manager tidak termasuk dalam versi 1.

Manager direncanakan sebagai aktor tambahan ketika Theodore Coffee berkembang menjadi café yang lebih besar dan membutuhkan struktur operasional yang lebih kompleks.

Pada V1, fungsi pengawasan dan pengelolaan masih berada pada Admin/Owner.

---

## 8. Pemisahan Jenis Pesanan

Sistem memiliki dua jenis pesanan:

1. Pesanan Online.
2. Pesanan Offline.

### 8.1 Pesanan Online

Pesanan Online dibuat oleh Customer melalui website Theodore Coffee.

#### Alur Pesanan Online

    Customer
        ↓
    Scan QR Code
        ↓
    Masukkan Nama
        ↓
    Pilih Menu
        ↓
    Customization
        ↓
    Checkout
        ↓
    Konfirmasi Pesanan
        ↓
    Pesanan Masuk ke Cashier
        ↓
    Cashier Memeriksa
        ↓
    ┌─────────────────┬─────────────────┐
    │     DITERIMA    │      DITOLAK    │
    └────────┬────────┴────────┬────────┘
             ↓                 ↓
    Customer Bayar          Selesai
             ↓
    Pembayaran Berhasil
             ↓
    Pembayaran Diverifikasi
             ↓
    Cashier Konfirmasi
             ↓
    Masuk Antrean Produksi
             ↓
          Barista

Pesanan Online tidak langsung masuk ke Barista.

Pesanan Online juga tidak masuk ke antrean produksi sebelum:

1. Pesanan diterima Cashier.
2. Customer melakukan pembayaran.
3. Pembayaran berhasil dan terverifikasi.
4. Cashier mengonfirmasi pesanan untuk masuk ke antrean produksi.

### 8.2 Pesanan Offline

Pesanan Offline dibuat langsung melalui Cashier ketika Customer datang ke booth.

#### Alur Pesanan Offline

    Customer Datang
          ↓
       Cashier
          ↓
      Input Nama
          ↓
      Pilih Menu
          ↓
    Customization
          ↓
     Hitung Total
          ↓
    Customer Membayar
          ↓
    Cashier Konfirmasi Pembayaran
          ↓
    Cashier Menekan "PESAN"
          ↓
    Kode/Nomor Pesanan Dibuat
          ↓
    Masuk Antrean Produksi
          ↓
        Barista

Customer Offline menggunakan:

- Nama Customer.
- Nomor atau kode pesanan.

---

## 9. Aturan Antrean Produksi

Seluruh pesanan yang akan dibuat oleh Barista harus melewati Cashier terlebih dahulu.

Tidak diperbolehkan adanya alur langsung:

    Customer → Barista

atau:

    Website → Barista

Alur sistem yang digunakan:

    ONLINE ──┐
             ↓
          CASHIER
             ↑
    OFFLINE ─┘
             ↓
    ANTREAN PRODUKSI
             ↓
          BARISTA

Online dan Offline tetap memiliki identitas jenis pesanan yang berbeda.

Namun, setelah memenuhi seluruh syarat produksi, keduanya akan masuk ke dalam satu antrean produksi Barista.

### 9.1 Prinsip FIFO

Antrean produksi menggunakan prinsip:

**FIFO (First In, First Out)**

Artinya, pesanan yang terlebih dahulu masuk ke antrean produksi akan diproses terlebih dahulu.

Cashier tidak diperbolehkan mengubah urutan antrean secara bebas.

Sistem menentukan urutan berdasarkan waktu pesanan masuk ke antrean produksi.

### 9.2 Contoh Antrean Produksi

    #01  TC-001  OFFLINE
    #02  TC-002  ONLINE
    #03  TC-003  OFFLINE
    #04  TC-004  ONLINE

Contoh tersebut hanya menggambarkan urutan antrean dan bukan jumlah antrean tetap.

---

## 10. Syarat Masuk Antrean Produksi

Pesanan hanya dapat masuk ke antrean produksi apabila telah memenuhi persyaratan sesuai jenis pesanannya.

### 10.1 Pesanan Online

Pesanan Online dapat masuk ke antrean produksi apabila:

1. Pesanan telah diterima oleh Cashier.
2. Customer telah melakukan pembayaran.
3. Pembayaran telah berhasil dan terverifikasi.
4. Cashier mengonfirmasi pesanan untuk masuk ke antrean produksi.

### 10.2 Pesanan Offline

Pesanan Offline dapat masuk ke antrean produksi apabila:

1. Pesanan telah dibuat oleh Cashier.
2. Customer telah melakukan pembayaran.
3. Pembayaran telah dikonfirmasi.
4. Cashier menekan tombol `PESAN`.

Pesanan dengan status:

- `MENUNGGU KONFIRMASI`
- `MENUNGGU PEMBAYARAN`

tidak dihitung sebagai antrean produksi.

---

## 11. Pengendalian Antrean

Sistem menyediakan informasi mengenai kondisi antrean produksi kepada Cashier.

Kapasitas antrean produksi dapat ditentukan melalui pengaturan sistem oleh Admin/Owner.

### Contoh Antrean Masih Tersedia

    Antrean Aktif : 5
    Kapasitas     : [sesuai pengaturan sistem]
    Status        : MASIH TERSEDIA

### Contoh Antrean Penuh

    Antrean Aktif : [sesuai kapasitas]
    Kapasitas     : [sesuai pengaturan sistem]
    Status        : PENUH

Apabila kapasitas antrean telah mencapai batas yang ditentukan, sistem memberikan peringatan kepada Cashier.

Cashier dapat menggunakan informasi tersebut untuk mengontrol penerimaan pesanan Online berikutnya.

Pengendalian antrean bertujuan untuk:

- Mencegah pesanan menumpuk.
- Mengurangi beban Barista.
- Menghindari waktu tunggu yang terlalu lama.
- Membantu Cashier mengontrol jumlah pesanan.
- Menjaga kelancaran operasional booth.

---

## 12. Status Pesanan

Status pesanan secara umum terdiri dari:

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
       SIAP DIAMBIL
            ↓
          SELESAI

Terdapat status tambahan:

- `DITOLAK`
- `DIBATALKAN`

### 12.1 Penjelasan Status

| Status | Keterangan |
|---|---|
| `MENUNGGU KONFIRMASI` | Pesanan Online telah dikirim Customer dan sedang menunggu pemeriksaan Cashier |
| `MENUNGGU PEMBAYARAN` | Pesanan telah diterima Cashier tetapi Customer belum melakukan pembayaran |
| `DIBAYAR` | Pembayaran telah berhasil dan terverifikasi |
| `MENUNGGU DIPROSES` | Pesanan telah memenuhi syarat produksi dan menunggu diproses oleh Barista |
| `SEDANG DIBUAT` | Pesanan sedang dibuat oleh Barista |
| `SIAP DIAMBIL` | Pesanan telah selesai dibuat dan dapat diambil Customer |
| `SELESAI` | Pesanan telah selesai dan diambil Customer |
| `DITOLAK` | Pesanan Online ditolak oleh Cashier sebelum pembayaran |
| `DIBATALKAN` | Pesanan dibatalkan sesuai aturan sistem |

### 12.2 Aturan Perubahan Status

Perubahan status harus mengikuti alur proses sistem.

Customer hanya dapat melihat status dan tidak dapat mengubah status.

Cashier bertanggung jawab terhadap status yang berkaitan dengan penerimaan pesanan, pembayaran, dan masuknya pesanan ke antrean produksi.

Barista bertanggung jawab terhadap status produksi:

    MENUNGGU DIPROSES
            ↓
      SEDANG DIBUAT
            ↓
       SIAP DIAMBIL

Setelah pesanan selesai dibuat, status menjadi `SIAP DIAMBIL`.

Setelah Customer mengambil pesanan, status dapat menjadi `SELESAI`.

---

## 13. Prinsip Hak Akses

Sistem menerapkan pembagian tanggung jawab dan hak akses sebagai berikut:

| Aktor | Pemesanan | Pembayaran | Antrean Produksi | Produksi | Data Master | Laporan |
|---|---|---|---|---|---|---|
| Customer | Online | QRIS | Lihat | - | - | - |
| Cashier | Offline & Validasi Online | Cash/QRIS | Kelola Sesuai FIFO | - | - | Lihat |
| Barista | - | - | Terima | Kelola | - | - |
| Admin/Owner | Kelola | Kelola | Kelola | Monitoring | Kelola | Kelola |
| Manager | - | - | - | - | - | Belum V1 |

### Keterangan

- **Customer** hanya dapat membuat pesanan Online dan melakukan pembayaran QRIS.
- **Cashier** menangani pesanan Offline, memeriksa pesanan Online, menangani pembayaran, dan mengonfirmasi pesanan untuk masuk ke antrean produksi.
- **Barista** hanya menangani proses produksi pesanan yang telah masuk ke antrean.
- **Admin/Owner** memiliki akses pengelolaan sistem secara menyeluruh.
- **Manager** belum menjadi bagian dari sistem V1.

Pembagian hak akses ini digunakan sebagai dasar untuk tahap analisis kebutuhan fungsional, kebutuhan non-fungsional, desain sistem, database, implementasi, dan pengujian.
```