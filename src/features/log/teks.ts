// File ini: semua teks yang tampil ke pengguna untuk halaman log Admin
// (/admin/log).
//
// Semua judul, label, pesan, dan nama tombol dikumpulkan di sini supaya tidak
// tersebar di dalam JSX. Waktu tampilan diganti di Fase 7, teks di sini bisa
// disesuaikan tanpa menyentuh komponen.
//
// Mengikuti aturan di AGENTS.md bagian "Tampilan (sementara sampai Fase 7)".
//
// CATATAN SOAL DAFTAR NAMA AKSI: nama aksi resmi ada di ACTIVITY_ACTIONS pada
// src/lib/log/index.ts (docs/logging.md bagian 6 poin 6). Modul itu ditandai
// server-only, jadi TIDAK boleh diimpor ke kode browser. Karena itu daftar label di
// bawah ditulis manual di sini, dan pemeriksa tipe "satisfies Record<ActivityAction,
// string>" memastikan tidak ada aksi yang tertinggal: kalau ada aksi baru yang
// ditambahkan ke ACTIVITY_ACTIONS, TypeScript akan menandai file ini sampai
// labelnya ditambahkan. Ada juga tes yang memeriksa hal yang sama saat dijalankan.

import type { ActivityAction } from "@/lib/log";

export const teksLog = {
  // Judul halaman dan tautan dari halaman /admin.
  judulHalaman: "Log",
  subjudulHalaman: "Catatan aktivitas dan error aplikasi.",
  tautanLog: "Log",

  // Nama kedua bagian di halaman log.
  bagian: {
    aktivitas: "Aktivitas",
    error: "Error",
  },

  // Tombol dan kolom isian.
  //
  // SETIAP isian punya label yang jelas dan setiap tombol punya nama yang jelas
  // (AGENTS.md bagian "Tampilan"), karena halaman ini dipakai sambil mencari penyebab
  // masalah, bukan sekadar untuk dilihat cepat.
  kontrol: {
    // Tombol aksi.
    terapkan: "Terapkan",
    aturUlang: "Atur ulang",
    muatLebihBanyak: "Muat lebih banyak",
    cobaLagi: "Coba lagi",
    lihatJejakOrder: "Lihat jejak order ini",
    // Label isian dan pilihan filter.
    labelDariTanggal: "Dari tanggal",
    labelSampaiTanggal: "Sampai tanggal",
    labelAksi: "Aksi",
    labelPeranPelaku: "Peran pelaku",
    labelJenisObjek: "Jenis objek",
    labelIdOrder: "Id order",
    labelCariKode: "Cari kode",
    labelTingkat: "Tingkat",
    labelSumber: "Sumber",
    // Nilai kosong pada setiap daftar pilihan.
    pilihanSemua: "-- Semua --",
    // Placeholder kolom id order.
    placeholderIdOrder:
      "UUID order, contoh 66666666-6666-4666-8666-666666666666",
    placeholderKode: "Contoh: ERR-4F2A",
    // Peng attribute aria-label untuk tabel.
    labelTabelAktivitas: "Daftar log aktivitas",
    labelTabelError: "Daftar log error",
    // Judul elemen details di setiap baris (supaya bisa diklik dan diketaui).
    judulDetailAktivitas: "Lihat detail sebelum, sesudah, dan konteks",
    judulDetailError: "Lihat detail konteks",
    // Label di dalam elemen details.
    labelSebelum: "Sebelum",
    labelSesudah: "Sesudah",
    labelKonteks: "Konteks",
    labelPesanError: "Pesan",
  },

  // Label ramah untuk setiap nama aksi di docs/logging.md bagian 2.
  //
  // Ditulis dengan huruf kapital di awal supaya terbaca di tabel, dan memakai
  // kata yang biasa dipakai orang (bukan istilah teknis seperti "voided").
  //
  // "satisfies" dipakai supaya TypeScript WAJIB memeriksa semua nama aksi punya label,
  // tanpa mengubah teksnya jadi tipe yang lebih umum.
  aksi: {
    "order.created": "Order dibuat",
    "order.confirmed": "Order dikonfirmasi",
    "order.cancelled": "Order dibatalkan",
    "order.started": "Order mulai dibuat",
    "order.finished": "Order selesai",
    "payment.recorded": "Pembayaran dicatat",
    "payment.voided": "Pembayaran dibatalkan",
    "stock.deducted": "Stok berkurang",
    "stock.restored": "Stok dikembalikan",
    "stock.restocked": "Stok ditambah",
    "stock.adjusted": "Stok dikoreksi",
    "stock.negative": "Peringatan stok minus",
    "menu.created": "Menu dibuat",
    "menu.updated": "Menu diubah",
    "menu.deactivated": "Menu dinonaktifkan",
    "recipe.updated": "Resep diubah",
    "account.created": "Akun dibuat",
    "account.updated": "Akun diubah",
    "account.deactivated": "Akun dinonaktifkan",
    "account.password_reset": "Password akun direset",
    "auth.login": "Berhasil masuk",
    "auth.login_failed": "Gagal masuk",
    "auth.logout": "Keluar",
    "access.denied": "Akses ditolak",
    "report.saved": "Laporan tersimpan",
    "report.printed": "Laporan dicetak",
  } satisfies Record<ActivityAction, string>,

  // Label ramah untuk peran pelaku (termasuk customer dan system yang tidak punya
  // akun).
  peran: {
    admin: "Admin",
    cashier: "Cashier",
    barista: "Barista",
    customer: "Customer",
    system: "Sistem",
    tidakDiketahui: "Peran tidak diketahui",
  },

  // Label ramah untuk tingkat keparahan (docs/logging.md bagian 4).
  //
  // PENTING: tingkat ditulis dengan TEKS, bukan hanya dibedakan dengan warna. Kalau
  // hanya warna, "Peringatan" dan "Kritis" jadi sulit dibedakan saat dicetak
  // hitam-putih atau oleh orang yang sulit membedakan warna.
  tingkat: {
    warning: "Peringatan",
    error: "Error",
    critical: "Kritis",
    // Dipakai kalau muncul tingkat yang tidak dikenal.
    tidakDiketahui: "Tingkat tidak dikenal",
  },

  // Label ramah untuk sumber error.
  sumber: {
    client: "Browser",
    server: "Server",
    database: "Database",
    tidakDiketahui: "Sumber tidak diketahui",
  },

  // Label ramah untuk jenis objek yang berubah.
  objek: {
    order: "Order",
    payment: "Pembayaran",
    menu_item: "Menu",
    recipe: "Resep",
    ingredient: "Bahan",
    account: "Akun",
    report: "Laporan",
    auth: "Masuk dan akses",
    tidakDiketahui: "Objek tidak dikenal",
  },

  // Label kolom tabel.
  kolom: {
    waktu: "Waktu (WIB)",
    aksi: "Aksi",
    pelaku: "Pelaku",
    objek: "Objek",
    kode: "Kode",
    tingkat: "Tingkat",
    sumber: "Sumber",
    pesanSingkat: "Pesan singkat",
  },

  // Cara menampilkan pelaku di satu sel.
  //
  // Pola-pola ini memakai {nilai} dan digantikan di src/features/log/label.ts.
  pelaku: {
    // Staff yang namanya diketahui: "Budi (Cashier)".
    bernama: "{nama} ({peran})",
    // Customer dan sistem tidak punya akun, jadi namanya tidak ada.
    tanpaNama: "{peran}",
    // Staff yang namanya tidak ada di tabel profiles (mis. akunnya dihapus).
    namaTidakAda: "{peran} (nama tidak ditemukan)",
  },

  // Cara menampilkan objek di satu sel.
  objekTampil: {
    // "order 1234abcd" (8 karakter pertama id).
    denganId: "{jenis} {id}",
    // Objek tanpa id, misalnya "auth" untuk percobaan login.
    tanpaId: "{jenis}",
  },

  // Pola kalimat id order yang dipotong untuk dibaca sekilas.
  //
  // Id penuh tetap tersedia lewat tombol "Lihat jejak order ini", jadi memotong di
  // layar bukan kehilangan informasi.
  polaIdPendek: "{id}",
  // Jumlah karakter pertama id yang ditampilkan.
  //
  // 8 karakter cukup untuk membedakan dua order tanpa membuat kolom terlalu lebar.
  panjangIdPendek: 8,

  // Keadaan dan pesan.
  pesan: {
    memuat: "Memuat...",
    // Dipakai saat hasil sudah termuat tapi tidak ada baris yang cocok.
    tidakAdaHasil: "Tidak ada hasil",
    // Pesan gagal tanpa kode error.
    gagalMuat: "Gagal memuat log, coba lagi.",
    // Pesan gagal dengan kode ERR-xxxx, diisi dari kode yang dikirim server.
    gagalMuatDenganKode: "Gagal memuat log, coba lagi. Kode: {kode}",
    // Ditampilkan kalau isi baris (before/after/meta/context) kosong.
    detailKosong: "Tidak ada isian.",
    // Catatan kecil di pojok kiri tabel, memberi tahu arah urutannya.
    catatanUrut: "Urut dari yang terbaru.",
    // Catatan untuk mode jejak order: urutannya dibalik supaya bisa dibaca dari awal.
    catatanUrutJejak: "Jejak order ini diurutkan dari yang paling lama.",
  },

  // Tulisan kecil di bawah halaman.
  catatanAkhir: {
    // Menjelaskan bahwa membuka halaman ini sendiri tidak dicatat, supaya Admin
    // tidak mencari jejaknya (docs/logging.md bagian 2).
    tidakDicatat:
      "Membuka halaman ini tidak dicatat. Baris log tidak bisa diubah atau dihapus.",
  },
} as const;
