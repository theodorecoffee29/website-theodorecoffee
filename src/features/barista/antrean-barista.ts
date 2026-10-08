// File ini: logika murni untuk layar Barista, tanpa React dan tanpa panggilan
// API. Semua aturan yang bisa diuji dikumpulkan di sini supaya mudah dicek tanpa
// membuka browser.
//
// Yang dikerjakan file ini:
//   1. Membagi antrean menjadi dua kelompok: Sedang dikerjakan dan Baru masuk.
//   2. Memetakan status menjadi teks untuk Barista.
//
// File ini MURNI (tanpa database dan tanpa Supabase), jadi mudah diuji.

import type { PesananAntrean } from "./api";

// Status order dari docs/order-flow.md bagian 1. Ditulis di sini supaya tidak
// ada salah ketik di beberapa tempat sekaligus.
export const STATUS_ANTREAN = "antrean";
export const STATUS_DIKERJAKAN = "dikerjakan";

// Dua kelompok antrean Barista.
export type KelompokAntrean = {
  // Status "dikerjakan": sudah kamu mulai, masih dikerjakan.
  dikerjakan: PesananAntrean[];
  // Status "antrean": baru masuk, belum kamu mulai.
  baruMasuk: PesananAntrean[];
};

/**
 * Membagi antrean Barista menjadi dua kelompok.
 *
 * Input: daftar pesanan dari server.
 * Output: dua kelompok, masing-masing URUTAN PERSIS seperti dari server.
 *
 * PENTING: fungsi ini TIDAK mengurutkan apa pun. Server sudah mengurutkan dari
 * waktu konfirmasi paling awal (docs/order-flow.md bagian 4), dan urutan itu
 * yang harus dipakai. Kalau diurutkan ulang di klien, urutannya bisa jadi salah
 * (mis. berdasarkan nomor antrean, padahal nomor antrean bisa berbeda urutan
 * waktu konfirmasi). Jadi di sini hanya dipisah, tidak diurutkan.
 *
 * Pembagian:
 *   - dikerjakan : status "dikerjakan" (Barista sudah menekan Mulai).
 *   - baruMasuk  : status "antrean" (sudah dikonfirmasi Cashier, belum mulai).
 *
 * Status lain tidak terlihat di layar Barista karena server tidak mengirimnya
 * (server hanya mengambil status antrean dan dikerjakan). Kalau suatu saat muncul
 * status lain, pesanan itu DILEWATI supaya tidak muncul dengan tombol yang salah.
 */
export function kelompokkanAntrean(pesanan: PesananAntrean[]): KelompokAntrean {
  const dikerjakan: PesananAntrean[] = [];
  const baruMasuk: PesananAntrean[] = [];

  for (const satu of pesanan) {
    if (satu.status === STATUS_DIKERJAKAN) {
      dikerjakan.push(satu);
    } else if (satu.status === STATUS_ANTREAN) {
      baruMasuk.push(satu);
    }
    // Status lain sengaja tidak masuk kelompok mana pun (lihat catatan di atas).
  }

  // Catatan: tidak ada .sort() di sini. Urutan tetap seperti dari server.
  return { dikerjakan: dikerjakan, baruMasuk: baruMasuk };
}

/**
 * Memetakan status order menjadi teks yang tampil di layar Barista.
 *
 * Input: status dari server ("antrean" atau "dikerjakan").
 * Output: teks yang tampil.
 *
 * Kenapa "antrean" tampil sebagai "Baru masuk": kata "antrean" terlalu teknis dan
 * tidak menjelaskan apa yang harus dilakukan Barista. "Baru masuk" langsung
 * memberi tahu ada pesanan baru yang belum dimulai (docs/order-flow.md bagian 1).
 *
 * Status lain dapat teks cadangan supaya tampilan tidak pernah kosong.
 */
export function teksStatusBarista(status: string): string {
  if (status === STATUS_ANTREAN) {
    return "Baru masuk";
  }
  if (status === STATUS_DIKERJAKAN) {
    return "Sedang dikerjakan";
  }
  return "Status tidak diketahui";
}
