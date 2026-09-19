# 03 Kebutuhan Non Fungsional

## 1. Keamanan

Keamanan merupakan aspek penting dalam Sistem Informasi Theodore Coffee untuk melindungi data pengguna, transaksi, pembayaran, stok, serta data operasional dari akses atau perubahan yang tidak sah.

### 1.1 Keamanan Password

* Password pengguna internal minimal terdiri dari 8 karakter.
* Password tidak boleh disimpan dalam bentuk teks biasa.
* Password harus disimpan menggunakan metode hashing yang aman.
* Password tidak boleh dicatat ke dalam log aktivitas maupun log error.

### 1.2 Perlindungan Login

* Sistem tidak menerapkan batas maksimum tetap terhadap jumlah percobaan login gagal.
* Sistem tidak melakukan penguncian akun secara otomatis hanya berdasarkan jumlah kegagalan login.
* Sistem dapat menerapkan rate limiting atau penundaan terhadap percobaan login yang terindikasi mencurigakan.
* Aktivitas login berhasil dan login gagal harus dicatat dalam log.

### 1.3 Session dan Logout

* Setiap pengguna internal harus melakukan login untuk mengakses fitur yang membutuhkan autentikasi.
* Sistem menyediakan tombol logout.
* Sistem tidak melakukan logout otomatis hanya karena pengguna tidak aktif selama periode tertentu.
* Session harus dilindungi agar tidak mudah digunakan oleh pihak yang tidak berwenang.

### 1.4 Hak Akses Berdasarkan Role

Sistem menerapkan pembatasan akses berdasarkan role pengguna.

Role V1 terdiri dari:

* Admin/Owner
* Cashier
* Barista/Dapur

Setiap role hanya dapat mengakses fitur yang sesuai dengan kewenangannya.

Apabila pengguna mencoba mengakses fitur yang tidak memiliki izin, sistem menampilkan:

> **403 Tidak Diizinkan**

### 1.5 Perlindungan Halaman Internal

* Halaman internal seperti Dashboard, Cashier, Barista, dan Admin/Owner harus membutuhkan autentikasi.
* Pengguna yang belum login tidak dapat mengakses halaman internal.
* Pengguna yang belum login akan diarahkan ke halaman login.
* Akses langsung melalui URL tetap harus diperiksa oleh sistem.

### 1.6 Perlindungan Data Customer

Customer tidak memiliki akun pada V1.

Customer hanya mengisi nama pada saat melakukan pemesanan dan sistem menghasilkan kode pesanan unik.

* Customer hanya dapat melihat pesanan yang berkaitan dengan kode pesanannya.
* Customer tidak dapat melihat pesanan customer lain.
* Kode pesanan harus unik dan dibuat sedemikian rupa agar tidak mudah ditebak.
* Mekanisme perlindungan akses kode pesanan akan diterapkan pada tahap perancangan teknis.

### 1.7 Perlindungan Data Sensitif

* Data sensitif hanya boleh disimpan apabila diperlukan oleh sistem.
* Data sensitif harus dilindungi melalui keamanan database dan mekanisme akses yang sesuai.
* Password, secret key, token, dan credential tidak boleh disimpan dalam log.
* Informasi sensitif tidak boleh ditampilkan kepada pengguna yang tidak memiliki hak akses.

### 1.8 Perlindungan API dan Input

* API harus melakukan autentikasi dan authorization sesuai kebutuhan.
* Setiap input dari pengguna harus divalidasi sebelum diproses.
* Sistem harus mencegah manipulasi data melalui request secara langsung.
* Data penting seperti harga, subtotal, total, stok, dan status pembayaran tidak boleh hanya dipercayakan kepada sisi client.

### 1.9 Validasi Server

Server menjadi sumber kebenaran untuk data penting.

Sistem harus melakukan validasi dan perhitungan ulang pada server sebelum data disimpan, termasuk:

* Harga produk.
* Jumlah produk.
* Customization.
* Add-on.
* Subtotal.
* Discount jika digunakan.
* Tax jika digunakan.
* Total transaksi.
* Ketersediaan stok.
* Status pembayaran.

### 1.10 Perlindungan Transaksi dan Pembayaran

* Status pembayaran tidak boleh ditentukan hanya berdasarkan informasi dari Customer.
* Customer tidak memiliki tombol **SAYA SUDAH BAYAR**.
* Pembayaran QRIS harus diverifikasi melalui mekanisme pembayaran yang digunakan, yaitu Midtrans.
* Pembayaran yang belum terverifikasi tidak boleh dianggap sebagai `DIBAYAR`.
* Sistem harus mencegah pembayaran atau transaksi diproses lebih dari satu kali.
* Proses pembayaran yang statusnya belum pasti harus tetap berada pada status yang sesuai sampai dapat diverifikasi.

### 1.11 Perlindungan Duplikasi Pesanan

Sistem harus mencegah terjadinya pesanan atau transaksi ganda akibat:

* Tombol ditekan berulang kali.
* Request dikirim lebih dari satu kali.
* Gangguan koneksi.
* Pengulangan callback/webhook pembayaran.
* Proses recovery setelah gangguan sistem.

Pesanan atau transaksi yang sudah berhasil diproses tidak boleh dibuat kembali sebagai transaksi baru tanpa alasan yang sah.

### 1.12 Keamanan Perubahan Data

Perubahan data penting harus dibatasi berdasarkan role dan kewenangan.

Data yang harus dilindungi antara lain:

* Produk dan harga.
* Resep.
* Bahan dan stok.
* Pesanan.
* Pembayaran.
* Refund.
* User dan role.
* Pengaturan sistem.

Perubahan penting harus dapat diketahui melalui audit log.

### 1.13 Audit Log

Aktivitas penting harus dicatat dalam audit log, termasuk:

* Login.
* Logout.
* Perubahan produk.
* Perubahan harga.
* Perubahan stok.
* Perubahan resep.
* Perubahan pesanan.
* Pembatalan.
* Konfirmasi pembayaran.
* Refund.
* Perubahan user dan role.
* Perubahan settings.
* Export data.
* Generate/reprint receipt.

Audit log tidak boleh dapat diubah atau dihapus melalui aplikasi oleh pengguna.

### 1.14 Konfirmasi Tindakan Penting

Sistem harus meminta konfirmasi sebelum tindakan yang berisiko atau sulit dibatalkan, seperti:

* Menghapus data.
* Membatalkan pesanan.
* Melakukan refund.
* Mengubah data penting.
* Melakukan restore backup.
* Melakukan tindakan administratif lainnya yang berisiko.

### 1.15 Soft Delete dan Pemulihan

Untuk data yang membutuhkan riwayat atau kemungkinan pemulihan, sistem menggunakan mekanisme soft delete apabila sesuai.

Data yang telah dinonaktifkan atau dihapus secara soft delete tidak langsung dihilangkan secara permanen sehingga dapat dipulihkan oleh pihak yang memiliki kewenangan.

### 1.16 HTTPS dan Perlindungan Komunikasi

Komunikasi antara pengguna dengan sistem harus menggunakan koneksi yang aman melalui HTTPS/TLS.

Data yang dikirim antara browser, aplikasi, database, dan layanan eksternal harus menggunakan mekanisme komunikasi yang aman.

### 1.17 Perlindungan Error

* Customer tidak boleh melihat detail teknis seperti error database, API, webhook, atau stack trace.
* Customer hanya menerima pesan error yang sederhana dan mudah dipahami.
* Detail error teknis dicatat pada log untuk kebutuhan pemeriksaan.
* Sistem tidak boleh menampilkan pesan sukses apabila proses sebenarnya belum berhasil.

### 1.18 Pemisahan Secret dan Credential

Secret dan credential seperti:

* Database credential.
* Midtrans Server Key.
* API key.
* Secret key.
* Token.

tidak boleh ditulis langsung ke source code.

Informasi tersebut harus dikelola melalui konfigurasi/secret environment yang sesuai.

### 1.19 Keamanan Database

Akses langsung terhadap database dan data internal harus dibatasi berdasarkan kewenangan.

Data seperti:

* Transaksi.
* Pembayaran.
* Stok.
* Audit log.
* User.
* Pengaturan sistem.

tidak boleh dapat diakses atau dimanipulasi oleh Customer atau role yang tidak memiliki kewenangan.

### 1.20 Tujuan Keamanan

Penerapan keamanan bertujuan untuk:

1. Melindungi data sistem.
2. Mencegah akses tanpa izin.
3. Mencegah manipulasi transaksi.
4. Melindungi data pembayaran.
5. Menjaga integritas stok dan transaksi.
6. Menjaga riwayat aktivitas sistem.
7. Membatasi akses berdasarkan kewenangan pengguna.
8. Membantu mendeteksi dan menangani aktivitas atau error yang mencurigakan.
## 2. Performa

Performa merupakan kemampuan Sistem Informasi Theodore Coffee dalam menjalankan proses dan memberikan respons kepada pengguna secara cepat, stabil, dan efisien.

### 2.1 Waktu Respons

* Operasi normal sistem ditargetkan memberikan respons maksimal sekitar **1 detik**.
* Target tersebut berlaku untuk proses internal sistem yang normal.
* Proses yang bergantung pada layanan eksternal, seperti Midtrans, tidak memiliki jaminan waktu respons 1 detik karena bergantung pada layanan tersebut.

### 2.2 Penggunaan Bersamaan

* Sistem tidak menetapkan batas maksimum tetap untuk jumlah pengguna aktif secara bersamaan pada V1.
* Sistem harus tetap dapat menangani penggunaan secara bersamaan sesuai kemampuan infrastruktur yang digunakan.
* Infrastruktur dapat ditingkatkan apabila jumlah pengguna dan beban sistem bertambah.

### 2.3 Pengelolaan Query

* Query database harus dibuat secara efisien sesuai kebutuhan sistem.
* Optimasi query dilakukan pada tahap implementasi apabila ditemukan proses yang menyebabkan penurunan performa.
* Tidak ditetapkan batas jumlah query tertentu pada V1.

### 2.4 Ukuran Gambar Produk

* Ukuran gambar produk maksimal **2 MB per file**.
* Format gambar harus sesuai untuk penggunaan pada website.
* Gambar harus dioptimalkan agar tidak memberikan beban yang tidak diperlukan terhadap halaman.

### 2.5 Pengelolaan Data Besar

Untuk data yang jumlahnya besar, sistem menggunakan mekanisme:

* Pagination.
* Pencarian.
* Filter.
* Pengurutan data.

Data terbaru ditampilkan terlebih dahulu pada halaman yang relevan.

### 2.6 Cache

* Sistem dapat menggunakan cache apabila diperlukan untuk meningkatkan performa.
* Supabase tetap menjadi sumber data utama.
* Data yang membutuhkan informasi terbaru seperti stok, pembayaran, dan status pesanan tidak boleh menggunakan cache yang menyebabkan informasi menjadi tidak sesuai dengan kondisi sebenarnya.

### 2.7 Efisiensi Penggunaan Internet

Sistem harus dirancang agar penggunaan jaringan tetap efisien, terutama pada perangkat mobile.

Hal yang diperhatikan meliputi:

* Ukuran asset.
* Ukuran gambar.
* Jumlah request.
* Pengambilan data yang diperlukan saja.
* Penggunaan realtime secara efisien.

### 2.8 Efisiensi Resource

Sistem harus menggunakan resource secara efisien agar sesuai dengan infrastruktur yang digunakan, terutama karena sistem dirancang menggunakan layanan dengan biaya rendah atau gratis pada tahap awal.

Resource yang diperhatikan meliputi:

* CPU.
* Memory.
* Database.
* Storage.
* Bandwidth.

### 2.9 Responsif pada Antarmuka

Antarmuka sistem harus memberikan respons yang cepat dan terasa responsif ketika pengguna:

* Membuka halaman.
* Mengirim form.
* Mengubah jumlah pesanan.
* Mengubah customization.
* Melakukan checkout.
* Melakukan proses transaksi.
* Mengakses data.

### 2.10 Responsive Design

Sistem harus tetap memiliki performa dan tampilan yang baik pada:

* Smartphone.
* Tablet.
* Desktop/laptop.

### 2.11 Realtime

Fitur realtime harus memberikan pembaruan data tanpa pengguna melakukan refresh halaman secara manual.

Realtime digunakan pada proses penting seperti:

* Perubahan status pesanan.
* Pesanan baru.
* Perubahan status produksi.
* Perubahan ketersediaan produk/stok.
* Status pembayaran yang telah terverifikasi.
* Informasi gangguan sistem.

Jika koneksi terputus, sistem harus dapat melakukan sinkronisasi kembali setelah koneksi tersedia.

### 2.12 Penanganan Error

Apabila terjadi masalah dalam proses, sistem harus:

* Memberikan feedback yang jelas.
* Tidak menampilkan error teknis mentah kepada Customer.
* Tidak memberikan informasi sukses palsu.
* Mencegah transaksi atau pesanan ganda.
* Melakukan percobaan ulang apabila memungkinkan dan aman.
* Mencatat error penting ke dalam log.

### 2.13 Gangguan Pembayaran

Apabila terjadi ketidakpastian pada proses pembayaran:

* Sistem tidak langsung menganggap pembayaran berhasil.
* Status pembayaran harus diverifikasi melalui Midtrans.
* Sistem melakukan pemeriksaan ulang apabila diperlukan.
* Transaksi yang belum dapat dipastikan tetap berada pada status yang sesuai.
* Sistem mencegah pembayaran diproses dua kali.

### 2.14 Skalabilitas Data

Sistem harus tetap dapat menangani pertumbuhan:

* Produk.
* Bahan.
* Resep.
* Pesanan.
* Transaksi.
* User internal.
* Riwayat aktivitas.
* Laporan.

Tidak ditetapkan batas maksimum jumlah transaksi untuk V1.

### 2.15 Pertumbuhan Sistem

Sistem harus dirancang agar pertumbuhan jumlah data dan pengguna tidak langsung membutuhkan pembangunan ulang sistem.

Apabila kapasitas infrastruktur sudah tidak mencukupi, kapasitas dapat ditingkatkan sesuai kebutuhan.

### 2.16 Tujuan Performa

Penerapan kebutuhan performa bertujuan untuk:

1. Memberikan pengalaman penggunaan yang cepat.
2. Mengurangi waktu tunggu pengguna.
3. Mengurangi penggunaan resource yang tidak diperlukan.
4. Menjaga sistem tetap responsif.
5. Mencegah kesalahan akibat proses yang terlalu lambat.
6. Menjaga transaksi dan status pesanan tetap akurat.
7. Memastikan sistem tetap dapat berkembang sesuai pertumbuhan Theodore Coffee.
## 3. Ketersediaan

Ketersediaan merupakan kemampuan Sistem Informasi Theodore Coffee untuk tetap dapat digunakan ketika dibutuhkan, meminimalkan downtime, serta memulihkan layanan dan data setelah terjadi gangguan.

### 3.1 Ketersediaan Sistem

* Sistem dirancang agar dapat diakses selama **24 jam sehari dan 7 hari dalam seminggu (24/7)**.
* Sistem berusaha meminimalkan downtime.
* Sistem tidak menjamin uptime 100% karena ketersediaan dapat dipengaruhi oleh infrastruktur dan layanan eksternal.

### 3.2 Maintenance

Apabila sistem sedang dalam proses maintenance:

* Customer tidak dapat membuat pesanan baru.
* Sistem menampilkan halaman maintenance.
* Informasi perkiraan waktu selesai ditampilkan apabila tersedia.
* Data yang sudah tersimpan tetap dipertahankan.
* Aktivitas maintenance dicatat dalam log.

### 3.3 Gangguan Layanan Eksternal

Apabila layanan eksternal yang dibutuhkan sistem mengalami gangguan:

* Sistem memberikan informasi bahwa layanan sedang tidak tersedia.
* Proses yang belum terkonfirmasi tidak dianggap berhasil.
* Status pembayaran atau pesanan harus diverifikasi sebelum dianggap berhasil.
* Gangguan dicatat dalam log.
* Sistem tidak boleh membuat data transaksi ganda akibat gangguan.

### 3.4 Pemulihan Gangguan

Setelah terjadi gangguan:

* Sistem berusaha melakukan pemulihan secara otomatis apabila memungkinkan.
* Pemulihan normal tidak memerlukan tindakan manual dari pengguna.
* Status pesanan dan transaksi diverifikasi kembali setelah sistem pulih.
* Data yang tidak dapat dipastikan statusnya ditandai untuk pemeriksaan.
* Proses recovery dicatat dalam log.

### 3.5 Deteksi Gangguan

Sistem harus dapat mendeteksi gangguan penting pada layanan dan memberikan informasi kepada Admin/Owner.

Gangguan yang terdeteksi dapat meliputi:

* Gangguan aplikasi.
* Gangguan database/Supabase.
* Gangguan pembayaran/Midtrans.
* Gangguan layanan infrastruktur.
* Gangguan proses otomatis penting.

Setiap gangguan penting dicatat dalam log.

### 3.6 Monitoring Status Sistem

Admin/Owner memiliki halaman monitoring untuk melihat kondisi layanan penting, seperti:

* Status aplikasi.
* Status database/Supabase.
* Status pembayaran/Midtrans.
* Status infrastruktur.
* Gangguan yang sedang berlangsung.
* Riwayat gangguan.
* Waktu mulai dan selesai gangguan apabila tersedia.

### 3.7 Informasi Gangguan kepada Customer

Apabila gangguan memengaruhi penggunaan website:

* Customer mendapatkan informasi yang jelas mengenai gangguan.
* Fitur pemesanan dinonaktifkan apabila diperlukan.
* Pesanan yang sudah tersimpan tetap dipertahankan.
* Detail teknis atau informasi sensitif mengenai gangguan tidak ditampilkan kepada Customer.

### 3.8 Pencegahan Pesanan Saat Sistem Bermasalah

Jika layanan penting yang dibutuhkan untuk proses pemesanan mengalami gangguan:

* Sistem dapat secara otomatis menonaktifkan pemesanan dan checkout.
* Customer tidak dapat membuat pesanan baru sampai sistem kembali siap.
* Data pesanan yang sudah tersimpan tidak dihapus.

### 3.9 Gangguan Sebagian

Pada V1, apabila salah satu layanan penting seperti Midtrans mengalami gangguan yang memengaruhi proses pemesanan:

* Website dapat dinonaktifkan sementara untuk mencegah pesanan baru.
* Customer tidak dapat melakukan pemesanan selama gangguan.
* Data yang sudah tersimpan tetap dipertahankan.
* Admin/Owner mendapatkan informasi mengenai gangguan apabila memungkinkan.

### 3.10 Pemeriksaan Sebelum Sistem Dibuka Kembali

Sebelum fitur pemesanan kembali diaktifkan, sistem melakukan pemeriksaan otomatis terhadap layanan penting.

Pemeriksaan dapat mencakup:

* Ketersediaan aplikasi.
* Koneksi database.
* Layanan pembayaran.
* Status proses penting.
* Ketersediaan stok.

Pemesanan hanya dapat dibuka kembali apabila sistem dinyatakan siap.

### 3.11 Pemulihan Status Pesanan

Setelah sistem pulih:

* Sistem memeriksa data pesanan yang tersimpan.
* Sistem memeriksa status pembayaran melalui Midtrans apabila berkaitan dengan pembayaran.
* Sistem tidak menebak status transaksi.
* Transaksi dengan status tidak pasti ditandai untuk pemeriksaan.
* Sistem mencegah pembuatan pesanan atau transaksi duplikat.
* Proses pemulihan dicatat dalam log.

### 3.12 Pemeriksaan Stok Setelah Gangguan

Sebelum pemesanan kembali dibuka setelah gangguan:

* Sistem melakukan pemeriksaan ulang stok bahan.
* Ketersediaan produk diperbarui berdasarkan kondisi stok terbaru.
* Produk yang tidak memenuhi kebutuhan stok tidak dapat dijual.

### 3.13 Pencegahan Duplikasi Setelah Recovery

Setelah sistem mengalami gangguan atau recovery:

* Sistem memeriksa request yang mungkin diproses lebih dari satu kali.
* Sistem mencegah transaksi atau pembayaran ganda.
* Request yang mencurigakan dicatat dalam log.
* Data yang sudah berhasil diproses tidak diproses kembali sebagai transaksi baru.

### 3.14 Notifikasi Sistem Kembali Normal

Apabila sistem telah kembali normal setelah mengalami gangguan:

* Admin/Owner mendapatkan notifikasi bahwa layanan telah kembali normal.
* Waktu pemulihan dicatat.
* Status gangguan diperbarui menjadi normal.
* Riwayat gangguan tetap disimpan.

### 3.15 Tujuan Ketersediaan

Penerapan kebutuhan ketersediaan bertujuan untuk:

1. Menjaga sistem tetap dapat digunakan ketika dibutuhkan.
2. Meminimalkan downtime.
3. Mencegah pesanan dan transaksi saat layanan penting bermasalah.
4. Menjaga data tetap aman selama gangguan.
5. Memulihkan sistem secara aman setelah gangguan.
6. Mencegah duplikasi pesanan dan transaksi.
7. Memberikan informasi gangguan yang jelas kepada pengguna.
## 4. Realtime

Realtime merupakan kemampuan sistem untuk memperbarui informasi secara langsung tanpa pengguna harus melakukan refresh halaman secara manual.

### 4.1 Status Pesanan

* Perubahan status pesanan harus diperbarui secara realtime.
* Customer, Cashier, dan Barista/Dapur dapat menerima perubahan status sesuai hak akses masing-masing.
* Pengguna tidak perlu melakukan refresh halaman secara manual.
* Data yang ditampilkan harus berdasarkan data terbaru yang tersimpan pada sistem.
* Setelah koneksi kembali tersedia, sistem harus melakukan sinkronisasi ulang.

### 4.2 Pesanan Baru ke Barista

Ketika Cashier menerima pesanan dan memasukkannya ke proses produksi:

* Pesanan baru muncul pada halaman Barista secara realtime.
* Barista mendapatkan notifikasi pesanan baru.
* Pesanan tidak boleh muncul sebagai pesanan ganda.
* Apabila terjadi gangguan koneksi, sistem melakukan sinkronisasi kembali setelah koneksi tersedia.

### 4.3 Pesanan Selesai

Ketika Barista menekan **PESANAN SELESAI**:

* Status pesanan berubah menjadi `SELESAI`.
* Customer menerima perubahan status secara realtime.
* Customer mendapatkan informasi bahwa pesanan selesai dan siap diambil.
* Cashier menerima pembaruan status secara realtime.
* Pesanan keluar dari daftar pesanan aktif dan masuk ke riwayat.

### 4.4 Perubahan Pesanan oleh Cashier

Jika Cashier melakukan perubahan terhadap pesanan sebelum pesanan mulai dibuat:

* Perubahan dikirim ke halaman Barista secara realtime.
* Barista tidak perlu melakukan refresh.
* Perubahan tidak boleh menimpa data terbaru secara tidak sengaja.
* Setelah status menjadi `SEDANG DIBUAT`, pesanan tidak dapat diedit lagi.
* Sistem harus mencegah konflik akibat data lama yang masih terbuka pada perangkat lain.

### 4.5 Perubahan Stok dan Ketersediaan Produk

Perubahan stok atau ketersediaan produk dapat diperbarui secara realtime kepada Customer.

* Produk yang menjadi tidak tersedia dapat berubah status tanpa refresh manual.
* Sistem tetap melakukan pemeriksaan stok ketika Customer memilih produk dan ketika checkout.
* Data realtime tidak menggantikan validasi server.

### 4.6 Pesanan Online ke Cashier

Ketika Customer membuat pesanan online:

* Pesanan baru muncul pada halaman Cashier secara realtime.
* Cashier mendapatkan notifikasi adanya pesanan baru.
* Realtime tidak secara otomatis mengubah status pesanan.
* Cashier tetap harus melakukan proses **TERIMA** atau **TOLAK** sesuai alur sistem.

### 4.7 Status Pembayaran

Status pembayaran QRIS/Midtrans harus diperbarui setelah pembayaran mendapatkan konfirmasi yang valid.

* Sistem menerima informasi pembayaran melalui mekanisme Midtrans.
* Status `DIBAYAR` hanya diberikan setelah pembayaran terverifikasi.
* Customer dan Cashier menerima pembaruan status secara realtime.
* Sistem mencegah pembayaran yang sama diproses lebih dari satu kali.
* Pembayaran yang belum terverifikasi tidak boleh dianggap berhasil.

### 4.8 Status Gangguan Sistem

Halaman monitoring Admin/Owner harus dapat menerima perubahan status sistem secara realtime.

Perubahan dapat meliputi:

* Sistem normal → gangguan.
* Gangguan → normal.
* Layanan tersedia → tidak tersedia.
* Layanan tidak tersedia → tersedia.

Setiap kejadian penting tetap dicatat dalam log meskipun informasi monitoring ditampilkan secara realtime.

### 4.9 Penanganan Koneksi Terputus

Apabila koneksi pengguna terputus:

* Sistem tidak boleh menganggap data terbaru sudah diterima jika belum terkonfirmasi.
* Setelah koneksi kembali, sistem melakukan sinkronisasi dengan data terbaru.
* Sistem mencegah duplikasi akibat reconnect.
* Status transaksi dan pesanan harus tetap mengikuti data yang tersimpan di server.

### 4.10 Tujuan Realtime

Penerapan realtime bertujuan untuk:

1. Mempercepat penyampaian informasi antar pengguna.
2. Mengurangi kebutuhan refresh manual.
3. Mempercepat proses pelayanan.
4. Menjaga Customer mengetahui status pesanan terbaru.
5. Membantu Cashier dan Barista menerima perubahan pesanan dengan cepat.
6. Menjaga informasi pembayaran dan stok tetap terkini.

## 5. Usability

Usability merupakan kemampuan Sistem Informasi Theodore Coffee untuk memberikan pengalaman penggunaan yang mudah dipahami, sederhana, konsisten, dan nyaman bagi pengguna sesuai dengan role masing-masing.

### 5.1 Kemudahan Penggunaan

* Sistem harus mudah digunakan oleh pengguna baru.
* Navigasi harus jelas dan konsisten.
* Nama menu, tombol, dan fitur harus mudah dipahami.
* Setiap role hanya menampilkan fitur yang sesuai dengan kebutuhannya.

### 5.2 Responsive Interface

Antarmuka sistem harus dapat digunakan dengan baik pada:

* Smartphone.
* Tablet.
* Desktop/laptop.

Tampilan dan komponen antarmuka harus menyesuaikan ukuran layar perangkat.

### 5.3 Konsistensi Navigasi

* Struktur navigasi harus konsisten pada setiap halaman.
* Tombol dengan fungsi yang sama menggunakan istilah dan pola yang konsisten.
* Pengguna tidak dibuat berpindah halaman secara tidak diperlukan.
* Status dan tindakan penting harus ditempatkan pada lokasi yang mudah ditemukan.

### 5.4 Pesan Kesalahan

Apabila terjadi kesalahan:

* Sistem menampilkan pesan yang jelas dan mudah dipahami.
* Pesan tidak menggunakan istilah teknis yang sulit dipahami Customer.
* Customer tidak diperlihatkan detail error teknis.
* Pesan harus menjelaskan tindakan yang dapat dilakukan pengguna apabila memungkinkan.

### 5.5 Konfirmasi Tindakan Penting

Sistem harus memberikan konfirmasi sebelum tindakan penting atau berisiko dilakukan, seperti:

* Membatalkan pesanan.
* Menghapus data.
* Melakukan refund.
* Melakukan restore backup.
* Mengubah data penting.

### 5.6 Feedback Sistem

Sistem harus memberikan feedback ketika pengguna melakukan suatu tindakan.

Feedback dapat berupa:

* Loading.
* Progress.
* Pesan berhasil.
* Pesan gagal.
* Perubahan status.
* Notifikasi.

Tombol tidak boleh memungkinkan pengguna melakukan submit berulang kali ketika proses sebelumnya masih berjalan.

### 5.7 Form dan Validasi

* Setiap input memiliki label yang jelas.
* Field wajib dan opsional dapat dibedakan.
* Kesalahan input ditampilkan dengan jelas.
* Validasi dilakukan sebelum data diproses.
* Form tidak boleh meminta data yang tidak diperlukan.

### 5.8 Accessibility Dasar

Sistem menerapkan aksesibilitas dasar, antara lain:

* Teks mudah dibaca.
* Kontras antara teks dan latar cukup.
* Area tombol/interaksi cukup mudah ditekan.
* Form memiliki label yang jelas.
* Informasi tidak hanya dibedakan menggunakan warna.

### 5.9 Bahasa Sistem

* Sistem menggunakan Bahasa Indonesia yang sederhana dan konsisten.
* Istilah yang digunakan antar halaman dan role harus konsisten.
* Status pesanan menggunakan istilah yang telah ditetapkan pada sistem.
* Tombol menggunakan kata yang jelas dan menggambarkan tindakan yang dilakukan.

### 5.10 Indikator Status

Status sistem dan pesanan harus ditampilkan secara jelas dan konsisten.

* Status menggunakan teks yang mudah dipahami.
* Status dapat menggunakan indikator visual sebagai pendukung.
* Informasi status tidak boleh hanya bergantung pada warna.
* Penggunaan status harus konsisten pada Customer, Cashier, Barista/Dapur, dan Admin/Owner sesuai hak akses masing-masing.

### 5.11 Tujuan Usability

Penerapan kebutuhan usability bertujuan untuk:

1. Memudahkan pengguna baru memahami sistem.
2. Mempercepat proses pemesanan dan transaksi.
3. Mengurangi kesalahan penggunaan.
4. Memberikan informasi yang jelas kepada pengguna.
5. Membuat penggunaan sistem lebih nyaman.
6. Menjaga konsistensi pengalaman penggunaan pada seluruh bagian sistem.
 ## 6. Kompatibilitas

Kompatibilitas merupakan kemampuan Sistem Informasi Theodore Coffee untuk digunakan pada berbagai perangkat, sistem operasi, browser, serta layanan eksternal yang mendukung operasional sistem.

### 6.1 Browser

Sistem harus dapat digunakan pada browser modern yang masih mendapatkan dukungan, yaitu:

* Google Chrome.
* Microsoft Edge.
* Mozilla Firefox.
* Safari.

Sistem tidak diwajibkan mendukung browser versi lama yang sudah tidak mendapatkan dukungan.

### 6.2 Perangkat

Sistem harus dapat digunakan pada:

* Smartphone.
* Tablet.
* Desktop.
* Laptop.

### 6.3 Sistem Operasi

Sistem harus dapat digunakan melalui browser modern pada:

* Windows.
* macOS.
* Android.
* iOS.

### 6.4 Ukuran Layar

Antarmuka harus menyesuaikan berbagai ukuran dan resolusi layar sehingga fungsi utama tetap dapat digunakan dengan baik.

### 6.5 Koneksi Internet

* Fungsi utama sistem membutuhkan koneksi internet aktif.
* Pemesanan online, transaksi, realtime, pembayaran, dan sinkronisasi data membutuhkan koneksi ke server.
* Sistem tidak menetapkan mode offline penuh untuk Customer.

### 6.6 Integrasi Layanan

Sistem harus dapat berintegrasi dengan layanan yang digunakan dalam arsitektur Theodore Coffee, yaitu:

* Supabase sebagai database dan layanan backend yang diperlukan.
* Midtrans sebagai layanan pembayaran.
* Vercel sebagai platform deployment aplikasi.

Integrasi harus dapat digunakan selama layanan terkait tersedia dan mendukung kebutuhan sistem.

### 6.7 Browser Lama

* Sistem tidak memiliki kewajiban untuk mendukung browser lama atau browser yang sudah tidak mendapatkan pembaruan keamanan.
* Pengguna dianjurkan menggunakan browser modern yang masih didukung.

### 6.8 JavaScript

JavaScript harus aktif pada browser karena beberapa fungsi utama sistem bergantung pada JavaScript, termasuk:

* Interaksi antarmuka.
* Realtime.
* Checkout.
* Pemesanan.
* Pembayaran.
* Pembaruan data tanpa refresh manual.

### 6.9 QRIS

Sistem pembayaran QRIS melalui Midtrans harus dapat menampilkan QR Code kepada Customer.

Customer dapat melakukan pembayaran menggunakan perangkat atau aplikasi pembayaran yang mendukung QRIS.

### 6.10 Tujuan Kompatibilitas

Penerapan kebutuhan kompatibilitas bertujuan untuk:

1. Memastikan sistem dapat digunakan pada perangkat yang umum digunakan.
2. Mendukung browser modern.
3. Memastikan tampilan tetap berfungsi pada berbagai ukuran layar.
4. Mendukung sistem operasi yang umum digunakan.
5. Memastikan integrasi layanan utama dapat berjalan dengan baik.
6. Memberikan akses yang konsisten kepada pengguna sesuai perangkat yang digunakan.

## 7. Skalabilitas

Skalabilitas merupakan kemampuan Sistem Informasi Theodore Coffee untuk menangani pertumbuhan data, pengguna, transaksi, dan fitur seiring dengan perkembangan bisnis tanpa membutuhkan pembangunan ulang sistem secara keseluruhan.

### 7.1 Pertumbuhan Data

Sistem harus dapat menangani pertumbuhan data seperti:

* Produk.
* Kategori.
* Bahan dan stok.
* Resep.
* Pesanan.
* Transaksi.
* User internal.
* Aktivitas sistem.
* Laporan.

Pertumbuhan data tidak boleh menyebabkan sistem harus dibangun ulang dari awal.

### 7.2 Pertumbuhan Pengguna Internal

* Jumlah pengguna internal dapat bertambah sesuai kebutuhan bisnis.
* Role pengguna tetap mengikuti sistem yang telah ditentukan.
* Infrastruktur dapat ditingkatkan apabila jumlah pengguna meningkat dan kapasitas yang tersedia tidak lagi mencukupi.

### 7.3 Peningkatan Infrastruktur

Komponen infrastruktur seperti:

* Database.
* Hosting.
* Storage.
* Resource komputasi.
* Bandwidth.

harus dapat ditingkatkan sesuai kebutuhan pertumbuhan sistem.

### 7.4 Penambahan Fitur

Sistem harus memungkinkan penambahan fitur secara bertahap tanpa merusak fungsi yang sudah berjalan.

Pengembangan dapat dilakukan untuk versi berikutnya seperti V2, V3, dan seterusnya.

### 7.5 Kapasitas Transaksi

* V1 tidak menetapkan batas maksimum jumlah transaksi secara tetap.
* Sistem harus dirancang agar kapasitas transaksi dapat ditingkatkan sesuai kebutuhan.
* Apabila kapasitas infrastruktur tidak lagi mencukupi, infrastruktur dapat ditingkatkan.

### 7.6 Pertumbuhan Data Operasional

Data produk, bahan, resep, dan stok harus dapat bertambah seiring dengan perkembangan Theodore Coffee tanpa memerlukan perubahan besar terhadap struktur sistem.

### 7.7 Pertumbuhan Riwayat dan Laporan

* Data transaksi, laporan, aktivitas, dan riwayat dapat terus bertambah.
* Sistem harus tetap menyediakan akses terhadap data tersebut.
* Data tidak otomatis dihapus hanya karena jumlahnya bertambah.
* Mekanisme pagination, pencarian, dan filter dapat digunakan untuk membantu pengelolaan data dalam jumlah besar.

### 7.8 Multi-Branch

Pengembangan sistem untuk mendukung banyak cabang **belum ditetapkan pada V1**.

Kebutuhan multi-branch akan ditentukan pada tahap pengembangan berikutnya apabila Theodore Coffee berkembang menjadi beberapa cabang.

### 7.9 Pengembangan Versi Berikutnya

Sistem harus memungkinkan pengembangan ke versi berikutnya tanpa:

* Kehilangan data lama.
* Merusak data transaksi.
* Menghilangkan fungsi yang masih digunakan.
* Membutuhkan pembangunan ulang sistem secara keseluruhan.

### 7.10 Tujuan Skalabilitas

Penerapan kebutuhan skalabilitas bertujuan untuk:

1. Mendukung pertumbuhan Theodore Coffee.
2. Menangani pertumbuhan data dan transaksi.
3. Memungkinkan penambahan pengguna.
4. Memungkinkan peningkatan kapasitas infrastruktur.
5. Memudahkan penambahan fitur baru.
6. Menjaga data dan fungsi lama ketika sistem dikembangkan.
 ## 8. Backup & Recovery

Backup dan Recovery merupakan kebutuhan sistem untuk menjaga keamanan serta keberlangsungan data Theodore Coffee apabila terjadi kerusakan, kehilangan data, kesalahan sistem, atau gangguan layanan.

### 8.1 Backup Berkala

* Sistem harus melakukan backup data secara berkala.
* Backup digunakan untuk menjaga ketersediaan salinan data apabila terjadi kehilangan atau kerusakan data.
* Mekanisme dan jadwal backup disesuaikan dengan kemampuan layanan yang digunakan.

### 8.2 Backup Manual

* Admin/Owner dapat melakukan backup secara manual apabila diperlukan.
* Backup manual dapat dilakukan sebelum tindakan penting seperti perubahan sistem atau pemeliharaan data.

### 8.3 Riwayat Backup

Admin/Owner dapat melihat riwayat backup yang tersedia.

Informasi yang dapat ditampilkan meliputi:

* Tanggal dan waktu backup.
* Jenis backup.
* Status backup.
* Informasi backup yang tersedia.

Akses terhadap informasi backup hanya diberikan kepada Admin/Owner.

### 8.4 Restore Data

* Admin/Owner dapat melakukan restore data dari backup yang tersedia.
* Proses restore harus dilakukan secara aman.
* Sistem harus menjaga konsistensi data setelah proses restore.
* Tindakan restore harus melalui konfirmasi sebelum dijalankan.
* Aktivitas restore dicatat dalam log.

### 8.5 Kegagalan Backup

Apabila proses backup gagal:

* Admin/Owner mendapatkan notifikasi kegagalan.
* Status backup dicatat.
* Waktu kejadian dicatat.
* Informasi singkat mengenai kegagalan dicatat.
* Kegagalan backup dicatat dalam log.

### 8.6 Verifikasi Backup

Setelah backup selesai:

* Sistem harus melakukan pemeriksaan atau verifikasi terhadap hasil backup apabila mekanisme layanan mendukungnya.
* Backup yang tidak dapat diverifikasi harus ditandai.
* Kegagalan verifikasi harus diinformasikan kepada Admin/Owner.
* Hasil verifikasi dicatat dalam log apabila diperlukan.

### 8.7 Perlindungan Backup

Backup harus dilindungi dari akses atau perubahan yang tidak sah.

* Akses backup dibatasi berdasarkan kewenangan.
* Customer, Cashier, dan Barista/Dapur tidak dapat mengakses backup.
* Backup tidak boleh diubah atau dihapus oleh pengguna yang tidak memiliki kewenangan.
* Credential dan informasi sensitif yang berkaitan dengan backup harus dilindungi.

### 8.8 Recovery Setelah Gangguan

Setelah terjadi gangguan sistem:

* Sistem harus memulihkan operasi dan data sebanyak mungkin.
* Data transaksi, pembayaran, pesanan, dan stok harus tetap konsisten.
* Sistem tidak boleh membuat data transaksi atau pembayaran ganda akibat proses recovery.
* Status data yang tidak dapat dipastikan harus diperiksa sebelum dianggap berhasil.
* Recovery dilakukan dengan mempertahankan integritas data.

### 8.9 Tujuan Backup & Recovery

Penerapan kebutuhan Backup & Recovery bertujuan untuk:

1. Mengurangi risiko kehilangan data.
2. Menyediakan salinan data untuk pemulihan.
3. Memungkinkan Admin/Owner melakukan backup dan restore.
4. Menjaga keamanan backup.
5. Membantu pemulihan setelah gangguan.
6. Menjaga konsistensi transaksi, pembayaran, pesanan, dan stok.

## 9. Integritas Data

Integritas data merupakan kemampuan sistem untuk memastikan seluruh data Theodore Coffee tetap akurat, lengkap, konsisten, dan memiliki hubungan yang benar antar data selama proses penyimpanan, perubahan, transaksi, dan pemulihan.

### 9.1 Konsistensi Data Transaksi

Setiap transaksi harus tersimpan secara lengkap dan konsisten, meliputi:

* Data pesanan.
* Detail pesanan.
* Produk.
* Jumlah.
* Harga.
* Customization.
* Pembayaran.
* Total transaksi.
* Status pesanan.

Data transaksi tidak boleh tersimpan dalam kondisi yang menyebabkan informasi transaksi menjadi tidak sesuai.

### 9.2 Validasi dan Perhitungan Total

Client/browser dapat menghitung dan menampilkan:

* Subtotal.
* Discount apabila digunakan.
* Tax apabila digunakan.
* Total.

Namun, nilai tersebut tidak menjadi sumber kebenaran utama.

Server harus:

* Mengambil harga dari database.
* Menghitung ulang subtotal dan total.
* Memvalidasi jumlah produk.
* Memvalidasi customization dan add-on.
* Memvalidasi discount dan tax apabila digunakan.
* Memvalidasi total sebelum transaksi disimpan.

Hasil validasi server menjadi sumber kebenaran akhir transaksi.

### 9.3 Harga Produk

Harga transaksi mengikuti **harga produk terbaru yang tersedia pada saat transaksi diproses**.

Sistem tidak menetapkan harga lama sebagai harga transaksi secara otomatis apabila harga produk telah berubah.

### 9.4 Konsistensi Transaksi dan Stok

Penyimpanan transaksi dan pengurangan stok harus dilakukan secara konsisten.

* Transaksi hanya dianggap berhasil apabila proses yang diperlukan berhasil.
* Jika pengurangan stok yang diperlukan gagal, transaksi tidak dianggap berhasil.
* Sistem harus mencegah kondisi transaksi berhasil tetapi stok tidak berkurang sesuai kebutuhan.
* Proses yang berkaitan harus menggunakan mekanisme transaksi/atomicity yang sesuai.

### 9.5 Validasi Pembayaran

Status pembayaran harus berdasarkan pembayaran yang benar-benar telah diverifikasi.

* Pembayaran QRIS melalui Midtrans harus diverifikasi melalui mekanisme yang tersedia.
* Customer tidak dapat menentukan sendiri bahwa pembayaran telah berhasil.
* Pembayaran yang belum terverifikasi tidak boleh berstatus `DIBAYAR`.
* Sistem harus mencegah pembayaran yang sama diproses lebih dari satu kali.
* Status pembayaran yang tidak pasti harus diperiksa kembali sebelum transaksi dilanjutkan.

### 9.6 Keunikan Kode Pesanan

Setiap pesanan harus memiliki **kode pesanan yang unik**.

Kode pesanan tidak boleh digunakan oleh lebih dari satu pesanan aktif maupun riwayat transaksi.

### 9.7 Validasi Data

Sistem harus melakukan validasi terhadap data sebelum disimpan.

Validasi mencakup:

* Field wajib.
* Format data.
* Tipe data.
* Nilai yang diperbolehkan.
* Relasi data.
* Data yang harus unik.

Data yang tidak valid atau tidak lengkap harus ditolak.

### 9.8 Pencegahan Duplikasi Data

Data yang memiliki ketentuan unik tidak boleh memiliki duplikasi.

Contohnya:

* Kode pesanan.
* Username pengguna internal.
* Data unik lainnya sesuai kebutuhan sistem.

Sistem harus melakukan pemeriksaan dan validasi untuk mencegah data ganda.

### 9.9 Integritas Relasi Data

Hubungan antar data harus tetap valid.

Contohnya:

* Detail pesanan harus terhubung dengan pesanan yang benar.
* Produk harus terhubung dengan kategori yang sesuai.
* Resep harus terhubung dengan bahan yang benar.
* Pembayaran harus terhubung dengan pesanan yang benar.
* Data stok harus berkaitan dengan bahan yang sesuai.

Perubahan atau penghapusan data tidak boleh menyebabkan hubungan data menjadi rusak atau menghasilkan data yatim yang tidak dapat dipertanggungjawabkan.

### 9.10 Tujuan Integritas Data

Penerapan kebutuhan integritas data bertujuan untuk:

1. Menjaga data tetap akurat.
2. Mencegah data tidak lengkap.
3. Mencegah duplikasi data.
4. Menjaga hubungan antar data.
5. Menjaga konsistensi transaksi dan stok.
6. Memastikan pembayaran sesuai dengan transaksi.
7. Mencegah manipulasi nilai transaksi dari sisi client.
8. Menjaga keandalan data Theodore Coffee.
## 10. Logging & Monitoring

Logging & Monitoring merupakan kebutuhan sistem untuk mencatat aktivitas, kesalahan, perubahan data, serta memantau kondisi Sistem Informasi Theodore Coffee agar aktivitas dan gangguan dapat diketahui serta ditangani dengan baik.

### 10.1 Pencatatan Aktivitas Sistem

Sistem harus mencatat aktivitas penting yang terjadi di dalam sistem.

Aktivitas yang dicatat meliputi:

* Login.
* Logout.
* Perubahan produk.
* Perubahan harga.
* Perubahan stok.
* Perubahan resep.
* Perubahan pesanan.
* Pembatalan pesanan.
* Konfirmasi pembayaran.
* Refund.
* Perubahan user dan role.
* Perubahan pengaturan sistem.
* Export data.
* Generate atau reprint receipt.
* Aktivitas administratif penting lainnya.

### 10.2 Informasi Log

Setiap log aktivitas harus menyimpan informasi yang diperlukan untuk mengetahui:

* Siapa yang melakukan aktivitas.
* Waktu aktivitas dilakukan.
* Aktivitas yang dilakukan.
* Status aktivitas.

Status log dapat berupa:

* `SUCCESS`
* `FAILED`
* `ERROR`

### 10.3 Error Log

Sistem harus mencatat error atau kegagalan yang terjadi pada:

* Aplikasi.
* Database.
* API.
* Pembayaran.
* Webhook Midtrans.
* Proses otomatis.
* Integrasi layanan eksternal.

Error log digunakan untuk membantu pemeriksaan dan penanganan masalah sistem.

### 10.4 Halaman Monitoring

Admin/Owner memiliki halaman monitoring sistem untuk melihat kondisi penting sistem.

Informasi yang dapat ditampilkan meliputi:

* Status aplikasi.
* Status database/Supabase.
* Status layanan pembayaran/Midtrans.
* Status infrastruktur.
* Error.
* Gangguan.
* Aktivitas sistem.
* Riwayat gangguan.

### 10.5 Detail Perubahan Data

Untuk perubahan data penting, log harus menyimpan informasi perubahan apabila diperlukan, termasuk:

* Data sebelum perubahan.
* Data setelah perubahan.
* Data atau objek yang terkena perubahan.

Contohnya:

* Perubahan harga produk.
* Perubahan stok.
* Perubahan resep.
* Perubahan status pesanan.
* Perubahan user atau role.
* Perubahan pengaturan sistem.

### 10.6 Hak Akses Log

* Log aktivitas dan error hanya dapat dilihat oleh Admin/Owner.
* Cashier dan Barista/Dapur tidak memiliki akses terhadap halaman log internal.
* Customer tidak memiliki akses terhadap log sistem.

### 10.7 Pencarian dan Filter Log

Halaman log harus menyediakan fitur:

* Pencarian.
* Filter tanggal.
* Filter user.
* Filter aktivitas.
* Filter status.
* Filter jenis log.

Fitur tersebut digunakan untuk membantu menemukan aktivitas atau masalah tertentu.

### 10.8 Penyimpanan Log

* Log tidak otomatis dihapus selama sistem masih digunakan.
* Riwayat log dapat terus bertambah seiring penggunaan sistem.
* Pengelolaan data log harus mempertimbangkan pertumbuhan data agar tetap dapat diakses dengan baik.

### 10.9 Monitoring Realtime

Informasi gangguan dan kondisi penting pada halaman monitoring Admin/Owner harus diperbarui secara realtime apabila memungkinkan.

Perubahan status dapat meliputi:

* Sistem normal menjadi mengalami gangguan.
* Gangguan sebagian.
* Layanan kembali normal.

### 10.10 Notifikasi Gangguan

Apabila terjadi gangguan penting:

* Admin/Owner mendapatkan notifikasi.
* Gangguan dicatat dalam log.
* Informasi gangguan dapat ditampilkan pada halaman monitoring.

### 10.11 Perlindungan Audit Log

Audit log harus dilindungi agar tidak dapat:

* Diubah.
* Dihapus.
* Dimanipulasi.

oleh pengguna melalui aplikasi.

Hal ini bertujuan untuk menjaga keaslian riwayat aktivitas sistem.

### 10.12 Status Monitoring

Halaman monitoring menampilkan status layanan menggunakan indikator yang mudah dipahami, seperti:

* **Normal**
* **Gangguan**
* **Gangguan Sebagian**

Status tidak hanya bergantung pada penggunaan warna sehingga tetap dapat dipahami oleh pengguna.

### 10.13 Riwayat Gangguan

Sistem harus menyimpan riwayat gangguan yang dapat dilihat oleh Admin/Owner.

Informasi dapat mencakup:

* Jenis gangguan.
* Waktu mulai.
* Waktu selesai apabila sudah pulih.
* Status gangguan.
* Informasi singkat mengenai gangguan.

### 10.14 Perlindungan Informasi Error

Detail teknis seperti:

* Stack trace.
* Error database.
* Credential.
* Secret.
* Token.
* Informasi internal sistem.

tidak boleh ditampilkan kepada Customer.

Customer hanya menerima informasi error yang sederhana dan mudah dipahami.

### 10.15 Sumber Logging dan Monitoring

Logging dan monitoring dapat berasal dari beberapa sumber sesuai jenis informasinya:

* **Application Activity Log** digunakan untuk mencatat aktivitas bisnis dan tindakan pengguna.
* **Supabase** digunakan untuk membantu memantau database dan layanan backend.
* **Vercel** digunakan untuk membantu memantau aplikasi, runtime, dan deployment.
* **Midtrans** digunakan untuk membantu memeriksa status layanan dan proses pembayaran.

Log teknis dari layanan eksternal tidak menggantikan audit log aktivitas bisnis aplikasi.

### 10.16 Tujuan Logging & Monitoring

Penerapan kebutuhan logging dan monitoring bertujuan untuk:

1. Mengetahui aktivitas yang dilakukan pengguna.
2. Mengetahui perubahan data penting.
3. Mendeteksi error dan gangguan.
4. Membantu proses troubleshooting.
5. Menjaga riwayat aktivitas sistem.
6. Membantu Admin/Owner memantau kondisi sistem.
7. Menyediakan informasi ketika terjadi gangguan.
8. Menjaga keamanan dan akuntabilitas sistem.
## 11. Maintainability

Maintainability merupakan kemampuan Sistem Informasi Theodore Coffee untuk dipelihara, diperbaiki, dikembangkan, dan diperbarui dengan mudah tanpa mengganggu fungsi sistem yang sudah berjalan.

### 11.1 Struktur Sistem

* Source code harus memiliki struktur yang rapi dan terorganisir.
* Penamaan file, fungsi, komponen, dan variabel harus konsisten.
* Struktur sistem harus mudah dipahami oleh developer.
* Setiap bagian sistem harus memiliki tanggung jawab yang jelas.

### 11.2 Dokumentasi

Bagian penting sistem harus memiliki dokumentasi yang sesuai, termasuk:

* Struktur sistem.
* Struktur database.
* API.
* Konfigurasi.
* Cara menjalankan sistem.
* Integrasi dengan layanan eksternal.
* Prosedur deployment.
* Prosedur pemeliharaan.

### 11.3 Perubahan dan Penambahan Fitur

* Penambahan atau perubahan fitur harus dilakukan secara terkontrol.
* Perubahan tidak boleh merusak fitur yang sudah berjalan.
* Fitur baru harus dapat dikembangkan secara bertahap.
* Perubahan yang berpengaruh terhadap fitur lain harus diuji terlebih dahulu.

### 11.4 Perbaikan Error

* Error harus dapat diperbaiki tanpa mengubah bagian sistem yang tidak berkaitan apabila tidak diperlukan.
* Perbaikan harus dilakukan berdasarkan sumber masalah yang ditemukan.
* Perubahan perbaikan harus dapat ditelusuri melalui version control dan log yang sesuai.

### 11.5 Pengujian

Perubahan sistem harus dapat diuji sebelum digunakan pada sistem utama.

Pengujian dapat dilakukan terhadap:

* Fitur baru.
* Perubahan fitur.
* Perbaikan error.
* Integrasi.
* Database.
* Proses transaksi.
* Pembayaran.
* Realtime.

### 11.6 Version Control

Source code harus menggunakan sistem version control.

Version control digunakan untuk:

* Melacak perubahan source code.
* Mengetahui riwayat perubahan.
* Mengembalikan perubahan apabila terjadi masalah.
* Mendukung pengembangan secara terkontrol.

### 11.7 Modularitas

Sistem harus dibuat secara modular agar bagian-bagian utama dapat dikembangkan secara terpisah.

Modul dapat mencakup:

* Menu/produk.
* Pesanan.
* Pembayaran.
* Stok.
* Resep.
* Laporan.
* User dan role.
* Pengaturan.
* Logging dan monitoring.

Perubahan pada satu modul tidak boleh menyebabkan perubahan yang tidak diperlukan pada modul lainnya.

### 11.8 Pengelolaan Konfigurasi

Konfigurasi dan informasi rahasia harus dipisahkan dari source code.

Contohnya:

* Database credential.
* Midtrans Server Key.
* API key.
* Secret key.
* Token.
* Credential layanan eksternal.

Informasi tersebut harus dikelola menggunakan mekanisme konfigurasi atau environment/secret management yang sesuai.

### 11.9 Update dan Deployment

* Update sistem harus dilakukan secara terkontrol.
* Perubahan harus dapat diperiksa sebelum digunakan.
* Deployment harus dapat ditelusuri.
* Apabila terjadi masalah setelah update, perubahan dapat diperiksa dan dikembalikan menggunakan mekanisme version control atau prosedur recovery yang sesuai.

### 11.10 Pengembangan Versi Berikutnya

Sistem harus memungkinkan pengembangan ke versi berikutnya seperti V2, V3, dan seterusnya tanpa harus membangun ulang seluruh sistem dari awal.

Pengembangan versi berikutnya harus tetap mempertahankan:

* Data lama.
* Integritas transaksi.
* Fungsi yang masih digunakan.
* Struktur sistem yang diperlukan.

### 11.11 Tujuan Maintainability

Penerapan kebutuhan maintainability bertujuan untuk:

1. Memudahkan pemeliharaan sistem.
2. Memudahkan perbaikan error.
3. Memudahkan pengembangan fitur baru.
4. Mengurangi risiko kerusakan fitur yang sudah berjalan.
5. Memudahkan pelacakan perubahan.
6. Memudahkan proses testing.
7. Memudahkan deployment dan rollback.
8. Mendukung pengembangan Theodore Coffee ke versi berikutnya.
