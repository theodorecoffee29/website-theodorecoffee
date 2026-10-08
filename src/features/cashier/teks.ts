// File ini: semua teks yang tampil ke pengguna untuk area Cashier (/cashier).
//
// Semua judul, label, pesan, dan nama tombol dikumpulkan di sini supaya tidak
// tersebar di dalam JSX. Waktu tampilan diganti di Fase 7, teks di sini bisa
// disesuaikan tanpa menyentuh komponen.
//
// Mengikuti aturan di AGENTS.md bagian "Tampilan (sementara sampai Fase 7)".

export const teksCashier = {
  // Judul halaman dan identitas.
  judulHalaman: "Cashier",
  subjudulHalaman: "Kelola pesanan hari ini.",

  // Tiga kelompok order. Urutannya penting: kelompok yang paling butuh
  // perhatian (Menunggu konfirmasi) paling atas.
  kelompok: {
    menunggu: "Menunggu konfirmasi",
    dikerjakan: "Di antrean dan dikerjakan",
    selesai: "Selesai dan dibatalkan",
    // Penjelasan singkat di bawah judul tiap kelompok.
    keteranganMenunggu:
      "Cek pembayaran customer, pilih metode bayar, lalu tekan Konfirmasi.",
    keteranganDikerjakan:
      "Pesanan ini sudah dikonfirmasi dan sedang ditangani Barista.",
    keteranganSelesai: "Pesanan hari ini yang sudah selesai atau dibatalkan.",
    // Penanda kelompok yang paling penting (ditampilkan juga di daftar
    // antrean supaya tidak kelewat).
    penandaMenunggu: "PERLU KONFIRMASI",
    // Jumlah order di tiap kelompok, misal "2".
    jumlahOrder: "{jumlah} pesanan",
    // Tampil kalau satu kelompok tidak punya order.
    kosong: "Tidak ada pesanan.",
  },

  // Bagian di dalam satu kartu pesanan.
  order: {
    labelNomorAntrean: "Nomor antrean",
    labelNama: "Nama",
    labelJamDibuat: "Jam dibuat",
    labelItem: "Item",
    labelTotal: "Total",
    labelStatus: "Status",
    labelCatatan: "Catatan",
    // Label asal pesanan. Datanya dari kolom source: "online" untuk pesanan
    // dari HP customer, "cashier" untuk input manual di kasir
    // (docs/prd.md bagian 8: tiap baris order punya label asal order).
    labelAsal: {
      online: "Online",
      cashier: "Kasir",
      // Kalau muncul asal yang tidak dikenal, jangan menampilkan nama kolom
      // mentah ke pengguna.
      tidakDiketahui: "Asal tidak diketahui",
    },
    formatRupiah: "Rp {jumlah}",
    formatItem: "{jumlah} x {nama}",
    formatJamWib: "{jam} WIB",
    // Pola kalimat untuk judul tab browser, misal "(2) Cashier".
    judulTabDenganJumlah: "({jumlah}) Cashier",
    judulTabTanpaJumlah: "Cashier",
  },

  // Metode bayar. TIDAK ada nilai bawaan: Cashier wajib memilih sendiri
  // (docs/order-flow.md bagian 6 acceptance criteria 3).
  metodeBayar: {
    label: "Metode bayar",
    qris: "QRIS",
    tunai: "Tunai",
    // Dikakai sebagai atribut aria-label sekelompok tombol pilihan.
    labelPilihan: "Pilihan metode bayar",
  },

  // Tombol aksi.
  tombol: {
    konfirmasi: "Konfirmasi",
    konfirmasiSedang: "Mengonfirmasi…",
    batalkan: "Batalkan",
    batalkanSedang: "Membatalkan…",
    konfirmasiBatal: "Ya, batalkan",
    batalBatal: "Tidak",
    keluar: "Keluar",
  },

  // Popup konfirmasi pembatalan (docs/order-flow.md bagian 6 butir 7).
  dialogBatal: {
    judul: "Batalkan pesanan ini?",
    // Dipakai kalau pesanan belum dikonfirmasi (status menunggu_konfirmasi).
    isiBelumDikonfirmasi:
      "Pesanan ini belum dikonfirmasi, jadi tidak ada pembayaran maupun stok yang perlu dikembalikan.",
    // Dipakai kalau pesanan sudah dikonfirmasi (status antrean). Pembatalan
    // seperti ini membatalkan pembayaran dan mengembalikan stok bahan
    // (docs/order-flow.md bagian 3).
    isiSudahDikonfirmasi:
      "Pesanan ini sudah dikonfirmasi dan dibayar. Membatalkan akan membatalkan pembayaran dan mengembalikan stok bahan.",
    // Ditambahkan kalau pesanan sudah ada di antrean Barista.
    keteranganSudahDikerjakan: "Bisa dibatalkan sampai Barista menekan Mulai.",
  },

  // Notifikasi pesanan baru (tanpa suara, hanya teks spanduk dan judul tab).
  notifikasi: {
    // Pola kalimat untuk satu pesanan baru.
    spandukSatu: "Pesanan baru dari {nama}",
    // Pola kalimat kalau beberapa pesanan baru sekaligus.
    spandukBanyak: "{jumlah} pesanan baru",
  },

  // Peringatan stok setelah konfirmasi. BUKAN error (api-contract bagian 4):
  // konfirmasi tetap berhasil, Cashier hanya diberi tahu.
  peringatanStok: {
    judul: "Konfirmasi berhasil, tapi stok bahan kurang",
    // Pola kalimat per bahan. {bahan} diisi nama bahan, {sisa} diisi stok
    // yang tersisa (boleh negatif).
    baris: "{bahan}: sisa {sisa}",
  },

  // Pesan memuat dan error.
  pesan: {
    memuat: "Memuat daftar pesanan…",
    // Ditampilkan saat polling gagal. Daftar yang sudah tampil TIDAK dihapus.
    gagalMuat: "Gagal memuat, mencoba lagi…",
    // Batal atau konfirmasi ditolak karena status sudah berubah (mis. Cashier
    // lain sudah lebih dulu acting). Setelah ini daftar dimuat ulang.
    statusSudahBerubah: "Status pesanan sudah berubah",
    // Pola kalimat untuk kegagalan lain, lengkap dengan kode ERR-xxxx kalau ada.
    aksiGagalDenganKode: "Aksi gagal, coba lagi. Kode: {kode}",
    aksiGagal: "Aksi gagal, coba lagi.",
  },
} as const;
