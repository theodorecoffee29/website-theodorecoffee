// File ini: semua teks yang tampil ke pengguna untuk area Barista (/barista).
//
// Semua judul, label, pesan, dan nama tombol dikumpulkan di sini supaya tidak
// tersebar di dalam JSX. Waktu tampilan diganti di Fase 7, teks di sini bisa
// disesuaikan tanpa menyentuh komponen.
//
// Mengikuti aturan di AGENTS.md bagian "Tampilan (sementara sampai Fase 7)".

export const teksBarista = {
  // Judul halaman dan identitas.
  judulHalaman: "Barista",
  subjudulHalaman: "Antrean pesanan yang harus dibuat.",

  // Dua kelompok antrean. Urutannya penting: yang sedang dikerjakan di atas,
  // yang baru masuk di bawah (docs/order-flow.md bagian 1).
  kelompok: {
    dikerjakan: "Sedang dikerjakan",
    baruMasuk: "Baru masuk",
    keteranganDikerjakan: "Pesanan yang sedang kamu buat.",
    keteranganBaruMasuk:
      "Pesanan baru yang menunggu. Tekan Mulai kalau sudah mulai membuatnya.",
    // Jumlah pesanan di tiap kelompok, misal "2".
    jumlahOrder: "{jumlah} pesanan",
    // Tampil kalau satu kelompok tidak punya pesanan.
    kosong: "Tidak ada pesanan.",
    // Penanda untuk pesanan yang belum mulai.
    penandaBaru: "BARU",
  },

  // Bagian di dalam satu kartu pesanan.
  order: {
    labelItem: "Item",
    labelStatus: "Status",
    labelCatatan: "Catatan",
    // Pola kalimat per item, misal "2 x Americano".
    formatItem: "{jumlah} x {nama}",
    // Pola kalimat untuk judul tab browser, misal "(3) Barista".
    judulTabDenganJumlah: "({jumlah}) Barista",
    judulTabTanpaJumlah: "Barista",
  },

  // Pemetaan status. Barista melihat dua status saja, karena antrean hanya
  // berisi pesanan yang sudah dikonfirmasi dan sedang dibuat
  // (docs/order-flow.md bagian 1).
  status: {
    // Status "antrean" dari database.
    antrean: "Baru masuk",
    // Status "dikerjakan" dari database.
    dikerjakan: "Sedang dikerjakan",
    // Kalau muncul status lain yang tidak dikenal (seharusnya tidak terjadi).
    tidakDiketahui: "Status tidak diketahui",
  },

  // Tombol aksi. Setiap status punya satu tombol yang berbeda
  // (docs/order-flow.md bagian 3).
  tombol: {
    mulai: "Mulai",
    mulaiSedang: "Memulai…",
    selesai: "Selesai",
    selesaiSedang: "Menyelesaikan…",
    keluar: "Keluar",
  },

  // Notifikasi pesanan baru (tanpa suara, hanya teks spanduk dan judul tab).
  notifikasi: {
    // Pola kalimat untuk satu pesanan baru. {n} diisi nomor antrean.
    spandukSatu: "Pesanan baru: nomor {n}",
    // Pola kalimat kalau beberapa pesanan baru sekaligus.
    spandukBanyak: "{jumlah} pesanan baru",
    // Label tombol menutup spanduk.
    tutup: "Tutup",
  },

  // Pesan memuat dan error.
  pesan: {
    memuat: "Memuat antrean…",
    // Ditampilkan saat polling gagal. Daftar yang sudah tampil TIDAK dihapus.
    gagalMuat: "Gagal memuat, mencoba lagi…",
    // Aksi ditolak karena status sudah berubah, misalnya Barista lain sudah
    // menekan lebih dulu atau Cashier membatalkan pesanan. Setelah ini daftar
    // dimuat ulang.
    statusSudahBerubah: "Status pesanan sudah berubah",
    // Pola kalimat untuk kegagalan lain, lengkap dengan kode ERR-xxxx kalau ada.
    aksiGagalDenganKode: "Aksi gagal, coba lagi. Kode: {kode}",
    aksiGagal: "Aksi gagal, coba lagi.",
  },
} as const;
