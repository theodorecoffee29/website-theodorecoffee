// File ini: mengubah status order dari server menjadi teks yang dilihat customer.
//
// Kenapa dipisah: customer hanya melihat empat teks (Menunggu konfirmasi, Sedang
// dibuat, Pesanan selesai, Dibatalkan), padahal sistem punya lima status
// (docs/order-flow.md bagian 1). Pemetaan itu harus ada di satu tempat supaya
// tidak ada halaman yang menampilkan status mentah ke pengguna.
//
// File ini MURNI (tanpa server), jadi bisa diuji langsung.

// Status yang mungkin dikirim server.
export type StatusOrder =
  | "menunggu_konfirmasi"
  | "antrean"
  | "dikerjakan"
  | "selesai"
  | "dibatalkan";

// Status yang berarti order sudah tidak berjalan lagi. Setelah sampai di sini,
// order dibuang dari daftar order aktif.
const STATUS_AKHIR = ["selesai", "dibatalkan"] as const;

/**
 * Mengubah status order menjadi teks untuk customer.
 *
 * Input: status dari server.
 * Output: teks yang tampil, sesuai docs/order-flow.md bagian 1:
 *   - menunggu_konfirmasi -> "Menunggu konfirmasi"
 *   - antrean dan dikerjakan -> "Sedang dibuat" (customer tidak perlu tahu
 *     bedanya masih antrean atau sedang dibuat)
 *   - selesai -> "Pesanan selesai"
 *   - dibatalkan -> "Dibatalkan"
 *
 * Kalau statusnya tidak dikenal, teks cadangan dipakai supaya halaman tidak kosong.
 */
export function teksStatus(status: string): string {
  switch (status) {
    case "menunggu_konfirmasi":
      return "Menunggu konfirmasi";
    case "antrean":
    case "dikerjakan":
      return "Sedang dibuat";
    case "selesai":
      return "Pesanan selesai";
    case "dibatalkan":
      return "Dibatalkan";
    default:
      return "Status tidak diketahui";
  }
}

/**
 * Menentukan apakah order masih berjalan (aktif) atau sudah selesai.
 *
 * Output: true kalau masih aktif (menunggu_konfirmasi, antrean, dikerjakan).
 *
 * Kenapa penting: daftar order aktif di halaman awal dibangun dari status ini.
 * Order yang selesai, dibatalkan, atau tidak ditemukan TIDAK ikut ditampilkan.
 *
 * Cara kerja: hanya tiga status di bawah yang dianggap aktif. Status yang tidak
 * dikenal dianggap TIDAK aktif, supaya order yang tidak bisa dipastikan tidak
 * ikut menawarinya.
 */
export function statusMasihAktif(status: string): boolean {
  // Daftar status yang berarti order SEDANG BERJALAN.
  const statusBerjalan = ["menunggu_konfirmasi", "antrean", "dikerjakan"];
  return statusBerjalan.includes(status);
}

/**
 * Memeriksa apakah status order sudah final (tidak akan berubah lagi).
 *
 * Output: true kalau statusnya "selesai" atau "dibatalkan".
 *
 * Dipakai untuk menghentikan polling di halaman status: setelah status final,
 * tidak ada gunanya menanyakan lagi.
 */
export function statusSudahFinal(status: string): boolean {
  return (STATUS_AKHIR as readonly string[]).includes(status);
}

/**
 * Memeriksa apakah customer boleh membatalkan pesanan sendiri.
 *
 * Output: true HANYA kalau statusnya masih menunggu_konfirmasi
 *         (docs/order-flow.md bagian 3: customer hanya boleh membatalkan
 *         sebelum konfirmasi).
 *
 * Tombol "Batalkan pesanan" hanya ditampilkan kalau fungsi ini true.
 */
export function customerBolehBatalkan(status: string): boolean {
  return status === "menunggu_konfirmasi";
}