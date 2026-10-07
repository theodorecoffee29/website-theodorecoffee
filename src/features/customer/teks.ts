// File ini: semua teks yang tampil ke pengguna untuk area customer.
// Semua judul, label, pesan, dan nama tombol dikumpulkan di sini supaya tidak
// tersebar di dalam JSX. Waktu tampilan diganti di Fase 7, teks di sini bisa
// disesuaikan tanpa menyentuh komponen.
//
// Mengikuti aturan di AGENTS.md bagian "Tampilan (sementara sampai Fase 7)".

export const teksCustomer = {
  // Judul dan identitas.
  judulAplikasi: "Theodore Coffee",
  subjudulBeranda: "Pesan kopi tanpa antre panjang.",

  // Halaman awal: daftar order aktif.
  beranda: {
    judulOrderAktif: "Pesanan kamu yang sedang berjalan",
    daftarKosong: "Belum ada pesanan yang sedang berjalan.",
    tombolPesanBaru: "Buat pesanan baru",
    // Pola kalimat untuk satu baris order aktif. Nama tidak ditampilkan karena
    // semua order aktif di daftar ini milik HP yang sama, jadi nomor antrean
    // sudah cukup untuk memilih.
    kalimatOrderAktif: "Nomor antrean {nomor}",
    cekSesi: "Memeriksa pesanan kamu…",
  },

  // Form pesan.
  formPesan: {
    judul: "Buat pesanan",
    labelNama: "Nama kamu",
    placeholderNama: "Contoh: Budi",
    labelMenu: "Menu",
    labelJumlah: "Jumlah",
    // Batas jumlah per menu (docs/api-contract.md bagian 2: bilangan bulat 1-99).
    maksQty: 99,
    labelCatatan: "Catatan (opsional)",
    placeholderCatatan: "Contoh: less sugar",
    labelTotal: "Total (perkiraan)",
    tombolKirim: "Kirim pesanan",
    tombolKirimSedang: "Mengirim…",
    // Status menu.
    labelHabis: "Habis",
    labelJumlahBenar: "Jumlah tiap menu harus antara 0 sampai 99.",
    labelCatatanMaks: "Catatan maksimal 100 karakter.",
    pesanNamaWajib: "Nama wajib diisi.",
    pesanNamaMaks: "Nama maksimal 50 karakter.",
    pesanBelumAdaItem: "Pilih minimal satu menu dengan jumlah lebih dari 0.",
    pesanMengirim: "Pesanan sedang dikirim. Mohon tunggu sebentar.",
    pesanGagalKirim: "Pesanan gagal dikirim, coba lagi.",
    pesanGagalKirimDenganKode: "Pesanan gagal dikirim, coba lagi. Kode: {kode}",
    formatRupiah: "Rp {jumlah}",
  },

  // Halaman status.
  status: {
    judul: "Status pesanan",
    labelNomorAntrean: "Nomor antrean",
    labelNama: "Nama",
    labelItem: "Item",
    labelTotal: "Total",
    labelStatus: "Status",
    labelCatatan: "Catatan",
    // Teks status yang dilihat customer (docs/order-flow.md bagian 1).
    statusMenunggu: "Menunggu konfirmasi",
    statusSedangDibuat: "Sedang dibuat",
    statusSelesai: "Pesanan selesai",
    statusDibatalkan: "Dibatalkan",
    // Petunjuk saat masih menunggu konfirmasi.
    petunjukBayar: "Silakan bayar di booth",
    // Tombol.
    tombolBatalkan: "Batalkan pesanan",
    tombolYa: "Ya, batalkan",
    tombolTidak: "Tidak",
    judulDialogBatal: "Batalkan pesanan ini?",
    isiDialogBatal: "Pesanan yang sudah dibayar tidak bisa dibatalkan sendiri.",
    // Pesan saat memuat atau gagal.
    memuat: "Memuat pesanan…",
    gagalMuat: "Gagal memuat, mencoba lagi…",
    // Order tidak ditemukan.
    tidakDitemukan: "Pesanan tidak ditemukan atau sudah tidak ada.",
    // Tautan.
    tautanPesanLagi: "Pesan lagi",
    // Batal gagal karena status sudah berubah.
    statusSudahBerubah: "Status pesanan sudah berubah",
    gagalBatalkan: "Pesanan gagal dibatalkan, coba lagi.",
  },
} as const;