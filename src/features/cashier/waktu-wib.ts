// File ini: mengubah waktu dari database menjadi jam yang enak dibaca dalam zona
// WIB.
//
// Kenapa perlu: database menyimpan waktu dalam timestamptz, yaitu waktu absolut
// beserta zonanya. Kalau jamnya ditampilkan mentah, penampilannya bisa berbeda
// dari jam yang biasa dipakai Cashier. Cashier bekerja di Indonesia, jadi jam
// harus ditampilkan dalam WIB (Asia/Jakarta), sesuai aturan di AGENTS.md bahwa
// "waktu timestamptz, hari memakai WIB".
//
// File ini MURNI (tanpa React dan tanpa API), jadi mudah diuji.

// Zona waktu Indonesia Barat.
export const ZONA_WIB = "Asia/Jakarta";

/**
 * Mengubah waktu dari database menjadi teks jam WIB.
 *
 * Input: teks waktu timestamptz dari database, mis. "2026-10-08T09:15:00+07:00".
 * Output: jam WIB dua digit, mis. "09:15". Kalau waktunya tidak terbaca,
 *         hasilnya string kosong supaya tampilan tidak menampilkan
 *         "Invalid Date".
 *
 * Cara kerja: dipakai Intl.DateTimeFormat dengan timeZone "Asia/Jakarta".
 * Intl sudah tahu cara mengubah waktu ke zona lain, termasuk perbedaan jam
 * daylight di negara lain, jadi kita tidak perlu menghitung selisih jam manual.
 */
export function jamWib(waktu: string): string {
  const tanggal = buatTanggal(waktu);

  // Waktu tidak terbaca: kembalikan kosong, bukan teks error.
  if (tanggal === null) {
    return "";
  }

  return formatIntl().format(tanggal);
}

/**
 * Mengubah teks waktu menjadi objek Date.
 *
 * Output: Date, atau null kalau teksnya bukan waktu yang sah.
 *
 * Kenapa harus dicek: new Date("bukan waktu") tidak melempar error, dia
 * mengembalikan "Invalid Date". Kalau tidak dicek, formatIntl akan menghasilkan
 * teks aneh yang tampil di layar Cashier.
 */
function buatTanggal(waktu: string): Date | null {
  const tanggal = new Date(waktu);

  if (Number.isNaN(tanggal.getTime())) {
    return null;
  }

  return tanggal;
}

/**
 * Membuat objek format waktu untuk zona WIB.
 *
 * Dibuat lewat fungsi (bukan konstanta global) supaya zona waktu lokal mesin
 * Cashier tidak berpengaruh: yang menentukan adalah timeZone yang kita tulis,
 * bukan zona mesin.
 */
function formatIntl(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    // Jam 24-jam (14:30), bukan 12-jam (02:30 PM).
    hour12: false,
    timeZone: ZONA_WIB,
  });
}
