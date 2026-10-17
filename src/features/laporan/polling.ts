// File ini: semua angka jeda pemuatan ulang (polling) untuk area Laporan dalam
// satu tempat.
//
// Kenapa dikumpulkan di satu file: nilai polling pernah diubah beberapa kali
// (mis. dari 3 detik jadi 2 detik). Kalau angkanya ditulis di dalam hook, satu
// perubahan bisa terlewat di satu tempat dan tidak terdeteksi. Pola yang sama
// dipakai di src/features/cashier/polling.ts,
// src/features/barista/polling.ts, dan src/features/customer/polling.ts.
//
// CATATAN: docs/api-contract.md bagian 5 belum punya baris untuk laporan
// (tabel itu dibuat sebelum halaman laporan ada). Angka 10 detik di sini
// disamakan dengan "Sisa stok di Barista", yang juga 10 detik, karena laporan
// bukan layar yang butuh perubahan tiap detik: laporan hari ini dipakai untuk
// melihat ringkasan penjualan dan mencocokkan uang di akhir acara. Angka ini
// sudah paling lambat di semua layar.
//
// CATATAN KEDUA: bagian "Riwayat" TIDAK memakai polling sama sekali. Riwayat
// hanya berubah saat pergantian hari (laporan baru disimpan otomatis), jadi
// memuat ulang berkala hanya membebani server tanpa memberi informasi baru.

/**
 * Jeda polling laporan "Hari ini": 10 detik (10000 ms).
 *
 * Poll HANYA berjalan selama tab browser terlihat, dan dimatikan saat tab
 * disembunyikan (lihat src/features/laporan/use-laporan-hari-ini.ts).
 */
export const POLLING_LAPORAN_HARI_INI_MS = 10000;
