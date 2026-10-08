// File ini: mengubah pilihan jam dan menit Cashier menjadi waktu ISO yang bisa
// dikirim ke server.
//
// MASALAH YANG DIPERIKSA: laptop Cashier belum tentu punya zona waktu WIB.
// Komputer bisa diset ke UTC, atau zona lain. Kalau kita memakai cara biasa
// (seperti new Date().getHours()), hasilnya ikut zona komputer, bukan WIB.
// Kalau Cashier melihat jam 09:00 lalu memilih 09:00, server bisa menerima 02:00
// (kalau komputernya UTC). Itu salah satu jam.
//
//
// CARA KERJA DI SINI: kita TIDAK pernah memakai jam lokal komputer. Steps-nya:
//
//   1. Ambil tanggal HARI INI dalam zona WIB (lewat Intl, bukan jam lokal).
//   2. Gabungkan tanggal itu dengan jam dan menit yang dipilih Cashier.
//   3. Tambahkan offset +07:00 secara TEKS, bukan lewat konversi zona.
//
// Hasilnya selalu waktu WIB yang benar, apa pun zona waktu komputer.
//
// File ini MURNI (tanpa React dan tanpa API), jadi mudah diuji.

// Zona waktu Indonesia Barat. Selisihnya selalu 7 jam dari UTC (Indonesia tidak
// memakai jam daylight saving, jadi tidak pernah berubah).
export const OFFSET_WIB = "+07:00";

// Jumlah jam selisih WIB dari UTC (7 jam).
const SELISIH_JAM_WIB = 7;

/**
 * Mengubah jam dan menit pilihan Cashier menjadi waktu ISO untuk HARI INI WIB.
 *
 * Input:
 *   - jam: angka 0-23 (hasil pilihan Cashier),
 *   - menit: angka 0-59,
 *   - sekarang: waktu saat ini. Dipakai untuk menentukan tanggal hari ini.
 *   Parameter ini ada supaya fungsi ini mudah diuji tanpa bergantung jam
 *   sungguhan. Kalau tidak diisi, memakai waktu sekarang.
 * Output: string waktu ISO dengan offset +07:00, contoh
 *         "2026-10-08T09:15:00+07:00". Kalau jam atau menit di luar batas,
 *         hasilnya null.
 *
 * Kenapa tanggalnya selalu HARI INI: input order MANUAL hanya boleh berisi waktu
 * di hari berjalan (WIB) dan tidak di masa depan
 * (docs/api-contract.md bagian 4, create_manual_order). Jadi Cashier tidak
 * boleh memilih tanggal; hanya jam dan menitnya.
 *
 * Kenapa offset ditulis sebagai teks: kalau kita menulis "09:15" lalu meminta
 * JavaScript mengonversinya ke waktu, konversi itu memakai zona komputer.
 * Dengan menulis offset-nya sendiri (+07:00), tidak ada konversi sama sekali,
 * hasilnya pasti WIB.
 */
export function waktuIsoDariJamMenit(
  jam: number,
  menit: number,
  sekarang: Date = new Date(),
): string | null {
  // Cek batas jam dan menit. Nilai di luar ini bukan waktu yang masuk akal.
  if (!Number.isInteger(jam) || jam < 0 || jam > 23) {
    return null;
  }
  if (!Number.isInteger(menit) || menit < 0 || menit > 59) {
    return null;
  }

  // Tanggal hari ini menurut WIB (bukan tanggal lokal komputer).
  const hariIniWib = tanggalHariIniWib(sekarang);

  // Zero-pad: jam dan menit harus dua digit (09:05, bukan 9:5).
  const jamDua = String(jam).padStart(2, "0");
  const menitDua = String(menit).padStart(2, "0");

  // Detik dan milidetik selalu 00, karena Cashier memilih per menit.
  return hariIniWib + "T" + jamDua + ":" + menitDua + ":00" + OFFSET_WIB;
}

/**
 * Memeriksa apakah waktu ISO pilihan Cashier boleh dikirim.
 *
 * Input: string waktu ISO dari waktuIsoDariJamMenit (boleh null), dan waktu
 *        sekarang (opsional, untuk pengujian).
 * Output: null kalau boleh, atau teks alasan kalau tidak boleh.
 *
 * Aturan (docs/api-contract.md bagian 4): waktu manual hanya boleh di hari
 * berjalan (WIB) dan tidak boleh di masa depan.
 *
 * Kenapa "masa depan" dilarang: pesanan belum terjadi, jadi tidak mungkin punya
 * waktu kejadian di masa depan.
 */
export function cekWaktuManual(
  waktuIso: string | null,
  sekarang: Date = new Date(),
): string | null {
  //nol: sementaraJam tidak valid, jadi sudah gagal di langkah sebelumnya.
  if (waktuIso === null) {
    return "Waktu manual belum lengkap.";
  }

  const waktu = new Date(waktuIso);

  // new Date("bukan waktu") menghasilkan Invalid Date.
  if (Number.isNaN(waktu.getTime())) {
    return "Waktu manual tidak valid.";
  }

  // Aturan 1: tidak boleh di masa depan. Toleransi kecil dipakai supaya pilihan
  // menit yang SEDANG berjalan tidak dianggap masa depan karena detik-detiknya
  // sudah lewat sedikit.
  if (waktu.getTime() > sekarang.getTime() + TOLERANSI_DETIK * 1000) {
    return "Waktu manual tidak boleh di masa depan.";
  }

  // Aturan 2: harus di hari yang sama dengan hari ini menurut WIB.
  if (tanggalWibDariWaktu(waktu) !== tanggalHariIniWib(sekarang)) {
    return "Waktu manual harus di hari ini (WIB).";
  }

  // Semua aturan lolos.
  return null;
}

// Toleransi detik untuk mengecek "masa depan". Cashier memilih jam dan menit, jadi
// waktu yang dipilih bisa beberapa detik lalu tidak yang sedang berjalan. Tanpa
// toleransi, memilih menit yang sedang berjalan akan dianggap masa depan.
const TOLERANSI_DETIK = 60;

/**
 * Mengembalikan tanggal hari ini menurut zona WIB, sebagai teks "YYYY-MM-DD".
 *
 * Input: waktu saat ini.
 * Output: teks tanggal, contoh "2026-10-08".
 *
 * Cara kerja: geser waktu sebesar 7 jam, lalu ambil bagian tanggalnya. Setelah
 * digeser, nilai yang tadinya UTC berubah jadi waktu WIB, jadi tanggalnya juga
 * sudah tanggal WIB.
 *
 * Kenapa memakai geser 7 jam, bukan Intl: cara ini tidak bergantung pada locale
 * atau dukungan Intl di server, dan hasilnya selalu bentuk YYYY-MM-DD yang
 * persis yang dibutuhkan untuk menyusun string ISO.
 */
function tanggalHariIniWib(sekarang: Date): string {
  return tanggalWibDariWaktu(sekarang);
}

/**
 * Mengubah satu waktu menjadi tanggal WIB "YYYY-MM-DD".
 *
 * Input: objek waktu.
 * Output: teks tanggal dalam zona WIB.
 */
function tanggalWibDariWaktu(waktu: Date): string {
  const dalamWib = new Date(waktu.getTime() + SELISIH_JAM_WIB * 60 * 60 * 1000);

  // toISOString menghasilkan bentuk "2026-10-08T02:00:00.000Z". Karena waktu
  // sudah digeser 7 jam ke WIB, bagian tanggalnya adalah tanggal WIB.
  return dalamWib.toISOString().slice(0, 10);
}
