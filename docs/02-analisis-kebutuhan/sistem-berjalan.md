# 04 Sistem Berjalan

## 1. Gambaran Umum

Sistem berjalan merupakan gambaran mengenai tata kelola dan prosedur operasional Theodore Coffee yang berlangsung saat ini sebelum diterapkannya sistem informasi berbasis website. 

Saat ini, Theodore Coffee beroperasi dalam bentuk **booth minuman kecil pada kegiatan dan pameran sekolah di lingkungan pesantren**. Seluruh aktivitas pelayanan—mulai dari penerimaan pesanan, pembayaran, pembuatan minuman, hingga pencatatan pembukuan—masih dilakukan secara konvensional (manual) menggunakan komunikasi lisan dan pencatatan pada lembaran kertas nota fisik.

Meskipun sistem manual ini dapat berjalan pada kondisi transaksi yang sedikit, berbagai hambatan dan potensi kesalahan mulai muncul ketika volume pesanan meningkat pada jam-jam ramai pameran.

---

## 2. Prosedur Operasional Manual

Prosedur operasional yang berjalan saat ini terbagi ke dalam lima tahapan aktivitas utama:

### 2.1 Prosedur Pemesanan Menu
1. Pelanggan mendatangi booth Theodore Coffee secara langsung.
2. Pelanggan melihat papan menu fisik yang terpasang di area booth.
3. Pelanggan menyampaikan pesanan minuman dan preferensi rasa (tingkat gula, es, atau metode seduh) secara lisan kepada Kasir.
4. Kasir menuliskan nama pelanggan, daftar pesanan, jumlah, dan kustomisasi rasa pada sobekan kertas nota manual.

### 2.2 Prosedur Pembayaran
1. Kasir menghitung total tagihan secara manual atau menggunakan kalkulator genggam.
2. Kasir menginformasikan nominal pembayaran kepada pelanggan.
3. Pelanggan melakukan pembayaran secara tunai (*cash*).
4. Kasir menerima uang, menyimpan ke laci kas, dan memberikan uang kembalian jika nominal pembayaran melebihi total belanja.
5. Kasir menyerahkan satu salinan kertas nota pesanan kepada Barista, sedangkan pelanggan menunggu di sekitar area booth.

### 2.3 Prosedur Pembuatan dan Penyerahan Minuman
1. Barista membaca rincian pesanan pada kertas nota fisik yang diletakkan di meja racik.
2. Barista meracik minuman sesuai dengan kustomisasi yang tertulis pada nota.
3. Setelah minuman selesai dibuat, Barista memanggil nama pelanggan secara lisan dengan suara lantang ke arah kerumunan pengunjung booth.
4. Pelanggan mendekati booth untuk mengambil minuman, dan lembaran kertas nota pesanan dibuang atau ditusuk pada paku nota sebagai tanda selesai.

### 2.4 Prosedur Pengelolaan Bahan Baku dan Stok
1. Pengelolaan stok bahan baku (biji kopi, susu cair, sirup, gula, dan cup) tidak memiliki standar pencatatan khusus.
2. Barista dan tim pengelola hanya mengandalkan pengecekan visual (melihat sisa fisik bahan pada toples, botol, atau kardus penyimpanan).
3. Tidak ada perhitungan otomatis terkait jumlah bahan yang terpakai untuk setiap cup minuman yang terjual.
4. Peringatan kehabisan bahan hanya diketahui saat bahan tersebut benar-benar habis di meja racik ketika pesanan sedang diproses.

### 2.5 Prosedur Rekapitulasi dan Pembukuan Harian
1. Pada akhir jam operasional booth (malam hari), Kasir mengumpulkan seluruh sisa nota kertas yang terkumpul.
2. Kasir menghitung total uang tunai fisik yang ada di dalam laci kas.
3. Kasir menuliskan rangkuman omzet dan pengeluaran harian ke dalam buku kas manual.
4. Hasil catatan buku kas diserahkan kepada pengelola/Owner untuk dievaluasi.

---

## 3. Diagram Alur Sistem Berjalan

Berikut adalah visualisasi alur operasional manual yang sedang berjalan di booth Theodore Coffee:

```text
PELANGGAN                      KASIR                       BARISTA
    │                            │                            │
    ├─ 1. Datang ke booth ──────>│                            │
    ├─ 2. Pesan menu lisan ─────>│                            │
    │                            ├─ 3. Catat di nota kertas   │
    │                            ├─ 4. Hitung total biaya     │
    │<─ 5. Info tagihan ─────────┤                            │
    ├─ 6. Bayar tunai (Cash) ───>│                            │
    │<─ 7. Terima kembalian ─────┤                            │
    │                            ├─ 8. Serahkan nota kertas ─>│
    │                            │                            ├─ 9. Baca nota & racik
    │                            │                            ├─ 10. Minuman selesai
    │<─ 11. Panggil nama lisan ───────────────────────────────┤
    ├─ 12. Ambil minuman ────────────────────────────────────>│
    │                            │                            │
```

---

## 4. Analisis Masalah per Pihak (Pain Points)

Berdasarkan hasil pengamatan pada alur kerja manual di atas, ditemukan sejumlah kelemahan dan kendala yang dirasakan oleh masing-masing pihak:

### 4.1 Dari Sisi Pelanggan
1. **Waktu Tunggu yang Melelahkan:** Pelanggan harus berdiri mengantre di depan booth, baik saat memesan maupun saat menunggu minuman selesai dibuat.
2. **Status Pesanan Tidak Transparan:** Pelanggan tidak mengetahui urutan antrean mereka dan tidak memiliki kepastian kapan minumannya akan selesai.
3. **Keterbatasan Metode Pembayaran:** Pelanggan hanya dapat membayar menggunakan uang tunai fisik (*cash*), yang merepotkan pelanggan yang tidak membawa uang pas di lingkungan pameran.
4. **Kenyamanan Terganggu:** Pemanggilan nama secara lisan rawan tidak terdengar apabila suasana pameran sekolah sedang sangat bising atau padat.

### 4.2 Dari Sisi Kasir
1. **Beban Menulis Manual di Jam Sibuk:** Kasir harus menulis tangan setiap pesanan dengan cepat, yang berpotensi menghasilkan tulisan cakar ayam yang sulit dibaca.
2. **Risiko Salah Hitung Uang Kembalian:** Dalam kondisi antrean panjang dan terburu-buru, penghitungan uang kembalian secara manual rawan terjadi kekeliruan (*human error*).
3. **Pengelolaan Antrean yang Berantakan:** Lembaran nota fisik rentan terselip, tertukar urutannya, basah terkena tumpahan air, atau bahkan hilang tertiup angin.

### 4.3 Dari Sisi Barista
1. **Risiko Salah Racik Kustomisasi:** Barista kerap mengalami kesulitan membaca tulisan tangan kasir mengenai detail tingkat gula (*sugar level*), es (*ice level*), atau metode seduh, sehingga minuman yang dibuat tidak sesuai permintaan pelanggan.
2. **Bahan Baku Habis Mendadak (*Stockout*):** Ketiadaan sistem peringatan stok membuat Barista sering kehabisan susu atau biji kopi di tengah jam operasional sibuk, yang memaksa pesanan dibatalkan atau pelanggan menunggu lama karena tim harus membeli bahan tambahan.
3. **Komunikasi Antrean yang Kurang Teratur:** Barista hanya mengandalkan tumpukan kertas nota fisik tanpa adanya indikator antrean prioritas yang baku.

### 4.4 Dari Sisi Admin/Owner
1. **Tidak Ada Pemantauan Stok Riil:** Owner tidak mengetahui secara pasti sisa stok bahan baku yang tersedia di booth tanpa harus datang dan memeriksa langsung secara fisik.
2. **Rekapitulasi Keuangan Rentan Selisih:** Perhitungan manual antara jumlah nota kertas dengan uang fisik di laci kas sering kali mengalami selisih (kurang bayar atau uang hilang tanpa terdeteksi).
3. **Ketiadaan Data Analitik Penjualan:** Owner tidak memiliki data mengenai menu apa yang paling laris, jam-jam paling sibuk, maupun tren penjualan untuk dasar perencanaan pameran berikutnya.
4. **Potensi Kerugian Finansial:** Ketiadaan pencatatan bahan baku yang terhubung dengan penjualan produk membuka celah pemborosan bahan dan kerugian usaha.

---

## 5. Tabel Ringkasan Aktivitas Manual dan Permasalahannya

| No | Aktivitas Operasional | Pelaksana | Media / Alat | Permasalahan Utama |
|---|---|---|---|---|
| 1 | Pemesanan Menu | Pelanggan & Kasir | Lisan & Nota Kertas | Antrean menumpuk fisik di booth; kasir lelah menulis nota cepat |
| 2 | Pembayaran Transaksi | Pelanggan & Kasir | Uang Tunai & Kalkulator | Terbatas pada cash; risiko salah hitung kembalian dan uang selisih |
| 3 | Penerusan Pesanan ke Dapur | Kasir ke Barista | Kertas Nota Fisik | Nota rawan hilang, basah, atau urutannya tertukar di meja racik |
| 4 | Pembuatan Minuman | Barista | Peralatan Bar & Kertas Nota | Rawan salah tingkat gula/es akibat tulisan nota sulit dibaca |
| 5 | Penyerahan Minuman | Barista ke Pelanggan | Panggilan Lisan | Suara panggilan sering tidak terdengar saat suasana pameran bising |
| 6 | Pemantauan Bahan Baku | Barista & Owner | Cek Visual (Kasat Mata) | Stok bahan sering habis mendadak di jam sibuk tanpa peringatan dini |
| 7 | Pembukuan & Laporan Kas | Kasir & Owner | Buku Kas Manual | Memakan waktu lama di malam hari; rawan selisih uang; data penjualan minim |

---

## 6. Kesimpulan Kebutuhan Perubahan

Berdasarkan evaluasi terhadap seluruh alur operasional di atas, dapat disimpulkan bahwa **sistem manual berbasis kertas tidak lagi memadai** untuk mendukung pertumbuhan Theodore Coffee. 

Dibutuhkan sebuah sistem informasi berbasis website yang mampu mendigitalisasi proses pemesanan (online & offline), menyediakan pembayaran non-tunai (QRIS), mengotomatisasi antrean produksi (FIFO), mengintegrasikan pengurangan stok bahan baku berdasarkan resep menu, serta menyediakan laporan analitik keuangan secara realtime.
