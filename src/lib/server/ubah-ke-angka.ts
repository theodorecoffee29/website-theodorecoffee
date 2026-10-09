// File ini: mengubah angka dari database (numeric) menjadi angka JavaScript.
//
// KENAPA PERLU: kolom numeric di PostgreSQL (stock_qty, qty_per_portion,
// qty_change, stock_after) tidak selalu sampai ke browser sebagai angka.
// Supabase/PostgREST bisa mengirimnya sebagai TEKS, misalnya "5000.000" atau
// "-12.500". Kalau teks itu dipakai langsung di perhitungan JavaScript, hasilnya
// salah diam-diam (mis. "5000" + "10" jadi "500010").
//
// File ini MURNI (tanpa database), jadi bisa diuji langsung.

/**
 * Mengubah nilai dari database menjadi angka.
 *
 * Input: nilai apa pun yang mungkin diterima (angka, teks angka, atau null).
 * Output: angka. Kalau nilainya tidak bisa dibaca, hasilnya nilai cadangan.
 *
 * Cara kerja:
 *   1. Kalau sudah angka dan valid, dipakai langsung.
 *   2. Kalau teks, teks itu diubah menjadi angka. Spasi di awal/akhir diabaikan.
 *   3. Kalau tidak bisa dibaca (null, teks, undefined), nilai cadangan dipakai.
 *
 * Kenapa ada nilai cadangan: lebih baik menampilkan 0 daripada membuat halaman
 * error karena satu angka tidak terbaca. Nilai yang tidak terbaca juga akan
 * tercatat lewat logError di pemanggilnya.
 */
export function ubahKeAngka(nilai: unknown, cadangan = 0): number {
  // Sudah berupa angka dan bukan NaN maupun Infinity: pakai langsung.
  if (typeof nilai === "number") {
    if (Number.isFinite(nilai)) {
      return nilai;
    }
    return cadangan;
  }

  // Teks (dari numeric PostgreSQL) diubah menjadi angka.
  if (typeof nilai === "string") {
    const teks = nilai.trim();

    // Teks kosong tidak bisa dihitung.
    if (teks === "") {
      return cadangan;
    }

    const angka = Number(teks);
    if (Number.isFinite(angka)) {
      return angka;
    }
  }

  // null, undefined, boolean, objek: tidak bisa dipakai.
  return cadangan;
}

/**
 * Mengubah nilai dari database menjadi angka bulat (dipakai untuk nomor antrean
 * dan nomor baris).
 *
 * Input: nilai apa pun.
 * Output: bilangan bulat, atau nilai cadangan kalau tidak terbaca.
 *
 * Kenapa perlu pembulatan: kolom integer di database tidak mungkin pecahan, tapi
 * kalau tetap dipanggil ubahKeAngka langsung, hasilnya tetap berupa float
 * (mis. 7 bukan 7.0). Round memastikan hasilnya bilangan bulat.
 */
export function ubahKeBulat(nilai: unknown, cadangan = 0): number {
  return Math.round(ubahKeAngka(nilai, cadangan));
}

/**
 * Memeriksa apakah nilai dari database berarti negatif (stok minus).
 *
 * Input: nilai apa pun dari database.
 * Output: true kalau nilainya di bawah 0.
 *
 * Kenapa perlu: kolom stock_qty tidak punya batasan nol (stok boleh minus,
 * docs/data-model.md aturan 4), jadi Admin perlu tahu bahan mana yang minus.
 * Nilai 0 dianggap bukan negatif, karena 0 berarti habis, bukan kurang.
 */
export function nilaiNegatif(nilai: unknown): boolean {
  return ubahKeAngka(nilai, 0) < 0;
}

/**
 * Mengubah nilai dari database menjadi teks (dipakai untuk nama dan catatan).
 *
 * Input: nilai apa pun.
 * Output: teks. Kalau bukan teks, hasilnya string kosong.
 *
 * Kenapa tidak pakai String(nilai): kalau nilainya objek, hasilnya jadi
 * "[object Object]" (persis masalah yang sudah pernah terjadi pada error).
 */
export function ubahKeTeks(nilai: unknown): string {
  if (typeof nilai === "string") {
    return nilai;
  }
  return "";
}
