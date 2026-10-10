// File ini: semua teks yang tampil ke pengguna untuk halaman Stok Admin
// (/admin/stok).
//
// Semua judul, label, pesan, dan nama tombol dikumpulkan di sini supaya tidak
// tersebar di dalam JSX. Waktu tampilan diganti di Fase 7, teks di sini bisa
// disesuaikan tanpa menyentuh komponen.
//
// Mengikuti aturan di AGENTS.md bagian "Tampilan (sementara sampai Fase 7)".

export const teksStokAdmin = {
  // Judul halaman dan navigasi.
  judulHalaman: "Stok bahan",
  subjudulHalaman: "Kelola bahan baku dan jumlah stoknya.",
  // Tautan di halaman /admin.
  stok: "Stok",

  // Daftar bahan.
  daftarBahan: {
    labelSatuan: "Satuan",
    labelStok: "Stok",
    // Tanda untuk stok minus. Ditampilkan sebagai TEKS, bukan hanya warna, supaya
    // tetap terbaca oleh orang yang tidak membedakan warna
    // (docs/pemissions.md bagian 5).
    tandaMinus: "Minus",
    keteranganMinus: "Perlu dikoreksi",
    // Label satuan.
    satuan: {
      g: "Gram (g)",
      ml: "Mililiter (ml)",
      pcs: "Buah (pcs)",
    },
    belumAdaBahan: "Belum ada bahan.",
    // Pola kalimat untuk label satuan singkat, misal "g".
    satuanSingkat: "{satuan}",
  },

  // Form tambah bahan.
  formTambah: {
    judul: "Tambah bahan",
    labelNama: "Nama bahan",
    placeholderNama: "Contoh: Susu",
    labelSatuan: "Satuan",
    labelStokAwal: "Stok awal (opsional)",
    placeholderStokAwal: "Contoh: 5000",
    // Catatan di dekat pilihan satuan.
    catatanSatuan: "Satuan tidak bisa diubah setelah bahan dibuat",
    tombolTambah: "Tambah bahan",
  },

  // Form ubah bahan.
  formUbah: {
    judul: "Ubah bahan",
    // Satuan ditampilkan tapi tidak bisa diedit.
    catatanSatuan: "Satuan tidak bisa diubah setelah bahan dibuat",
    tombolSimpan: "Simpan perubahan",
    tombolBatal: "Batal",
  },

  // Dialog restock.
  dialogRestock: {
    judul: "Tambah stok {nama}",
    labelJumlah: "Jumlah yang ditambahkan",
    labelCatatan: "Catatan (opsional)",
    placeholderCatatan: "Contoh: Pembelian minggu ini",
    // Baris ringkasan: stok sekarang dan perkiraan stok sesudah.
    labelStokSekarang: "Stok sekarang",
    labelPerkiraanSesudah: "Perkiraan stok sesudah",
    tombolYa: "Ya, tambah stok",
    tombolTidak: "Batal",
  },

  // Dialog koreksi stok.
  dialogKoreksi: {
    judul: "Koreksi stok {nama}",
    // Keterangan kenapa dan kapan fungsi ini dipakai.
    keterangan:
      "Dipakai untuk menyamakan stok di sistem dengan stok fisik, termasuk memperbaiki stok yang minus",
    labelJumlahFisik: "Jumlah hasil hitung fisik",
    labelAlasan: "Alasan (wajib)",
    placeholderAlasan: "Contoh: Hasil hitung setelah kehilangan",
    // Baris ringkasan: stok tercatat, angka baru, dan selisihnya.
    labelStokTercatat: "Stok tercatat sekarang",
    labelAngkaBaru: "Angka baru",
    labelSelisih: "Selisih",
    tombolYa: "Ya, koreksi",
    tombolTidak: "Batal",
  },

  // Riwayat pergerakan per bahan.
  riwayat: {
    judul: "Riwayat {nama}",
    // Judul kolom.
    labelWaktu: "Waktu",
    labelJenis: "Jenis",
    labelPerubahan: "Perubahan",
    labelStokSesudah: "Stok sesudah",
    labelCatatan: "Catatan",
    // Label ramah untuk tiap jenis pergerakan
    // (docs/data-model.md: stock_movements.type).
    jenis: {
      // Stok berkurang karena pesanan dikonfirmasi.
      order_confirm: "Pengurangan pesanan",
      // Stok bertambah kembali karena pesanan dibatalkan.
      order_cancel_restore: "Pengembalian pembatalan",
      // Stok ditambahkan Admin (restock).
      restock: "Restock",
      // Stok dikoreksi Admin ke hasil hitung fisik.
      adjustment: "Koreksi",
      // Jenis yang tidak dikenal (seharusnya tidak terjadi).
      tidakDiketahui: "Jenis tidak diketahui",
    },
    // Pola kalimat untuk pembuka kolom id order.
    // {id} diisi 8 karakter pertama id order.
    orderPrefix: "Order {id}",
    // Kalau baris tidak punya catatan.
    tanpaCatatan: "-",
    // Kalau pergerakan tidak berasal dari order (restock atau koreksi).
    bukanDariOrder: "Manual",
    belumAda: "Belum ada riwayat.",
    tombolTutup: "Tutup",
  },

  // Tombol di tiap baris bahan.
  tombolBahan: {
    restock: "Restock",
    koreksi: "Koreksi stok",
    riwayat: "Riwayat",
    ubah: "Ubah",
  },

  // Pesan validasi angka (dipakai bersama untuk semua isian angka).
  pesanAngka: {
    wajib: "Jumlah wajib diisi.",
    positif: "Jumlah harus lebih dari 0.",
    nolBoleh: "Jumlah tidak boleh negatif.",
    desimal: "Jumlah maksimal 3 angka di belakang koma.",
    maks: "Jumlah tidak boleh lebih dari 1.000.000.",
    tidakValid: "Jumlah harus berupa angka.",
  },

  // Pesan validasi nama dan satuan.
  pesan: {
    namaWajib: "Nama bahan wajib diisi.",
    namaMaks: "Nama bahan maksimal 60 karakter.",
    // Satuan wajib dipilih: tidak ada nilai bawaan.
    satuanWajib: "Pilih satuan bahan.",
    // Alasan koreksi wajib diisi.
    alasanWajib: "Alasan wajib diisi.",
    alasanMaks: "Alasan maksimal 100 karakter.",
    // Catatan opsional.
    catatanMaks: "Catatan maksimal 100 karakter.",
    // Pola kalimat pesan sukses.
    bahanTersimpan: "Bahan disimpan.",
    bahanDitambah: "Bahan ditambahkan.",
    stokDitambah: "Stok ditambahkan.",
    stokDikoreksi: "Stok dikoreksi.",
    // Pola kalimat untuk gagal memuat.
    memuat: "Memuat daftar bahan...",
    gagalMuat: "Gagal memuat, coba lagi.",
    // Tombol mencoba memuat ulang.
    cobaLagi: "Coba lagi",
    // Pola kalimat untuk kegagalan lain.
    aksiGagalDenganKode: "Aksi gagal, coba lagi. Kode: {kode}",
    aksiGagal: "Aksi gagal, coba lagi.",
  },
} as const;
