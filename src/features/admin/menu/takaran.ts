// File ini: mengubah teks takaran yang diketik Admin menjadi angka, dan
// sebaliknya.
//
// MASALAH YANG DIPERIKSA: untuk Locale Indonesia, orang biasa menulis "0,25"
// (koma sebagai pemisah desimal). Tapi pemrograman memakai titik
// ("0.25"). Kalau teksnya langsung dikirim ke server tanpa diubah, "0,25"
// akan ditolak zod karena bukan angka.
//
// File ini karena itu mengganti koma menjadi titik SEBELUM menguji dan
// mengirim. Cara ini dipakai juga untuk isian lain di proyek ini.
//
// File ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.

// Batas takaran (docs/api-contract.md bagian 4b): kolomnya numeric(12,3).
// Máximo 3 angka di belakang koma, lebih dari 0, dan tidak lebih dari 1.000.000.
export const MAKSIMAL_TAKARAN = 1000000;
export const MAKSIMAL_DESIMAL = 3;

// Hasil pemeriksaan takaran: valid atau tidak, plus pesan kalau tidak valid.
export type HasilTakaran = { valid: boolean; pesan: string | null };

// Pola kalimat untuk pesan, supaya file ini tidak bergantung pada teks.ts
// (biaya impor) dan mudah dipakai ulang.
type PesanTakaran = {
  wajib: string;
  positif: string;
  desimal: string;
  maks: string;
};

/**
 * Membersihkan teks takaran: mengganti koma menjadi titik dan membuang spasi.
 *
 * Input: teks takaran dari isian.
 * Output: teks yang siap diuji dan dikirim.
 *
 * Kenapa koma diganti titik: di Locale Indonesia koma adalah pemisah desimal
 * ("0,25"), sedangkan JavaScript dan server memakai titik ("0.25"). Kalau tidak
 * diganti, "0,25" akan dianggap bukan angka.
 *
 * Kenapa semua spasi dibuang: takaran tidak pernah butuh spasi ("0. 25" tidak
 * bermakna), dan spasi di awal/akhir sering tidak sengaja ikut terpotong.
 */
export function bersihkanTakaran(teks: string): string {
  return teks.replace(/,/g, ".").replace(/\s/g, "");
}

/**
 * Memeriksa apakah teks takaran boleh dipakai.
 *
 * Input: teks takaran dari isian, dan teks pesan untuk tiap jenis kesalahan.
 * Output: HasilTakaran.
 *
 * Aturan (docs/api-contract.md bagian 4b):
 *   1. Wajib diisi.
 *   2. Harus berupa angka setelah koma diganti titik.
 *   3. Lebih dari 0 (takaran 0 tidak masuk akal: bahan dengan takaran 0 berarti
 *      bahan itu tidak dipakai).
 *   4. Paling banyak 3 angka di belakang koma (kolomnya numeric(12,3); kalau
 *      lebih, nilainya akan dipotong diam-diam oleh database).
 *   5. Tidak lebih dari 1.000.000 (menjaga nilai yang tidak wajar tidak masuk).
 */
export function cekTakaran(teks: string, pesan: PesanTakaran): HasilTakaran {
  const bersih = bersihkanTakaran(teks);

  // 1. Wajib diisi.
  if (bersih === "") {
    return { valid: false, pesan: pesan.wajib };
  }

  // 2. Harus angka: hanya digit dan paling banyak satu titik desimal.
  //    Pola ini sekaligus menolak "1.2.3", "-1", dan "abc".
  if (!/^[0-9]*\.?[0-9]*$/.test(bersih) || bersih === ".") {
    return { valid: false, pesan: pesan.positif };
  }

  // 3. Lebih dari 0.
  const angka = Number(bersih);
  if (!Number.isFinite(angka) || angka <= 0) {
    return { valid: false, pesan: pesan.positif };
  }

  // 4. Paling banyak 3 angka di belakang koma.
  if (bersih.includes(".")) {
    const bagianDesimal = bersih.split(".")[1] ?? "";
    if (bagianDesimal.length > MAKSIMAL_DESIMAL) {
      return { valid: false, pesan: pesan.desimal };
    }
  }

  // 5. Tidak lebih dari 1.000.000.
  if (angka > MAKSIMAL_TAKARAN) {
    return { valid: false, pesan: pesan.maks };
  }

  return { valid: true, pesan: null };
}

/**
 * Mengubah teks takaran yang valid menjadi angka.
 *
 * Input: teks takaran dari isian.
 * Output: angka, atau 0 kalau teksnya tidak valid.
 *
 * Dipakai saat mengirim ke server: yang dikirim harus angka, bukan teks.
 * Memakai bersihkanTakaran dulu supaya koma diperlakukan sebagai titik.
 */
export function takaranJadiAngka(teks: string): number {
  const bersih = bersihkanTakaran(teks);
  const angka = Number(bersih);

  return Number.isFinite(angka) ? angka : 0;
}

/**
 * Mengubah angka takaran menjadi teks untuk ditampilkan di kolom isian.
 *
 * Input: angka takaran.
 * Output: teks, misal 0.25 menjadi "0.25".
 *
 * Kenapa titik, bukan koma: kolom isian adalah <input type="number">, yang
 * hanya menerima format dengan titik. Kalau diisi koma, browser akan
 * menganggap isian itu tidak valid dan menandainya merah.
 */
export function takaranJadiTeks(angka: number): string {
  if (!Number.isFinite(angka)) {
    return "";
  }

  // String() sudah menghasilkan bentuk yang paling ringkas: 0.25 jadi "0.25",
  // dan 20 jadi "20" (bukan "20.00").
  return String(angka);
}
