// File ini: mengubah tanggal dan waktu dari database menjadi teks yang enak
// dibaca orang Indonesia dalam zona waktu WIB.
//
// KENAPA PERLU: database menyimpan waktu absolut dengan zona (timestamptz), dan
// tanggal hari (queue_date) dihitung dalam zona WIB. Laptop Cashier belum tentu
// punya zona WIB, jadi kalau waktu ditampilkan mentah, penampilannya bisa
// berbeda dari yang biasa dipakai. Ini masalah yang sama seperti di halaman
// Cashier (src/features/cashier/waktu-wib.ts) dan area Admin
// (src/features/admin/stok/waktu.ts); file ini disalin supaya area Laporan
// tidak bergantung pada file area lain.
//
// File ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.

import { formatStokIndonesia } from "@/features/stok/format";

// Zona waktu Indonesia Barat.
export const ZONA_WIB = "Asia/Jakarta";

/**
 * Mengubah teks tanggal "YYYY-MM-DD" menjadi tanggal panjang gaya Indonesia.
 *
 * Input: teks tanggal dari database atau isi laporan, mis. "2026-10-11".
 * Output: teks seperti "11 Oktober 2026". Kalau tanggalnya tidak terbaca,
 *         hasilnya string kosong supaya tampilan tidak menampilkan
 *         "Invalid Date".
 *
 * CARA KERJA YANG DIPILIH DAN ALASANNYA:
 *   new Date("2026-10-11") dibaca sebagai tengah malam zona waktu MESIN. Kalau
 *   mesin ada di UTC dan lalu diformat dengan zona WIB, tanggalnya bisa
 *   bergeser satu hari (tengah malam UTC = jam 7 pagi WIB, masih hari yang sama;
 *   tapi kalau ever ditafsirkan lain, bisa jadi tanggal sebelumnya). Supaya
 *   tidak bergantung pada zona mesin sama sekali, teksnya dipecah sendiri lalu
 *   dibuat sebagai tanggal tengah malam UTC, dan diformat dengan zona UTC.
 *   Hasilnya pasti tanggal yang ditulis di database.
 */
export function tanggalPanjang(tanggal: string): string {
  const bagian = pecahTanggal(tanggal);

  if (bagian === null) {
    return "";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(bagian);
}

/**
 * Mengubah teks tanggal "YYYY-MM-DD" menjadi tanggal pendek "DD/MM/YYYY".
 *
 * Input: teks tanggal dari isi laporan, mis. "2026-10-11".
 * Output: "11/10/2026", atau string kosong kalau tanggalnya tidak terbaca.
 *
 * Dipakai di daftar Riwayat, yang ruangnya sempit sehingga tanggal panjang
 * membuat tabel jadi lebar.
 */
export function tanggalPendek(tanggal: string): string {
  const bagian = pecahTanggal(tanggal);

  if (bagian === null) {
    return "";
  }

  const hari = String(bagian.getUTCDate()).padStart(2, "0");
  const bulan = String(bagian.getUTCMonth() + 1).padStart(2, "0");

  return hari + "/" + bulan + "/" + bagian.getUTCFullYear();
}

/**
 * Mengubah waktu dari database (timestamptz) menjadi jam WIB.
 *
 * Input: teks waktu dari database, mis. "2026-10-12T17:05:00+00:00" (tiga pagi
 *        WIB tanggal 12 Oktober).
 * Output: jam WIB dua digit, mis. "03.05". Kalau waktunya tidak terbaca,
 *         hasilnya string kosong.
 *
 * CATATAN SOAL PEMBATAS JAM: locale id-ID memisahkan jam dan menit dengan TITIK
 * ("09.15"), bukan titik dua ("09:15"). Ini dipakai supaya jam tampil sama persis
 * dengan halaman Cashier (src/features/cashier/waktu-wib.ts) dan halaman Stok
 * Admin, jadi orang tidak melihat dua bentuk jam yang berbeda di aplikasi yang sama.
 *
 * Cara kerja: dipakai Intl.DateTimeFormat dengan timeZone "Asia/Jakarta".
 * Intl sudah tahu cara mengubah waktu ke zona lain, jadi tidak perlu menghitung
 * selisih jam manual.
 */
export function jamWib(waktu: string): string {
  const tanggal = new Date(waktu);

  // new Date("bukan waktu") menghasilkan Invalid Date, jadi harus dicek dulu.
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

/**
 * Mengubah waktu dari database menjadi tanggal dan jam WIB sekaligus.
 *
 * Input: teks waktu timestamptz dari database.
 * Output: teks seperti "12 Oktober 2026, 03.05". Kalau waktunya tidak terbaca,
 *         hasilnya string kosong.
 *
 * Dipakai untuk kalimat "Disimpan pada [waktu]" di halaman detail laporan dan
 * untuk baris waktu pencetakan.
 *
 * KENAPA TIDAK SEKALIGUS DIMINTA TANGGAL DAN JAM DARI SATU PANGGILAN Intl:
 * locale id-ID menyelipkan kata "pukul" di antara tanggal dan jam
 * ("12 Oktober 2026 pukul 03.05"). Kalimat itu sebenarnya lebih enak dibaca, tapi
 * laporan ini ikut dicetak jadi dokumen dan hasil pemformatan bisa berubah antar
 * versi Node. Supaya kalimatnya selalu sama persis, tanggal dan jam diformat
 * sendiri lalu digabung dengan koma di sini.
 */
export function tanggalJamWib(waktu: string): string {
  const tanggal = new Date(waktu);

  if (Number.isNaN(tanggal.getTime())) {
    return "";
  }

  const tanggalSaja = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONA_WIB,
  }).format(tanggal);

  return tanggalSaja + ", " + jamWib(waktu);
}

/**
 * Mengubah angka takaran atau jumlah menjadi teks gaya Indonesia.
 *
 * File ini TIDAK membuat pemformat angka baru. Ia memakai pemformat angka yang
 * sudah dipakai bersama di src/features/stok/format.ts, supaya angka stok bahan
 * (mis. 12.500 gram, 0,25 ml) tampil persis sama seperti di panel sisa stok
 * Cashier dan di halaman Stok Admin.
 *
 * Input: angka, atau teks angka dari database (jsonb), atau apa pun yang tidak
 *        bisa dibaca (jadi 0).
 */
export function formatJumlah(nilai: unknown): string {
  return formatStokIndonesia(keAngka(nilai));
}

/**
 * Mengubah nilai apa pun menjadi angka.
 *
 * Output: angka, atau 0 kalau nilainya bukan angka yang bisa dibaca.
 *
 * Angka dari database (jsonb) bisa datang sebagai teks, jadi string angka juga
 * diterima. Koma sebagai pemisah desimal ikut diterima karena itu yang biasa dipakai
 * orang Indonesia ("0,25").
 */
function keAngka(nilai: unknown): number {
  if (typeof nilai === "number") {
    return Number.isFinite(nilai) ? nilai : 0;
  }

  if (typeof nilai === "string") {
    const bersih = nilai.trim().replace(",", ".");
    if (bersih === "") {
      return 0;
    }
    const hasil = Number(bersih);
    return Number.isFinite(hasil) ? hasil : 0;
  }

  return 0;
}

/**
 * Memecah teks tanggal "YYYY-MM-DD" menjadi objek Date tengah malam UTC.
 *
 * Output: objek Date, atau null kalau teksnya bukan tanggal yang wajar.
 */
function pecahTanggal(tanggal: string): Date | null {
  const bagian = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal.trim());

  if (bagian === null) {
    return null;
  }

  const tahun = Number(bagian[1]);
  const bulan = Number(bagian[2]);
  const hari = Number(bagian[3]);

  // Tolak tanggal yang tidak ada di kalender, misalnya "2026-02-31".
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) {
    return null;
  }

  return new Date(Date.UTC(tahun, bulan - 1, hari));
}
