// File ini: semua angka jeda pemuatan ulang (polling) untuk area customer.
//
// Kenapa dikumpulkan di satu file: kalau angkanya ditulis di dalam masing-masing
// hook, satu perubahan bisa terlewat di satu tempat dan tidak terdeteksi (sama
// seperti src/features/cashier/polling.ts dan src/features/barista/polling.ts).
//
// Nilai di sini mengikuti docs/api-contract.md bagian 5.

/**
 * Jeda polling status pesanan di halaman status customer: 5 detik (5000 ms).
 *
 * Halaman status harus cepat karena customer sedang menunggu tahu apakah
 * pesanan sudah dikonfirmasi atau selesai.
 */
export const POLLING_STATUS_MS = 5000;

/**
 * Jeda muat ulang daftar menu di halaman pesan: 30 detik (30000 ms).
 *
 * Lambat karena daftar menu jarang berubah, dan halaman pesan bisa dibiarkan
 * terbuka lama di HP customer (hemat baterai dan kuota). Pemuatan ulang hanya
 * berjalan saat tab terlihat (docs/api-contract.md bagian 5).
 */
export const POLLING_MENU_MS = 30000;
