// File ini: semua angka jeda polling untuk area Cashier dalam satu tempat.
//
// Kenapa dikumpulkan di satu file: nilai polling pernah diubah beberapa kali
// (mis. dari 3 detik jadi 2 detik). Kalau angkanya ditulis di dalam masing-masing
// hook, satu perubahan bisa terlewat di satu tempat dan tidak terdeteksi.
//
// Nilai di sini mengikuti docs/api-contract.md bagian 5.

/**
 * Jeda polling daftar pesanan Cashier: 2 detik (2000 ms).
 *
 * Cashier butuh cepat karena ada notifikasi pesanan baru dan karena dua
 * Cashier bisa bekerja pada order yang sama (docs/order-flow.md bagian 6).
 */
export const POLLING_DAFTAR_PESANAN_MS = 2000;

/**
 * Jeda polling panel sisa stok di layar Cashier: 5 detik (5000 ms).
 *
 * Sisa stok bukan hal yang berubah tiap detik, jadi pollingnya lebih lambat
 * daripada daftar pesanan.
 */
export const POLLING_SISA_STOK_MS = 5000;
