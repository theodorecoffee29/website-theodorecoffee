# 04 Sistem Berjalan

## 1. Gambaran Umum

Sistem berjalan merupakan gambaran mengenai tata kelola dan prosedur operasional yang berlangsung pada Theodore Coffee sebelum diterapkannya sistem informasi berbasis website. 

Theodore Coffee merupakan usaha minuman yang dirancang dan dijalankan oleh santri dalam bentuk booth kecil pada kegiatan atau pameran sekolah di lingkungan pesantren. Dalam pelaksanaan operasional awal tanpa sistem pencatatan khusus, seluruh aktivitas pelayanan—mulai dari penerimaan pesanan, pembayaran, pembuatan minuman, hingga pencatatan pembukuan—mengandalkan prosedur manual menggunakan komunikasi lisan dan pencatatan pada lembaran kertas nota fisik.

Meskipun prosedur manual ini dapat digunakan pada kondisi transaksi dengan jumlah sedikit, keterbatasan sistem mulai terlihat ketika volume pesanan meningkat pada jam-jam ramai pameran, yang berpotensi menimbulkan berbagai hambatan operasional dan ketidaksesuaian data.

---

## 2. Prosedur Operasional Manual

Prosedur operasional manual pada booth Theodore Coffee terbagi ke dalam lima tahapan aktivitas utama:

### 2.1 Prosedur Pemesanan Menu
1. Pelanggan mendatangi booth Theodore Coffee secara langsung.
2. Pelanggan melihat papan menu fisik yang tersedia di area booth.
3. Pelanggan menyampaikan pesanan minuman beserta preferensi kustomisasi (tingkat gula, tingkat es, atau metode seduh) secara lisan kepada Kasir.
4. Kasir menuliskan nama pelanggan, daftar pesanan, jumlah, dan kustomisasi rasa pada lembaran kertas nota manual.

### 2.2 Prosedur Pembayaran
1. Kasir menghitung total tagihan secara manual atau menggunakan alat bantu kalkulator.
2. Kasir menginformasikan nominal pembayaran kepada pelanggan.
3. Pelanggan melakukan pembayaran secara tunai (*cash*).
4. Kasir menerima uang fisik, menyimpan ke laci kas, dan memberikan uang kembalian jika diperlukan.
5. Kasir meletakkan lembaran kertas nota pesanan ke meja racik Barista, sementara pelanggan menunggu di sekitar area booth.

### 2.3 Prosedur Pembuatan dan Penyerahan Minuman
1. Barista membaca rincian pesanan dari lembaran kertas nota fisik yang diletakkan di meja racik.
2. Barista menentukan urutan pengerjaan pesanan berdasarkan tumpukan nota fisik yang tersedia di meja racik tanpa adanya indikator sistem antrean prioritas yang baku.
3. Barista meracik minuman sesuai kustomisasi yang tertulis pada nota.
4. Setelah minuman selesai dibuat, Barista memanggil nama pelanggan secara lisan ke arah area pengunjung booth.
5. Pelanggan mengambil minuman di booth, dan lembaran kertas nota pesanan ditandai selesai atau dibuang.

### 2.4 Prosedur Pemantauan Bahan Baku dan Stok
1. Pengelolaan stok bahan baku (biji kopi, susu cair, sirup, gula, dan cup) belum memiliki pencatatan khusus.
2. Pemeriksaan sisa stok bahan baku masih dilakukan secara visual dengan melihat langsung fisik bahan pada toples, botol, atau tempat penyimpanan.
3. Tidak terdapat mekanisme perhitungan otomatis terhadap pengurangan bahan baku setiap kali menu minuman terjual.
4. Ketiadaan sistem peringatan dini membuat ketersediaan bahan baku berpotensi habis di tengah jam operasional tanpa terdeteksi sebelumnya.

### 2.5 Prosedur Rekapitulasi dan Pembukuan Harian
1. Pada akhir jam operasional booth, Kasir mengumpulkan seluruh sisa nota kertas transaksi harian.
2. Kasir menghitung total uang tunai fisik yang terkumpul di dalam laci kas.
3. Kasir mencatat rangkuman omzet dan pengeluaran harian ke dalam buku kas manual.
4. Hasil pencatatan buku kas dilaporkan kepada pengelola/Owner untuk keperluan evaluasi.

---

## 3. Diagram Alur Sistem Berjalan

Berikut adalah visualisasi alur operasional manual yang berjalan pada booth Theodore Coffee:

```text
PELANGGAN                      KASIR                       BARISTA
    │                            │                            │
    ├─ 1. Datang ke booth ──────>│                            │
    ├─ 2. Pesan menu lisan ─────>│                            │
    │                            ├─ 3. Catat di nota kertas   │
    │                            ├─ 4. Hitung total tagihan   │
    │<─ 5. Info nominal ─────────┤                            │
    ├─ 6. Bayar tunai (Cash) ───>│                            │
    │<─ 7. Terima kembalian ─────┤                            │
    │                            ├─ 8. Serahkan nota kertas ─>│
    │                            │                            ├─ 9. Baca tumpukan nota
    │                            │                            ├─ 10. Racik minuman
    │                            │                            ├─ 11. Minuman selesai
    │<─ 12. Panggil nama lisan ───────────────────────────────┤
    ├─ 13. Ambil minuman ────────────────────────────────────>│
    │                            │                            │
```

---

## 4. Analisis Masalah per Pihak (Kelemahan Sistem Berjalan)

Berdasarkan alur operasional manual di atas, diidentifikasi sejumlah potensi permasalahan dan kelemahan yang dapat dialami oleh masing-masing pihak:

### 4.1 Dari Sisi Pelanggan
1. **Waktu Tunggu Antrean Fisik:** Pelanggan harus mengantre secara fisik di depan booth untuk memesan dan menunggu pesanan selesai dibuat.
2. **Ketiadaan Transparansi Status Pesanan:** Pelanggan tidak memiliki akses informasi untuk mengetahui kepastian urutan antrean maupun estimasi waktu selesai pesanan.
3. **Keterbatasan Pilihan Pembayaran:** Transaksi hanya dapat dilakukan secara tunai (*cash*), yang membatasi kenyamanan pelanggan yang ingin menggunakan pembayaran non-tunai.
4. **Panggilan Pengambilan Pesanan Kurang Efektif:** Pemanggilan nama pelanggan secara lisan berpotensi tidak terdengar saat suasana pameran sekolah sedang bising atau ramai.

### 4.2 Dari Sisi Kasir
1. **Beban Pencatatan Manual:** Menuliskan setiap rincian pesanan secara manual membutuhkan waktu lebih lama dan rawan menghasilkan tulisan tangan yang berpotensi sulit dibaca saat antrean padat.
2. **Risiko Kesalahan Perhitungan Kembalian:** Penghitungan total transaksi dan uang kembalian secara manual memiliki risiko terjadinya kekeliruan perhitungan (*human error*).
3. **Kerentanan Pengelolaan Dokumen Fisik:** Lembaran kertas nota pesanan rentan terselip, rusak, basah terkena tumpahan air, atau hilang saat proses pelayanan berlangsung.

### 4.3 Dari Sisi Barista
1. **Risiko Kesalahan Peracikan Kustomisasi:** Tulisan tangan pada nota yang kurang jelas berpotensi menyebabkan salah tafsir mengenai rincian kustomisasi (seperti takaran gula, tingkat es, atau metode seduh).
2. **Potensi Kehabisan Bahan Baku:** Pemeriksaan bahan baku yang hanya mengandalkan pengecekan visual berpotensi menyebabkan bahan baku habis tanpa adanya peringatan sebelumnya di tengah jam operasional sibuk.
3. **Pengelolaan Antrean yang Belum Baku:** Barista menentukan urutan pengerjaan pesanan hanya berdasarkan tumpukan fisik kertas nota tanpa adanya indikator antrean prioritas yang baku.

### 4.4 Dari Sisi Admin/Owner
1. **Ketiadaan Visibilitas Stok Bahan Riil:** Pengelola tidak dapat memantau sisa stok bahan baku secara terpusat dan akurat tanpa melakukan pemeriksaan fisik langsung ke booth.
2. **Risiko Selisih Rekapitulasi Kas:** Proses perhitungan manual antara catatan nota kertas dengan uang tunai fisik berpotensi menimbulkan selisih kas tanpa adanya jejak data transaksi yang dapat diverifikasi dengan cepat.
3. **Ketiadaan Data Analitik Penjualan:** Pengelola tidak memiliki data historis yang rapi mengenai produk terlaris, tren waktu ramai, maupun laporan keuangan yang dapat langsung digunakan sebagai dasar evaluasi bisnis.
4. **Potensi Pemborosan Bahan Baku:** Ketiadaan pencatatan penggunaan bahan yang terhubung dengan penjualan produk berpotensi menyebabkan ketidakefisienan pemakaian bahan baku (*waste*).

---

## 5. Tabel Ringkasan Aktivitas Manual dan Permasalahannya

| No | Aktivitas Operasional | Pelaksana | Media / Alat | Permasalahan Utama |
|---|---|---|---|---|
| 1 | Pemesanan Menu | Pelanggan & Kasir | Lisan & Nota Kertas | Antrean fisik menumpuk di booth; pencatatan manual butuh waktu lebih lama |
| 2 | Pembayaran Transaksi | Pelanggan & Kasir | Uang Tunai & Kalkulator | Terbatas pada pembayaran tunai; berpotensi salah hitung uang kembalian |
| 3 | Penerusan Pesanan ke Dapur | Kasir ke Barista | Lembaran Nota Kertas | Kertas nota rentan hilang, basah, atau urutannya tidak beraturan di meja racik |
| 4 | Pembuatan Minuman | Barista | Peralatan Bar & Kertas Nota | Tulisan nota berpotensi sulit dibaca sehingga memicu risiko salah racik |
| 5 | Penyerahan Minuman | Barista ke Pelanggan | Pemanggilan Lisan | Panggilan nama berpotensi tidak terdengar jelas di suasana pameran yang ramai |
| 6 | Pemantauan Bahan Baku | Barista & Owner | Pemeriksaan Visual | Pengelolaan stok visual berpotensi menyebabkan bahan habis tanpa peringatan |
| 7 | Pembukuan & Laporan Kas | Kasir & Owner | Buku Kas Manual | Rekapitulasi memakan waktu; berpotensi terjadi selisih kas fisik; minim analitik |

---

## 6. Kesimpulan Kebutuhan Perubahan

Berdasarkan evaluasi terhadap seluruh alur operasional di atas, dapat disimpulkan bahwa **sistem manual berbasis kertas memiliki keterbatasan dalam mendukung peningkatan volume transaksi dan kebutuhan pengelolaan data Theodore Coffee**.

Dibutuhkan sebuah sistem informasi berbasis website yang mampu mendigitalisasi proses pemesanan (online dan offline), menyediakan opsi pembayaran non-tunai (QRIS) di samping tunai, mengotomatisasi antrean produksi dengan prioritas FIFO, mengintegrasikan pengurangan stok bahan baku berdasarkan resep menu, serta menyediakan laporan analitik keuangan yang terstruktur secara realtime.
