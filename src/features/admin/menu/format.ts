// File ini: pemformat rupiah dan validator nama dan harga menu.
//
// Kenapa dipisah dari komponen: aturan validasi harus sama dengan server
// (src/lib/server/validasi-admin.ts), dan kalau aturannya ditulis di dalam JSX
// saja, tidak ada yang bisa mengujinya.
//
// File ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.

import { POLA_RUPIAH } from "./teks";

// Batas nama menu (docs/api-contract.md bagian 4b).
export const MAKSIMAL_NAMA = 60;

// Batas harga: bilangan bulat 1 sampai 10.000.000 rupiah.
export const MINIMAL_HARGA = 1;
export const MAKSIMAL_HARGA = 10000000;

// Hasil pemeriksaan satu isian: valid atau tidak, plus pesan kalau tidak valid.
export type HasilCek = { valid: boolean; pesan: string | null };

/**
 * Mengubah angka menjadi teks rupiah untuk ditampilkan.
 *
 * Input: angka (atau teks angka) yang akan ditampilkan.
 * Output: teks seperti "Rp 20.000".
 *
 * Cara kerja: angka diubah menjadi teks dengan pemisah ribuan gaya Indonesia
 * (titik), lalu dibungkus pola "Rp {jumlah}".
 *
 * Kenapa memakai toLocaleString("id-ID"): pemisah ribuan di Indonesia adalah
 * titik, sedangkan di beberapa negara lain koma. Menulis pemisah sendiri
 * rawan salah (mis. "20,000" untuk 20 juta).
 *
 * Kalau nilainya bukan angka yang valid, hasilnya "Rp 0" supaya tampilan tidak
 * menampilkan "NaN" atau "[object Object]".
 */
export function formatRupiah(nilai: unknown): string {
  const angka = ubahKeAngka(nilai);

  return POLA_RUPIAH.replace(
    "{jumlah}",
    angka.toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    }),
  );
}

/**
 * Mengubah nilai apa pun menjadi angka untuk dipakai di formatRupiah.
 *
 * Output: angka, atau 0 kalau nilainya tidak bisa dibaca.
 */
function ubahKeAngka(nilai: unknown): number {
  if (typeof nilai === "number") {
    return Number.isFinite(nilai) ? nilai : 0;
  }

  if (typeof nilai === "string") {
    const teks = nilai.trim();
    if (teks === "") {
      return 0;
    }
    const angka = Number(teks);
    return Number.isFinite(angka) ? angka : 0;
  }

  return 0;
}

/**
 * Memeriksa nama menu.
 *
 * Input: nama yang diketik Admin (boleh kosong).
 * Output: HasilCek.
 *
 * Aturan (setelah spasi pinggir dipangkas): wajib, maksimal 60 karakter
 * (docs/api-contract.md bagian 4b).
 */
export function cekNamaMenu(
  nama: string,
  pesan: { wajib: string; maks: string },
): HasilCek {
  const namaBersih = nama.trim();

  if (namaBersih.length === 0) {
    return { valid: false, pesan: pesan.wajib };
  }

  if (namaBersih.length > MAKSIMAL_NAMA) {
    return { valid: false, pesan: pesan.maks };
  }

  return { valid: true, pesan: null };
}

/**
 * Memeriksa harga menu.
 *
 * Input: harga sebagai teks dari isian (boleh kosong).
 * Output: HasilCek.
 *
 * Aturan: wajib, bilangan bulat, 1 sampai 10.000.000.
 *
 * Kenapa tidak memakai zod di klien: halaman ini hanya butuh pemeriksaan yang
 * sama supaya tombol tidak aktif untuk isian yang pasti ditolak server. Aturan
 * lengkapnya sudah di server (src/lib/server/validasi-admin.ts).
 *
 * Format yang diterima: hanya angka bulat. Pemisah ribuan TIDAK diterima
 * ("20.000" ditolak), karena apa yang dikirim ke server adalah angka, dan
 * "20.000" bisa berarti 20000 atau 20.0005 tergantung Locale.
 */
export function cekHargaMenu(
  hargaTeks: string,
  pesan: { wajib: string; batas: string },
): HasilCek {
  const teks = hargaTeks.trim();

  if (teks === "") {
    return { valid: false, pesan: pesan.wajib };
  }

  // Harus bilangan bulat: hanya angka, tanpa desimal, negatif, atau huruf.
  if (!/^[0-9]+$/.test(teks)) {
    return { valid: false, pesan: pesan.batas };
  }

  const angka = Number(teks);

  if (angka < MINIMAL_HARGA || angka > MAKSIMAL_HARGA) {
    return { valid: false, pesan: pesan.batas };
  }

  return { valid: true, pesan: null };
}

/**
 * Mengubah teks harga yang sudah valid menjadi angka.
 *
 * Input: teks harga.
 * Output: angka harga.
 *
 * Dipakai saat mengirim ke server: yang dikirim harus angka, bukan teks.
 */
export function hargaJadiAngka(hargaTeks: string): number {
  return Number(hargaTeks.trim());
}
