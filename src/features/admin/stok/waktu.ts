// File ini: mengubah waktu dari database (timestamptz) menjadi jam WIB.
//
// KENAPA PERLU: database menyimpan waktu absolut dengan zona. Laptop Admin belum
// tentu punya zona WIB, jadi kalau jamnya ditampilkan mentah, penampilannya bisa
// berbeda dari jam yang biasa dipakai. Ini masalah yang sama seperti di halaman
// Cashier (src/features/cashier/waktu-wib.ts); file ini disalin supaya area
// Admin tidak bergantung pada file area lain.
//
// File ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.

// Zona waktu Indonesia Barat.
export const ZONA_WIB = "Asia/Jakarta";

/**
 * Mengubah waktu dari database menjadi jam WIB untuk ditampilkan di riwayat.
 *
 * Input: teks waktu timestamptz dari database, mis. "2026-10-08T09:15:00+07:00".
 * Output: jam WIB dua digit, mis. "09.15". Kalau waktunya tidak terbaca,
 *         hasilnya string kosong supaya tidak tampil "Invalid Date".
 *
 * Cara kerja: dipakai Intl.DateTimeFormat dengan timeZone "Asia/Jakarta".
 */
export function jamWibStok(waktu: string): string {
  const tanggal = new Date(waktu);

  // new Date("bukan waktu") menghasilkan Invalid Date, jadi harus dicek sebelum
  // diformat.
  if (Number.isNaN(tanggal.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    // Jam 24-jam (14:30), bukan 12-jam (02:30 PM).
    hour12: false,
    timeZone: ZONA_WIB,
  }).format(tanggal);
}
