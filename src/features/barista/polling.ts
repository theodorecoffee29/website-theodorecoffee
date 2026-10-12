// File ini: semua angka jeda polling untuk area Barista dalam satu tempat.
//
// Kenapa dikumpulkan di satu file: nilai polling pernah diubah beberapa kali.
// Kalau angkanya ditulis di dalam masing-masing hook, satu perubahan bisa
// terlewat di satu tempat dan tidak terdeteksi.
//
// Nilai di sini mengikuti docs/api-contract.md bagian 5.

/**
 * Jeda polling antrean Barista: 2 detik (2000 ms).
 *
 * Barista butuh cepat karena pesanan baru harus segera terlihat, dan karena
 * beberapa Barista boleh aktif bersamaan (docs/order-flow.md bagian 6).
 */
export const POLLING_ANTREAN_MS = 2000;

/**
 * Jeda polling panel sisa stok di layar Barista: 10 detik (10000 ms).
 *
 * Jauh lebih lambat daripada polling antrean. Alasannya: Barista tidak memakai
 * panel sisa stok untuk memutuskan apa pun (hanya untuk menyiapkan bahan), jadi
 * tidak perlu sering mengambil data terbaru. Polling yang jarang juga menghemat
 * baterai laptop di booth.
 */
export const POLLING_SISA_STOK_MS = 10000;
