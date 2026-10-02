# 1. Analisis Kebutuhan

Theodore Coffee merupakan usaha minuman yang saat ini masih berada pada tahap persiapan dan direncanakan beroperasi dalam bentuk booth kecil pada kegiatan atau pameran sekolah di lingkungan pesantren. Usaha ini dikelola oleh santri dan memiliki visi jangka panjang untuk dapat berkembang menjadi sebuah café yang lebih besar.

Dalam pelaksanaannya, Theodore Coffee membutuhkan sistem yang dapat membantu proses operasional penjualan agar lebih teratur, mudah dikelola, dan mampu mencatat setiap aktivitas transaksi dengan baik. Sebelum sistem ini dibuat, Theodore Coffee belum memiliki sistem pencatatan khusus untuk mengelola transaksi maupun aktivitas operasional lainnya.

Sistem yang akan dikembangkan berupa website yang dapat digunakan oleh pelanggan dan pengelola Theodore Coffee. Pelanggan dapat melihat menu, melakukan pemesanan, melakukan pembayaran menggunakan QRIS, serta mengambil pesanan secara langsung di booth. Selain pemesanan melalui website, pelanggan juga tetap dapat melakukan pemesanan secara langsung melalui kasir.

Pesanan yang berasal dari website akan masuk ke dalam dashboard pengelola sehingga dapat diproses oleh pihak Theodore Coffee. Sistem juga dirancang untuk mendukung kebutuhan kasir, barista, serta Admin/Owner dalam menjalankan operasional.

## Pengguna Sistem

1. **Pelanggan** — melihat menu, melakukan pemesanan, dan melakukan pembayaran.
2. **Kasir** — mengelola pesanan dan transaksi pelanggan.
3. **Barista** — melihat dan mengerjakan pesanan yang masuk.
4. **Admin/Owner** — mengelola data sistem serta melihat laporan, stok, dan transaksi.
5. **Manager** — direncanakan digunakan apabila Theodore Coffee berkembang menjadi café yang lebih besar.

Sistem juga membutuhkan pengelolaan stok dan resep. Setiap menu dapat memiliki resep yang menentukan kebutuhan bahan. Ketika suatu produk terjual, penggunaan bahan dapat diperhitungkan berdasarkan resep sehingga pengelola dapat mengetahui kondisi stok yang tersedia. Sistem juga direncanakan memberikan peringatan apabila stok bahan mulai menipis.

Untuk pemesanan, sistem menggunakan nomor pesanan yang unik dan status pesanan untuk membantu proses pengelolaan. Pelanggan dapat melakukan kustomisasi tertentu pada produk, seperti tingkat gula, tingkat es, dan metode seduh.

Teknologi yang digunakan dalam pengembangan sistem adalah **Next.js** sebagai teknologi utama pengembangan website, **Supabase** sebagai layanan backend dan database, serta **Vercel** sebagai platform deployment.

Dengan kebutuhan tersebut, sistem Theodore Coffee diharapkan dapat membantu proses operasional menjadi lebih terstruktur, mengurangi kesalahan pencatatan, memudahkan pelanggan dalam melakukan pemesanan, membantu pengelolaan stok, serta menyediakan data transaksi dan laporan yang dapat digunakan sebagai bahan evaluasi.
