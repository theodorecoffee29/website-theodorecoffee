// File ini: semua teks yang tampil ke pengguna untuk halaman Menu dan Resep
// Admin (/admin/menu).
//
// Semua judul, label, pesan, dan nama tombol dikumpulkan di sini supaya tidak
// tersebar di dalam JSX. Waktu tampilan diganti di Fase 7, teks di sini bisa
// disesuaikan tanpa menyentuh komponen.
//
// Mengikuti aturan di AGENTS.md bagian "Tampilan (sementara sampai Fase 7)".

export const teksMenuAdmin = {
  // Judul halaman dan navigasi.
  judulHalaman: "Menu dan resep",
  subjudulHalaman: "Kelola menu yang bisa dipesan dan resep bahannya.",
  // Tautan di halaman /admin.
  menuDanResep: "Menu dan resep",
  // Halaman stok belum ada (dibuat di tugas berikutnya), jadi belum ditautkan.
  stokSegera: "Stok (segera)",

  // Daftar menu.
  daftarMenu: {
    // Status menu.
    aktif: "Aktif",
    nonaktif: "Nonaktif",
    // Ringkasan resep per menu.
    // Pola kalimat untuk jumlah bahan, misal "3 bahan".
    jumlahBahan: "{jumlah} bahan",
    satuBahan: "1 bahan",
    belumAdaResep: "Belum ada resep",
  },

  // Form tambah dan ubah menu.
  formMenu: {
    judulTambah: "Tambah menu",
    judulUbah: "Ubah menu",
    labelNama: "Nama menu",
    placeholderNama: "Contoh: Kopi Susu",
    labelHarga: "Harga (rupiah)",
    placeholderHarga: "Contoh: 20000",
    tombolTambah: "Tambah menu",
    tombolUbah: "Simpan perubahan",
    tombolBatal: "Batal",
    // Pengingat di bawah form ubah (docs/data-model.md aturan 6: harga di
    // snapshot saat order dibuat, jadi mengubah harga tidak mengubah order lama).
    catatanHarga: "Harga baru tidak mengubah pesanan yang sudah ada.",
    // Pesan validasi.
    pesanNamaWajib: "Nama menu wajib diisi.",
    pesanNamaMaks: "Nama menu maksimal 60 karakter.",
    pesanHargaWajib: "Harga wajib diisi.",
    pesanHargaBatas: "Harga harus bilangan bulat antara 1 dan 10.000.000.",
  },

  // Tombol di tiap baris menu.
  tombolMenu: {
    resep: "Resep",
    ubah: "Ubah",
    nonaktifkan: "Nonaktifkan",
    aktifkan: "Aktifkan",
  },

  // Dialog konfirmasi nonaktifkan menu.
  dialogNonaktifkan: {
    judul: "Nonaktifkan menu ini?",
    // Menu yang dinonaktifkan hilang dari halaman pesan customer, tapi order lama
    // yang memakainya tetap utuh (menu tidak pernah dihapus).
    isi: "Menu tidak akan tampil di halaman pesan. Menu yang sudah dipesan tetap bisa dibaca di riwayat.",
    tombolYa: "Ya, nonaktifkan",
    tombolTidak: "Tidak",
  },

  // Editor resep.
  editorResep: {
    judul: "Resep {nama}",
    // Label kolom baris resep.
    labelBahan: "Bahan",
    labelTakaran: "Takaran per porsi",
    labelSatuan: "Satuan",
    // Pola kalimat takaran beserta satuannya, misal "20 ml per porsi".
    takaranDenganSatuan: "{takaran} {satuan} per porsi",
    // Tombol.
    tombolTambahBahan: "Tambah bahan",
    tombolHapusBaris: "Hapus",
    tombolSimpan: "Simpan resep",
    tombolTutup: "Tutup",
    // Penanda perubahan yang belum disimpan.
    penandaBelumDisimpan: "Ada perubahan belum disimpan",
    // Keterangan saat resep kosong.
    keteranganTanpaResep: "Tanpa resep, menu dianggap selalu tersedia",
    // Kalau belum ada bahan sama sekali, halaman Stok yang menambahkannya.
    belumAdaBahan: "Belum ada bahan. Bahan dibuat di halaman Stok.",
    // Jumlah bahan di reseps.
    jumlahBaris: "{jumlah} dari {maksimal} bahan",
    // Maksimal baris resep.
    barisPenuh: "Resep sudah mencapai {maksimal} bahan.",
    // Pesan validasi takaran.
    pesanTakaranWajib: "Takaran wajib diisi.",
    pesanTakaranPositif: "Takaran harus lebih dari 0.",
    pesanTakaranDesimal: "Takaran maksimal 3 angka di belakang koma.",
    pesanTakaranMaks: "Takaran tidak boleh lebih dari 1.000.000.",
    // Pesan validasi lain.
    pesanBahanGanda: "Bahan ini sudah dipakai di resep.",
  },

  // Dialog peringatan saat menutup editor tanpa menyimpan.
  dialogBelumSimpan: {
    judul: "Tutup tanpa menyimpan?",
    isi: "Perubahan resep belum disimpan dan akan hilang.",
    tombolSimpanDulu: "Simpan dulu",
    tombolTutup: "Tutup tanpa menyimpan",
  },

  // Pesan memuat dan error.
  pesan: {
    memuat: "Memuat daftar menu…",
    gagalMuat: "Gagal memuat, coba lagi.",
    // Tombol untuk mencoba memuat ulang setelah gagal.
    cobaLagi: "Coba lagi",
    belumAdaMenu: "Belum ada menu.",
    // Judul error dari server (kode ERR-xxxx) untuk kegagalan sistem.
    aksiGagalDenganKode: "Aksi gagal, coba lagi. Kode: {kode}",
    aksiGagal: "Aksi gagal, coba lagi.",
    resepTersimpan: "Resep disimpan.",
    menuTersimpan: "Menu disimpan.",
    menuDinonaktifkan: "Menu dinonaktifkan.",
    menuDiaktifkan: "Menu diaktifkan.",
    // Pola kalimat untuk pesan error dari server (VALIDATION_FAILED).
    // Pesannya datang dari server dan ditampilkan apa adanya, jadi tidak ada
    // pola kalimat di sini untuk kasus itu.
  },
} as const;

// Pola format rupiah, dipakai bersama supaya konsisten di semua tampilan.
export const POLA_RUPIAH = "Rp {jumlah}";
