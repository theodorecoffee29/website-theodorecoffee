// File ini: mengubah angka stok menjadi teks Indonesia, dan sebaliknya.
//
// DUA KEBUTUHAN BERLAKUAN BERDAERAH:
//
// 1. FORMAT TAMPILAN. Angka stok ditampilkan gaya Indonesia: koma sebagai pemisah
//    desimal, titik sebagai pemisah ribuan, dan paling banyak 3 angka di
//    belakang koma. Nol di ujung dibuang ("5000.000" jadi "5.000", bukan
//    "5.000,000").
//
// 2. PEMARSEAN ISIAN. Angka yang diketik Admin boleh memakai koma ATAU titik
//    sebagai pemisah desimal, karena orang Indonesia biasa menulis "0,25".
//    Kolom di database bertipe numeric(12,3), jadi nilainya boleh maksimal 3
//    angka desimal dan tidak lebih dari 1.000.000.
//
// Kenapa koma dan titik tidak boleh bercampur bebas: "1.234" bisa berarti 1234
// (pemisah ribuan) atau 1.234 (satu koma desimal). Kalau keduanya diterima tanpa
// aturan, satu angka bisa berarti dua hal yang berbeda. Jadi di sini hanya satu
// pemisah yang dipakai setelah teks dibersihkan: titik (koma diganti titik).
//
// File ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.

// Batas nilai (docs/api-contract.md bagian 4b: kolomnya numeric(12,3)).
export const MAKSIMAL_NILAI = 1000000;
export const MAKSIMAL_DESIMAL = 3;

// Hasil pemeriksaan angka: valid atau tidak, plus pesan kalau tidak valid.
export type HasilAngka = { valid: boolean; pesan: string | null };

// Pola kalimat untuk pesan, supaya file ini tidak bergantung pada teks.ts.
type PesanAngka = {
  wajib: string;
  positif: string;
  nolBoleh: string;
  desimal: string;
  maks: string;
  tidakValid: string;
};

/**
 * Membersihkan teks angka menjadi format yang bisa dibaca JavaScript dan
 * database (titik untuk desimal, tanpa pemisah ribuan).
 *
 * Input: teks angka dari isian, mis. "1.234,5", "1.234", atau "1234.5".
 * Output: teks angka bersih, mis. "1234.5" atau "1234".
 *
 * Kenapa tidak bisa asal mengganti koma jadi titik: tulisan Indonesia memakai
 * titik untuk ribuan dan koma untuk desimal, jadi "1.234,5" punya KEDUA
 * karakter. Kalau keduanya diganti jadi titik, hasilnya "1.234.5" dan angka
 * itu tidak bisa dibaca sama sekali (hasilnya nol).
 *
 * Aturan yang dipakai:
 *   1. Kalau ada koma, koma adalah pemisah desimal dan titik adalah pemisah
 *      ribuan, jadi titiknya dibuang.
 *   2. Kalau tidak ada koma, titik dianggap pemisah ribuan HANYA kalau susunannya
 *      benar-benar seperti ribuan (kelompok tepat tiga angka, mis. "1.234").
 *      Kalau tidak, titik dianggap desimal (mis. "1234.5").
 */
export function bersihkanAngka(teks: string): string {
  // Spasi (termasuk spasi tipis yang kadang tersalin) dibuang lebih dulu.
  let bersih = teks.replace(/\s/g, "");

  const adaKoma = bersih.includes(",");

  if (adaKoma) {
    // Koma desimal jadi titik, titik ribuan dibuang.
    bersih = bersih.replace(/\./g, "").replace(",", ".");
    return bersih;
  }

  // Tanpa koma: titik hanya dianggap ribuan kalau bentuknya memang ribuan
  // (setiap kelompok di belakang titik tepat tiga angka, dan tidak ada titik
  // di depan angka).
  const polaRibuan = /^\d{1,3}(\.\d{3})+$/;

  if (polaRibuan.test(bersih)) {
    return bersih.replace(/\./g, "");
  }

  return bersih;
}

/**
 * Memeriksa apakah teks angka boleh dipakai.
 *
 * Input: teks angka dari isian, dan teks pesan untuk tiap jenis kesalahan.
 * Output: HasilAngka.
 *
 * Aturan:
 *   1. Wajib diisi.
 *   2. Harus berupa angka: hanya digit dan paling banyak satu titik desimal.
 *      Negatif, huruf, dan titik ganda ditolak.
 *   3. Harus lebih dari 0, KECUALI kalau bolehNol bernilai true. Stok awal dan
 *      jumlah hasil hitung boleh nol (artinya habis), sedangkan jumlah
 *      penambahan stok harus lebih dari 0 (artinya tidak menambah apa pun).
 *   4. Paling banyak 3 angka di belakang koma (kolomnya numeric(12,3); kalau
 *      lebih, nilainya dipotong diam-diam oleh database).
 *   5. Tidak lebih dari 1.000.000.
 */
export function cekAngka(
  teks: string,
  pesan: PesanAngka,
  bolehNol: boolean,
): HasilAngka {
  const bersih = bersihkanAngka(teks);

  // 1. Wajib diisi.
  if (bersih === "") {
    return { valid: false, pesan: pesan.wajib };
  }

  // 2. Harus angka: digit, dengan paling banyak satu titik desimal yang
  //    dikelilingi digit. Menolak juga titik di awal atau di akhir ("." atau
  //    "12."), karena keduanya bukan angka yang bisa dikirim.
  if (!/^[0-9]+(\.[0-9]+)?$/.test(bersih)) {
    return { valid: false, pesan: pesan.tidakValid };
  }

  const angka = Number(bersih);

  // 3. Harus lebih dari 0, atau nol kalau bolehNol.
  if (!Number.isFinite(angka)) {
    return { valid: false, pesan: pesan.tidakValid };
  }

  if (bolehNol) {
    if (angka < 0) {
      return { valid: false, pesan: pesan.nolBoleh };
    }
  } else if (angka <= 0) {
    // Jumlah penambahan stok harus lebih dari 0: menambah 0 tidak masuk akal.
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
  if (angka > MAKSIMAL_NILAI) {
    return { valid: false, pesan: pesan.maks };
  }

  return { valid: true, pesan: null };
}

/**
 * Mengubah teks angka yang valid menjadi angka.
 *
 * Input: teks angka dari isian.
 * Output: angka, atau 0 kalau teksnya tidak valid.
 *
 * Memakai bersihkanAngka dulu supaya koma diperlakukan sebagai titik.
 */
export function angkaJadiAngka(teks: string): number {
  const bersih = bersihkanAngka(teks);
  const angka = Number(bersih);

  return Number.isFinite(angka) ? angka : 0;
}

/**
 * Mengubah angka stok menjadi teks untuk ditampilkan.
 *
 * Input: angka (atau teks angka) dari database.
 * Output: teks gaya Indonesia, misal 5000 jadi "5.000" dan 0.25 jadi "0,25".
 *
 * Cara kerja:
 *   1. Angka diubah menjadi string dengan maksimal 3 desimal. Nol di ujung
 *      dibuang oleh maximumFractionDigits (mis. 5000 tidak jadi "5.000,000").
 *   2. Pemisah ribuan diganti titik dan pemisah desimal diganti koma.
 *
 * Kenapa Locale "en-US" dipakai lalu dibalik: Locale en-US memakai koma untuk
 * ribuan dan titik untuk desimal. Jadi titik SELALU berarti desimal dan koma
 * SELALU berarti ribuan, keduanya bisa dibedakan dengan aman sebelum dibalik ke
 * format Indonesia.
 */
export function formatAngkaIndonesia(nilai: unknown): string {
  const angka = ubahKeAngka(nilai);

  const teks = angka.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: MAKSIMAL_DESIMAL,
  });

  // Locale en-US memakai koma untuk ribuan dan titik untuk desimal, jadi keduanya
  // bisa dibedakan dengan aman lalu dibalik ke format Indonesia:
  //   1. Semua koma (pemisah ribuan) diganti sementara dengan karakter "@",
  //   2. Titik yang tersisa (pemisah desimal) diganti koma,
  //   3. Semua "@" diganti titik.
  //
  // Kenapa pakai "@" sebagai sementara: kalau koma langsung diganti titik, lalu
  // titiknya diganti koma, keduanya saling bertukar dan hasilnya salah
  // (5000 jadi "5,000"). Karakter "@" tidak mungkin muncul di angka, jadi
  // tidak pernah bertabrakan.
  return teks.replace(/,/g, "@").replace(".", ",").replace(/@/g, ".");
}

/**
 * Mengubah angka menjadi teks dengan tanda plus atau minus untuk ditampilkan
 * sebagai "perubahan" (dipakai di riwayat dan dialog koreksi).
 *
 * Input: angka (bisa negatif).
 * Output: teks seperti "+500", "-200", atau "0".
 *
 * Kenapa tanda plusnya ditulis: kalau stok bertambah 500, menulis "500" saja
 * membuat Admin tidak tahu apakah bertambah atau berkurang. Tanda "+" atau "-"
 * langsung memberitahu arah perubahannya.
 */
export function formatPerubahan(nilai: unknown): string {
  const angka = ubahKeAngka(nilai);

  // Positif diberi tanda plus supaya jelas bertambah.
  if (angka > 0) {
    return "+" + formatAngkaIndonesia(angka);
  }

  // Negatif: formatAngkaIndonesia sudah menulis tanda minusnya, karena
  // angkanya negatif (hasilnya "-200").
  if (angka < 0) {
    return formatAngkaIndonesia(angka);
  }

  // Nol tanpa tanda.
  return formatAngkaIndonesia(0);
}

/**
 * Mengubah nilai apa pun menjadi angka.
 *
 * Output: angka, atau nilai cadangan kalau tidak bisa dibaca.
 */
function ubahKeAngka(nilai: unknown): number {
  if (typeof nilai === "number") {
    return Number.isFinite(nilai) ? nilai : 0;
  }

  if (typeof nilai === "string") {
    const bersih = bersihkanAngka(nilai);
    if (bersih === "") {
      return 0;
    }
    const angka = Number(bersih);
    return Number.isFinite(angka) ? angka : 0;
  }

  return 0;
}
