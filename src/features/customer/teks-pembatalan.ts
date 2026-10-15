// File ini: pemetaan alasan pembatalan order menjadi teks yang dilihat customer.
//
// Kenapa dipisah dari komponen tampilan: aturan teksnya (docs/order-flow.md
// bagian 6 ayat 22 dan 23) adalah keputusan produk, bukan keputusan tampilan.
// Kalau teksnya ikut di JSX, aturan ini akan tersebar di beberapa tempat.
//
// CATATAN PENTING: customer sendiri tidak pernah memilih alasan saat membatalkan
// pesanan. Alasan diisi server: "diminta_customer" kalau customer yang
// membatalkan, atau alasan yang dipilih Cashier/Admin
// (docs/api-contract.md bagian 4).
//
// File ini MURNI (tanpa server dan tanpa React), jadi bisa diuji langsung.

import { teksCustomer } from "./teks";

// Alasan pembatalan yang mungkin dikirim server (docs/api-contract.md bagian 2).
const DAFTAR_ALASAN = [
  "stok_habis",
  "pembayaran_tidak_diterima",
  "diminta_customer",
  "pesanan_ganda",
  "salah_input",
  "lainnya",
] as const;

// Hasil pemetaan: kalimat utama dan catatan tambahan.
export type TeksPembatalan = {
  // Kalimat utama, misalnya "Dibatalkan karena stok habis".
  alasan: string;
  // Catatan dari staf, atau null kalau tidak ada. Ditampilkan di bawah kalimat
  // utama sebagai keterangan tambahan.
  catatan: string | null;
};

/**
 * Mengubah alasan dan catatan pembatalan menjadi teks untuk customer.
 *
 * Input: cancelReason (boleh null, misalnya order lama yang belum punya alasan)
 *        dan cancelNote (boleh null).
 * Output: TeksPembatalan yang ditampilkan.
 *
 * Cara kerja:
 *   1. Alasan kosong atau yang tidak dikenal dianggap "lainnya", supaya teksnya
 *      tetap jujur dan tidak menebak-nebak alasan yang tidak dikirim server.
 *   2. Catatan yang cuma spasi dianggap tidak ada. Server memang menyimpan
 *      catatan kosong sebagai null, tapi dijaga juga di sini.
 */
export function teksPembatalan(
  cancelReason: string | null | undefined,
  cancelNote: string | null | undefined,
): TeksPembatalan {
  const alasanDariServer = (cancelReason ?? "").trim();
  const catatanDariServer = (cancelNote ?? "").trim();

  const alasanDikenal =
    alasanDariServer !== "" &&
    (DAFTAR_ALASAN as readonly string[]).includes(alasanDariServer);

  return {
    alasan: pilihKalimatAlasan(alasanDikenal ? alasanDariServer : "lainnya"),
    catatan: catatanDariServer === "" ? null : catatanDariServer,
  };
}

/**
 * Memilih kalimat utama untuk satu alasan pembatalan.
 *
 * Input: alasan yang sudah dipastikan salah satu dari DAFTAR_ALASAN.
 * Output: kalimat yang tampil ke customer.
 *
 * Kenapa "lainnya" memakai kalimat paling umum ("Dibatalkan"): isinya bebas,
 * jadi yang menjelaskan adalah catatan yang diisi staf dan ditampilkan di
 * bawahnya.
 */
function pilihKalimatAlasan(alasan: string): string {
  const teks = teksCustomer.status.alasanBatal;

  switch (alasan) {
    case "stok_habis":
      return teks.stokHabis;
    case "pembayaran_tidak_diterima":
      return teks.pembayaranTidakDiterima;
    case "diminta_customer":
      return teks.dimintaCustomer;
    case "pesanan_ganda":
      return teks.pesananGanda;
    case "salah_input":
      return teks.salahInput;
    default:
      return teks.lainnya;
  }
}
