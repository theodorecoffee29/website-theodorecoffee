# 05 Sistem Usulan

## 1. Gambaran Umum Sistem Usulan

Sistem usulan merupakan rancangan sistem informasi berbasis website yang dikembangkan untuk mengatasi kelemahan dan keterbatasan yang teridentifikasi pada sistem berjalan Theodore Coffee.

Sistem ini dirancang khusus untuk operasional **Theodore Coffee V1**, yaitu usaha booth minuman santri pada pameran dan kegiatan sekolah di lingkungan pesantren, dengan arsitektur modern yang dapat dikembangkan ketika usaha berkembang menjadi café yang lebih besar.

Melalui sistem usulan ini, proses operasional mulai dari pemesanan menu, verifikasi pembayaran, antrean produksi barista, pengelolaan stok bahan baku berdasarkan resep, hingga rekapitulasi transaksi dan laporan diintegrasikan ke dalam satu platform berbasis web menggunakan **Next.js + Supabase + Midtrans**.

Sistem dirancang responsif dan mendukung pembaruan status secara realtime tanpa memerlukan refresh halaman secara manual.

---

## 2. Pilar Solusi Utama Sistem Usulan

Sistem usulan menghadirkan lima pilar solusi utama yang secara langsung menjawab permasalahan operasional booth.

### 2.1 Digitalisasi Pemesanan (*Dual-Channel Ordering*)

Sistem mendukung dua jalur pemesanan yang terintegrasi:

- **Pemesanan Online (Mandiri oleh Pelanggan):** Pelanggan cukup memindai QR Code di area pameran menggunakan smartphone tanpa perlu membuat akun atau login. Pelanggan mengisi nama pemesan (*Atas Nama*), memilih menu dan kustomisasi seperti tingkat gula, tingkat es, metode seduh, add-on, serta catatan tambahan. Setelah meninjau keranjang, pelanggan melakukan konfirmasi pesanan. Setelah dikonfirmasi, pesanan tidak dapat diedit oleh pelanggan melalui alur normal. Pelanggan mendapatkan kode pesanan unik yang sulit ditebak untuk memantau status pesanannya.

- **Pemesanan Offline (Langsung di Booth):** Pelanggan yang datang langsung ke booth dilayani oleh Kasir melalui antarmuka kasir digital yang terstruktur. Kasir memasukkan nama pelanggan, menu, jumlah, kustomisasi, dan catatan pesanan ke dalam sistem.

- **Keuntungan:** Digitalisasi pemesanan membantu mengurangi antrean fisik, memberikan informasi pesanan yang lebih terstruktur, serta mengurangi ketergantungan pada pencatatan menggunakan nota kertas.

### 2.2 Sistem Pembayaran Fleksibel dan Terverifikasi

Sistem mendukung dua metode pembayaran pada V1, yaitu **Cash dan QRIS melalui Midtrans**.

- **QRIS melalui Midtrans:** Pesanan online yang telah diterima oleh Kasir dapat dilanjutkan ke tahap pembayaran QRIS melalui Midtrans. Status pembayaran diverifikasi berdasarkan informasi pembayaran dari Midtrans melalui mekanisme notifikasi/webhook. Pelanggan tidak memerlukan tombol konfirmasi manual seperti "Saya Sudah Bayar".

- **Pembayaran Tunai (*Cash*):** Pembayaran tunai dilakukan langsung melalui Kasir dan diverifikasi oleh Kasir sebelum pesanan dapat masuk ke proses produksi.

- **Keuntungan:** Sistem membantu mengurangi risiko kesalahan perhitungan pembayaran dan kembalian serta mencatat transaksi tunai dan QRIS secara lebih terstruktur sehingga memudahkan proses rekonsiliasi.

### 2.3 Manajemen Antrean Produksi Terpusat (*FIFO & Kitchen Display*)

- **Satu Pintu Melalui Kasir:** Seluruh pesanan online harus diperiksa dan diterima oleh Kasir terlebih dahulu sebelum dapat masuk ke proses pembayaran dan produksi. Tidak terdapat alur langsung dari website atau pelanggan menuju Barista tanpa melalui Kasir.

- **Antrean Berbasis Prioritas FIFO (*First In, First Out*):** Sistem menggunakan prinsip FIFO sebagai prioritas urutan untuk memulai produksi. Namun, Barista dapat mengerjakan beberapa pesanan secara bersamaan (*multiple production*) dan sistem tidak membatasi jumlah maksimum pesanan yang berstatus `SEDANG DIBUAT`.

- **Layar Dapur Digital (*Kitchen Display*):** Barista menerima tiket pesanan digital yang berisi kode pesanan, nama pelanggan, produk, jumlah, kustomisasi, dan catatan. Barista memperbarui status melalui tombol `BUAT PESANAN` hingga `PESANAN SELESAI`.

- **Penguncian Pesanan (*Order Locking*):** Ketika Barista menekan tombol `BUAT PESANAN` dan status berubah menjadi `SEDANG DIBUAT`, pesanan dikunci. Pesanan tidak dapat diedit atau dibatalkan melalui alur normal setelah proses produksi dimulai.

### 2.4 Otomatisasi Stok Bahan Baku Berbasis Resep (*Bill of Materials*)

- **Pemotongan Stok Otomatis:** Setiap menu dikaitkan dengan resep bahan baku yang menentukan kebutuhan bahan untuk satu porsi. Ketika transaksi telah berhasil dan pesanan memenuhi syarat untuk masuk ke proses produksi, sistem melakukan pemotongan stok bahan baku secara atomik berdasarkan resep.

- **Pencegahan Pesanan dengan Stok Tidak Mencukupi (*Out-of-Stock Prevention*):** Jika stok salah satu bahan tidak mencukupi kebutuhan resep, sistem menandai produk sebagai tidak tersedia dan melakukan validasi kembali pada sisi server sehingga pesanan tidak dapat diproses menggunakan stok yang tidak mencukupi.

- **Peringatan Stok Menipis (*Low-Stock Alerts*):** Admin/Owner mendapatkan informasi atau notifikasi ketika stok bahan mencapai atau berada di bawah batas minimum sehingga dapat dilakukan pengadaan kembali (*restock*).

### 2.5 Laporan Realtime, Struk PDF, dan Audit Log

- **Dashboard Analitik Owner:** Dashboard menampilkan informasi seperti omzet harian, jumlah transaksi, rincian pembayaran tunai dan QRIS, produk terlaris, stok menipis, serta pesanan yang sedang diproses.

- **Struk PDF & Ekspor Laporan:** Kasir dan Admin/Owner dapat membuat serta mencetak ulang Struk PDF berdasarkan data transaksi. Laporan penjualan dan stok dapat diekspor ke format PDF dan Excel (`.xlsx`).

- **Audit Log Terlindungi:** Aktivitas penting seperti login, perubahan stok, pembatalan pesanan, perubahan data transaksi, verifikasi pembayaran, refund, dan aktivitas penting lainnya dicatat dalam audit log. Data audit log dilindungi dari perubahan dan penghapusan melalui aplikasi.
---

## 3. Diagram Alur Sistem Usulan

Berikut adalah visualisasi alur proses terpadu (Online & Offline) pada sistem usulan Theodore Coffee:

```text
PELANGGAN                   KASIR / SISTEM                 MIDTRANS                 BARISTA
    │                             │                            │                       │
    ├── [ONLINE] Scan QR Web ────>│                            │                       │
    ├── Pilih Menu & Kustomisasi ─>│                            │                       │
    ├── Konfirmasi Pesanan ──────>│ (Status: MENUNGGU KONFIRMASI)                      │
    │                             ├─ Periksa (TERIMA / TOLAK)  │                       │
    │<── [Jika Diterima: Bayar] ──┤                            │                       │
    ├── Bayar via QRIS ───────────────────────────────────────>│                       │
    │                             │<── Webhook Notifikasi ─────┤                       │
    │                             ├─ Verifikasi (Status: DIBAYAR)                      │
    │                             ├─ Masuk Antrean Produksi ──────────────────────────>│
    │                             │  (Status: MENUNGGU DIPROSES)                       │
    │                             │                            │                       │
    ├── [OFFLINE] Datang Booth ──>│                            │                       │
    ├── Pesan & Kustomisasi ─────>│ (Kasir Input di Layar POS) │                       │
    ├── Bayar (Cash / QRIS) ─────>│ (Kasir Konfirmasi Bayar)   │                       │
    │                             ├─ Masuk Antrean Produksi ──────────────────────────>│
    │                             │                            │                       │
    │                             │                            │                       ├─ Klik "BUAT PESANAN"
    │<── Notifikasi Realtime ─────┼────────────────────────────────────────────────────┤  (Status: SEDANG DIBUAT)
    │    (Pesanan Sedang Dibuat)  │                            │                       │  *PESANAN TERKUNCI*
    │                             │                            │                       │
    │                             │<── Notifikasi Realtime ────────────────────────────┼─ Klik "PESANAN SELESAI"
    │<── Notifikasi Realtime ─────┴────────────────────────────────────────────────────┤  (Status: SELESAI)
    │    (Pesanan Selesai)                                                             │  *Stok Otomatis Terpotong*
    │                                                                                  │
    ├── Ambil Minuman di Booth ───────────────────────────────────────────────────────>│
```

---

## 4. Tabel Perbandingan: Sistem Berjalan vs Sistem Usulan

Untuk melihat secara jelas transformasi operasional yang terjadi, berikut adalah tabel perbandingan antara sistem manual lama dengan sistem usulan website:

| No | Parameter Operasional | Sistem Berjalan (Manual) | Sistem Usulan (Website Theodore Coffee) |
|---|---|---|---|
| 1 | **Kanal Pemesanan** | Hanya antrean langsung di depan booth | Dual-channel: Pesan mandiri via web (QR Code) & pesan langsung di kasir |
| 2 | **Identitas Pelanggan** | Lisan tanpa sistem pencatatan | Cukup nama pemesan (*Atas Nama*) & kode pesanan unik yang sulit ditebak |
| 3 | **Media Pencatatan Pesanan** | Kertas nota manual (rawan basah/hilang) | Tiket digital pada sistem (tersimpan secara terpusat pada database Supabase) |
| 4 | **Metode Pembayaran** | Terbatas uang tunai (*cash*) | Fleksibel: QRIS otomatis via Midtrans & Tunai (*Cash*) terverifikasi kasir |
| 5 | **Pelacakan Status Pesanan** | Menunggu panggilan suara lisan | Pemantauan status live di layar HP pelanggan secara realtime tanpa refresh |
| 6 | **Penerusan ke Dapur** | Mengoper sobekan kertas ke meja barista | Otomatis tampil di Layar Barista berbasis prioritas FIFO (bisa proses bersamaan) |
| 7 | **Akurasi Kustomisasi** | Sering salah racik karena tulisan nota sulit dibaca | Detail gula, es, seduh, dan catatan tampil terstruktur dalam bentuk teks digital |
| 8 | **Pengendalian Bahan Baku** | Tebak-tebakan kasat mata; sering habis mendadak | Pemotongan stok otomatis via resep; produk otomatis nonaktif jika bahan habis |
| 9 | **Peringatan Stok Rendah** | Tidak ada; baru sadar saat bahan habis di meja | Notifikasi otomatis (*Low-Stock Alert*) ketika stok mendekati batas minimum |
| 10 | **Bukti Pembayaran (Struk)** | Nota sobekan manual yang tidak rapi | Kasir dan Admin/Owner dapat membuat dan mencetak ulang Struk PDF |
| 11 | **Rekapitulasi Keuangan** | Hitung manual nota & uang fisik malam hari (rawan selisih) | Dashboard otomatis merekap omzet harian, memisahkan kas tunai & QRIS |
| 12 | **Keamanan & Jejak Riwayat** | Tidak ada jejak jika ada kecurangan / nota hilang | Audit Log mencatat aktivitas penting dan tidak dapat diubah/dihapus via aplikasi |
| 13 | **Ekspor Data Laporan** | Ditulis tangan di buku kas | Ekspor instan ke format PDF dan Excel (.xlsx) untuk laporan pembukuan |

---

## 5. Manfaat dan Nilai Tambah Sistem Usulan

Penerapan sistem usulan memberikan dampak nyata bagi keberlangsungan operasional usaha:
1. **Peningkatan Efisiensi Pelayanan:** Mengurangi waktu dan antrean fisik dalam proses pelayanan melalui digitalisasi pemesanan.
2. **Mengurangi Risiko Kesalahan Racik:** Detail kustomisasi ditampilkan secara jelas dan terstruktur kepada Barista sehingga mengurangi kesalahan akibat informasi pesanan yang tidak jelas.
3. **Akurasi dan Akuntabilitas Keuangan:** Pencatatan transaksi tunai dan QRIS menjadi lebih terstruktur sehingga memudahkan proses rekonsiliasi dan mengurangi risiko selisih kas.
4. **Efisiensi Penggunaan Bahan Baku (*Cost Control*):** Penggunaan bahan baku terpantau sesuai takaran resep, membantu meminimalisir pemborosan (*waste*) dan mencegah kehabisan bahan di jam sibuk.
5. **Kesiapan Menuju Skala Café:** Struktur sistem yang modular dan terdokumentasi menjadi fondasi yang kokoh saat Theodore Coffee berkembang menjadi café yang lebih besar di masa mendatang.
