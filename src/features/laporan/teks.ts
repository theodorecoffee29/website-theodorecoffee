// File ini: semua teks yang tampil ke pengguna untuk halaman Laporan dan
// Riwayat (/cashier/laporan, /admin/laporan, dan halaman detailnya).
//
// Semua judul, label, pesan, dan nama tombol dikumpulkan di sini supaya tidak
// tersebar di dalam JSX. Waktu tampilan diganti di Fase 7, teks di sini bisa
// disesuaikan tanpa menyentuh komponen.
//
// Mengikuti aturan di AGENTS.md bagian "Tampilan (sementara sampai Fase 7)".

import type { AlasanBatal } from "@/lib/alasan-batal";

export const teksLaporan = {
  // Judul halaman dan identitas.
  judulHalaman: "Laporan",
  subjudulHalaman: "Laporan penjualan hari ini dan riwayat laporan tersimpan.",

  // Nama menu navigasi, dipakai di halaman /cashier dan /admin.
  tautanLaporan: "Laporan",

  // Nama tombol.
  tombol: {
    cetak: "Cetak",
    keluar: "Keluar",
    cobaLagi: "Coba lagi",
  },

  // Nama kedua bagian di halaman laporan.
  bagian: {
    hariIni: "Hari ini",
    riwayat: "Riwayat",
  },

  // Pesan saat memuat dan saat gagal.
  pesan: {
    // Dipakai selama permintaan pertama. Riwayat memakai pesan yang sama
    // walaupun permintaannya bisa agak lama karena menjalankan penyimpanan
    // cadangan.
    memuat: "Memuat...",
    // Pola kalimat untuk kegagalan memuat, lengkap dengan kode ERR-xxxx kalau
    // errornya sudah dicatat di server.
    gagalMuatDenganKode: "Gagal memuat laporan, coba lagi. Kode: {kode}",
    gagalMuat: "Gagal memuat laporan, coba lagi.",
    // Ditampilkan kalau polling "Hari ini" gagal. Data yang sudah tampil TIDAK
    // dihapus, Cashier tetap butuh melihat angka terakhir.
    gagalPolling: "gagal memuat, mencoba lagi",
    // Ditampilkan kalau permintaan Riwayat berjalan tapi ada hari yang gagal
    // disimpan (catchUpFailed). Daftar tetap ditampilkan.
    riwayatBelumLengkap:
      "Sebagian laporan lama belum bisa disimpan, coba muat ulang",
    riwayatKosong: "Belum ada laporan tersimpan",
  },

  // Catatan bahwa laporan hari ini belum disimpan.
  //
  // Laporan hari ini masih berubah terus-menerus, jadi baru disimpan otomatis
  // saat pergantian hari (docs/api-contract.md bagian 4c).
  keteranganHariIni: "Laporan sementara, belum disimpan",

  // Kotak ringkasan paling atas.
  ringkasan: {
    judul: "Ringkasan",
    tanggal: "Tanggal",
    orderTerhitung: "Order terhitung",
    totalPenjualan: "Total penjualan",
    dibatalkan: "Jumlah dibatalkan",
    belumSelesai: "Jumlah belum selesai (menunggu konfirmasi)",
  },

  // Kotak besar Pencocokan uang.
  pencocokan: {
    judul: "Pencocokan uang",
    // Keterangan ini yang dicari Cashier di akhir acara: uang di laci harus
    // sama dengan total tunai, dan saldo QRIS harus sama dengan total QRIS.
    keterangan:
      "Cocokkan Tunai dengan uang di laci dan QRIS dengan saldo yang masuk",
    tunai: "Tunai",
    qris: "QRIS",
    // Pola kalimat jumlah order per metode bayar, misal "12 order".
    formatJumlahOrder: "{jumlah} order",
  },

  // Rincian asal order (docs/prd.md bagian 8: tiap baris order punya label asal).
  asalOrder: {
    judul: "Asal order",
    online: "Online",
    kasir: "Kasir",
    // Dipakai kalau muncul asal yang tidak dikenal, supaya nama mentah dari
    // database tidak pernah ditulis ke layar.
    tidakDiketahui: "Asal tidak diketahui",
  },

  // Menu terlaris.
  menuTerlaris: {
    judul: "Menu terlaris",
    kolomPorsi: "Porsi",
    kolomNominal: "Nominal",
    kosong: "Belum ada menu terjual.",
  },

  // Pemakaian bahan dan sisa akhir hari.
  pemakaianBahan: {
    judul: "Pemakaian bahan",
    kolomTerpakai: "Terpakai",
    kolomSisa: "Sisa akhir hari",
    // TULISAN penanda stok minus. Ditulis dengan teks, bukan hanya warna, supaya
    // tetap terbaca saat dicetak hitam-putih.
    tandaMinus: "Minus",
    keteranganMinus: "Sisa bahan di bawah 0, berarti bahan tidak cukup.",
    kosong: "Belum ada pemakaian bahan.",
  },

  // Daftar order.
  daftarOrder: {
    judul: "Daftar order",
    kolom: {
      nomorAntrean: "No",
      nama: "Nama",
      asal: "Asal",
      metodeBayar: "Bayar",
      item: "Item",
      total: "Total",
      status: "Status",
      jamKonfirmasi: "Jam",
    },
    // Pola kalimat satu baris item: "2 x Americano (less sugar)".
    formatItem: "{jumlah} x {nama}",
    formatItemDenganCatatan: "{jumlah} x {nama} ({catatan})",
    // Label jam konfirmasi. {jam} diisi jam WIB dua digit.
    formatJamWib: "{jam} WIB",
    // Dipakai kalau order belum punya jam konfirmasi (mis. masih menunggu
    // konfirmasi).
    belumAdaJam: "-",
    // Label tambahan untuk order yang waktunya diketik manual dari catatan
    // kertas (cadangan kalau internet putus).
    labelWaktuManual: "Waktu manual",
    // Status order, ditulis lengkap supaya angka di Riwayat tidak ambigu.
    status: {
      menungguKonfirmasi: "Menunggu konfirmasi",
      antrean: "Di antrean",
      dikerjakan: "Sedang dibuat",
      selesai: "Selesai",
      dibatalkan: "Dibatalkan",
      tidakDiketahui: "Status tidak diketahui",
    },
    // Tambahan di bawah baris order yang dibatalkan.
    // Pola kalimat: "Dibatalkan: {alasan}".
    teksDibatalkan: "Dibatalkan: {alasan}",
    // Ditulis di bawah nominal order yang dibatalkan supaya jelas nominal itu
    // sengaja tidak masuk hitungan total penjualan
    // (docs/api-contract.md bagian 4c).
    keteranganTidakDihitung: "Tidak dihitung di total",
    kosong: "Belum ada pesanan.",
  },

  // Label alasan pembatalan di laporan.
  //
  // Kunci di sini HARUS sama dengan ALASAN_BATAL di src/lib/alasan-batal.ts
  // (yang juga sama dengan enum order_cancel_reason di database). Tipe labelnya
  // diambil dari daftar itu, jadi menambah alasan baru akan membuat TypeScript
  // menandai file ini sampai labelnya ditambahkan.
  //
  // Ditulis manual (bukan otomatis dengan huruf kapital) supaya kalimatnya
  // mengikuti bahasa laporan.
  alasanBatal: {
    label: {
      stok_habis: "Stok habis",
      pembayaran_tidak_diterima: "Pembayaran tidak diterima",
      diminta_customer: "Diminta customer",
      pesanan_ganda: "Pesanan ganda",
      salah_input: "Salah input",
      lainnya: "Lainnya",
    } satisfies Record<AlasanBatal, string>,
    // Dipakai kalau order dibatalkan tapi alasannya kosong (mis. order lama yang
    // dibatalkan sebelum alasan wajib ada). Tanpa teks cadangan, baris akan
    // terbaca "Dibatalkan: " dan tidak menjelaskan apa pun.
    tanpaAlasan: "tanpa alasan tercatat",
  },

  // Judul halaman detail satu laporan tersimpan.
  detail: {
    // Pola kalimat tanggal disimpan. {waktu} diisi tanggal dan jam WIB.
    teksDisimpanPada: "Disimpan pada {waktu}",
    // Dipakai kalau laporan tidak ditemukan (id salah atau sudah tidak ada).
    tidakDitemukanJudul: "Laporan tidak ditemukan",
    tidakDitemukanPesan:
      "Laporan ini tidak ada. Mungkin id-nya salah, atau laporan itu belum pernah disimpan.",
    // Tautan kembali ke daftar Riwayat.
    kembaliKeRiwayat: "Kembali ke daftar Riwayat",
  },

  // Kolom daftar Riwayat.
  riwayat: {
    kolom: {
      tanggal: "Tanggal",
      waktuDisimpan: "Disimpan",
      orderTerhitung: "Order",
      totalPenjualan: "Total penjualan",
    },
    // Pola kalimat tanggal + waktu untuk satu baris riwayat.
    formatTanggal: "{tanggal}, {waktu}",
  },

  // Bagian atas halaman saat sedang mencetak (hanya terlihat di kertas).
  cetak: {
    // Pola kalimat judul cetak. {tanggal} diisi tanggal laporan, misal
    // "11 Oktober 2026".
    judul: "Theodore Coffee - Laporan {tanggal}",
    // Pola kalimat waktu pencetakan. {waktu} diisi tanggal dan jam WIB.
    waktu: "Dicetak pada {waktu}",
  },
} as const;
