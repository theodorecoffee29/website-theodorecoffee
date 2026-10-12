// File ini: teks yang tampil untuk panel "Sisa stok" dan untuk petunjuk stok
// di layar Cashier.
//
// Panel ini dipakai Cashier, Barista, dan Admin, jadi teksnya dibuat sendiri di
// src/features/stok/teks.ts dan bukan di teksCashier atau teksBarista. Kalau
// teksnya ikut di file per area, satu kalimat yang sama akan ditulis tiga kali
// dan mudah sekali tidak sinkron.
//
// Mengikuti aturan di AGENTS.md bagian "Tampilan (sampai Fase 7)": semua teks
// yang tampil ke pengguna dikumpulkan di satu file per area.

export const teksStok = {
  // Judul panel.
  judul: "Sisa stok",
  // Penjelasan singkat supaya Cashier tahu panel ini hanya informasi.
  keterangan: "Hanya untuk dibaca. Tidak memblokir konfirmasi pesanan.",

  // Cara menampilkan sisa porsi satu menu.
  //  - Angka: pola kalimat, {jumlah} diisi sisa porsinya.
  //  - 0: tulisannya "Habis" (bukan "sisa 0 porsi") supaya lebih jelas terbaca.
  //  - null: tulisannya "Tanpa resep", karena menu itu tidak punya bahan.
  //
  // Pola kalimat memakai {jumlah} supaya file ini bisa dipakai untuk semua
  // satuan tanpa menambah teks baru.
  sisaPorsi: "sisa {jumlah} porsi",
  habis: "Habis",
  tanpaResep: "Tanpa resep",

  // Daftar sisa bahan disimpan di elemen <details> supaya tidak memakan tempat
  // di layar Cashier yang sudah padat.
  labelBahan: "Lihat sisa bahan",
  // Pola kalimat per bahan: nama, jumlah, dan satuan. {jumlah} sudah memakai
  // format angka Indonesia (pemisah ribuan titik).
  barisBahan: "{nama}: {jumlah} {satuan}",
  // Penanda stok bahan yang minus. Ditampilkan sebagai teks, bukan hanya warna,
  // supaya tetap jelas kalau warnanya tidak bisa dibedakan.
  penandaMinus: "Minus",

  // Petunjuk di samping item pesanan yang Waiting for confirmation.
  // Pola kalimat: {jumlah} diisi sisa porsinya.
  petunjukSisa: "sisa {jumlah} porsi",
  // Peringatan di samping item yang bahannya tidak cukup. CUKUP PETUK, bukan
  // blokir: tombol Konfirmasi tetap bisa ditekan (docs/order-flow.md bagian 7).
  petunjukTidakCukup: "Stok tidak cukup",

  // Pesan saat panel gagal dimuat. Data yang sudah tampil TIDAK dihapus.
  gagalMuat: "Gagal memuat sisa stok, mencoba lagi...",
  // Pesan saat panel belum pernah termuat.
  memuat: "Memuat sisa stok...",
};
