// File ini: semua teks yang tampil ke pengguna untuk halaman Kelola Akun
// (/admin/akun).
//
// Semua judul, label, pesan, dan nama tombol dikumpulkan di sini supaya tidak
// tersebar di dalam JSX. Waktu tampilan diganti di Fase 7, teks di sini bisa
// disesuaikan tanpa menyentuh komponen.
//
// Mengikuti aturan di AGENTS.md bagian "Tampilan (sementara sampai Fase 7)": setiap
// isian punya label teks yang jelas dan setiap tombol punya nama yang jelas, karena
// halaman ini dipakai sambil mengatur akses booth, bukan sekadar untuk dilihat cepat.

export const teksAkun = {
  // Judul halaman dan tautan dari halaman /admin.
  judulHalaman: "Akun",
  subjudulHalaman: "Kelola akun Cashier dan Barista.",
  tautanAkun: "Akun",

  // Nama tombol.
  tombol: {
    simpan: "Simpan",
    buat: "Buat akun",
    buatAcak: "Buat password acak",
    ubah: "Ubah",
    nonaktifkan: "Nonaktifkan",
    aktifkan: "Aktifkan",
    resetPassword: "Reset password",
    tutup: "Tutup",
    konfirmasi: "Ya, lanjutkan",
    batal: "Tidak, batal",
    keluar: "Keluar",
    cobaLagi: "Coba lagi",
  },

  // Form tambah akun.
  formBuat: {
    judul: "Tambah akun",
    keterangan:
      "Password ditampilkan agar bisa disalin dan diserahkan langsung ke pemilik akun. Password tidak bisa dilihat lagi setelah ini.",
    labelNama: "Nama",
    placeholderNama: "Contoh: Budi",
    labelEmail: "Email",
    placeholderEmail: "Contoh: budi@contoh.com",
    labelPeran: "Peran",
    labelPassword: "Password",
    keteranganPassword: "Minimal 10 karakter, harus ada huruf dan angka.",
    pesanAcak: "Password acak sudah dibuat. Salin dan catat sebelum menutup.",
  },

  // Dialog hasil pembuatan akun.
  //
  // Dialog ini muncul SATU KALI setelah akun berhasil dibuat, lalu isinya dibuang dari
  // memori tampilan begitu ditutup. Jadi Admin wajib mencatatnya saat dialog masih
  // terbuka.
  dialogBerhasil: {
    judul: "Akun dibuat",
    labelEmail: "Email",
    labelPassword: "Password",
    peringatan:
      "Catat dan serahkan sekarang. Password tidak bisa dilihat lagi.",
    // Pola kalimat untuk hasil aksi lain (reset password). {aksi} diisi
    // "Password baru untuk ...".
    judulReset: "Password diganti",
    keteranganReset:
      "Serahkan password ini sekarang. Password tidak bisa dilihat lagi.",
  },

  // Dialog ubah akun.
  dialogUbah: {
    judul: "Ubah akun ini",
    // Pola kalimat nama akun, misal "Ubah akun Budi".
    judulDenganNama: "Ubah akun {nama}",
  },

  // Dialog konfirmasi status aktif.
  dialogStatus: {
    // Dipakai saat menonaktifkan.
    judulNonaktifkan: "Nonaktifkan akun ini?",
    isiNonaktifkan: "Akun ini tidak akan bisa masuk lagi.",
    // Dipakai saat mengaktifkan kembali.
    judulAktifkan: "Aktifkan akun ini?",
    isiAktifkan:
      "Pemiliknya akan bisa masuk lagi dengan password yang sekarang.",
  },

  // Dialog reset password.
  dialogReset: {
    judul: "Reset password",
    // Pola kalimat nama akun.
    judulDenganNama: "Reset password {nama}",
    isi: "Masukkan password baru, lalu serahkan secara langsung. Password ini tidak bisa dilihat lagi setelah dialog ditutup.",
    labelPassword: "Password baru",
  },

  // Kolom daftar akun.
  kolom: {
    nama: "Nama",
    email: "Email",
    peran: "Peran",
    status: "Status",
    terakhirMasuk: "Terakhir masuk",
    aksi: "Aksi",
  },

  // Nilai status dan peran yang tampil.
  //
  // Ditulis dengan TEKS, bukan hanya dibedakan dengan warna, supaya tetap terbaca
  // saat dicetak hitam-putih atau oleh orang yang sulit membedakan warna.
  status: {
    aktif: "Aktif",
    nonaktif: "Nonaktif",
  },

  peran: {
    admin: "Admin",
    cashier: "Cashier",
    barista: "Barista",
    // Dipakai kalau muncul peran yang tidak dikenal (mis. nilai baru di database).
    tidakDiketahui: "Peran tidak diketahui",
  },

  // Ditampilkan di kolom "Terakhir masuk" kalau akun belum pernah masuk.
  belumPernahMasuk: "Belum pernah",

  // Pola kalimat waktu. {waktu} diisi tanggal dan jam WIB.
  //
  // Dipakai untuk waktu dibuat dan waktu terakhir masuk.
  formatWaktu: "{waktu}",

  // Kalimat pengantar untuk akun Admin, supaya Admin tahu kenapa barisnya tidak
  // punya tombol.
  keteranganAdmin: "Akun Admin tidak bisa diubah dari halaman ini.",

  // Keadaan dan pesan.
  pesan: {
    memuat: "Memuat akun...",
    // Dipakai kalau daftar sudah termuat tapi tidak ada akun sama sekali.
    belumAdaAkun: "Belum ada akun.",
    // Pola kalimat untuk kegagalan tanpa kode ERR-xxxx.
    gagal: "Gagal. Coba lagi.",
    // Pola kalimat untuk kegagalan dengan kode ERR-xxxx, diisi dari kode yang dikirim
    // server. Kode itu yang dicari Admin di error_logs.
    gagalDenganKode: "Gagal. Kode: {kode}",
    // Pesan khusus untuk beberapa kegagalan yang sering terjadi.
    emailSudahDipakai: "Email sudah dipakai.",
    // Nota kecil di bawah daftar.
    catatan:
      "Akun yang dinonaktifkan tetap ada di daftar dan bisa diaktifkan kembali.",
  },

  // Label untuk peng_atribut aria-label pada tiap baris dialog, supaya pembaca
  // layar tahu dialog ini untuk akun mana.
  //
  // Pola kalimat. {nama} diisi nama akun.
  ariaDialog: "Dialog untuk akun {nama}",
} as const;
