// File ini: logika murni untuk layar Cashier, tanpa React dan tanpa panggilan
// API. Semua aturan yang bisa diuji dikumpulkan di sini supaya mudah dicek tanpa
// membuka browser.
//
// Yang dikerjakan file ini:
//   1. Mengelompokkan pesanan ke tiga kelompok sesuai statusnya.
//   2. Mengurutkan tiap kelompok dengan urutan yang benar untuk Cashier.
//   3. Memetakan kolom source jadi label yang tampil ("Online"/"Kasir").
//   4. Memeriksa pilihan metode bayar sebelum konfirmasi.
//
// Kenapa dipisah dari komponen: aturan ini adalah keputusan tampilan Cashier.
// Kalau ikut di dalam komponen, aturannya sulit diuji dan mudah berubah tidak
// sengaja.

import type { MetodeBayar } from "./api";

// Status order dari docs/order-flow.md bagian 1. Ditulis di sini supaya tidak
// ada salah ketik di beberapa tempat sekaligus.
export const STATUS_MENUNGGU = "menunggu_konfirmasi";
export const STATUS_ANTREAN = "antrean";
export const STATUS_DIKERJAKAN = "dikerjakan";
export const STATUS_SELESAI = "selesai";
export const STATUS_DIBATALKAN = "dibatalkan";

// Bentuk minimum satu pesanan yang dipakai fungsi di file ini. Sengaja hanya
// berisi field yang dipakai, supaya file ini tidak perlu tahu bentuk lengkap
// dari API.
export type PesananRingkas = {
  orderId: string;
  queueNumber: number;
  customerName: string;
  source: string;
  status: string;
  // Waktu dibuat dalam format timestamptz database, mis. "2026-10-08T09:15:00+07:00".
  createdAt: string;
};

// Nama kelompok di layar Cashier.
export type Kelompok = "menunggu" | "dikerjakan" | "selesai";

// Tiga kelompok pesanan, sudah diurutkan sesuai kebutuhan Cashier.
export type KelompokPesanan = {
  menunggu: PesananRingkas[];
  dikerjakan: PesananRingkas[];
  selesai: PesananRingkas[];
};

/**
 * Mengelompokkan pesanan ke tiga kelompok dan mengurutkannya.
 *
 * Input: daftar pesanan hari ini (urutan dari server tidak dianggap penting).
 * Output: tiga kelompok, masing-masing sudah terurut.
 *
 * Pembagian kelompok (docs/order-flow.md bagian 1):
 *   - menunggu  : hanya menunggu_konfirmasi. Order yang harus dicek pembayaran
 *                 lalu dikonfirmasi Cashier. Ditampilkan paling atas.
 *   - dikerjakan : antrean dan dikerjakan. Sudah dikonfirmasi, sedang ditangani
 *                 Barista.
 *   - selesai    : selesai dan dibatalkan. Status akhir, tanpa tombol.
 *
 * Urutan di dalam kelompok:
 *   - menunggu  : dari yang paling lama (createdAt terkecil). Order terlama yang
 *                 menunggu justru paling mendesak, jadi harus terlihat dulu.
 *   - dikerjakan : dari yang paling lama, sama dengan urutan antrean Barista,
 *                 supaya Cashier dan Barista melihat urutan yang sama.
 *   - selesai    : dari yang paling baru. Yang baru saja selesai lebih menarik
 *                 untuk dilihat Cashier.
 *
 * Status yang tidak dikenal masuk kelompok "selesai" supaya tidak hilang dari
 * layar: Cashier masih bisa melihat order itu, hanya tanpa tombol aksi.
 */
export function kelompokkanPesanan(pesanan: PesananRingkas[]): KelompokPesanan {
  const menunggu: PesananRingkas[] = [];
  const dikerjakan: PesananRingkas[] = [];
  const selesai: PesananRingkas[] = [];

  for (const satu of pesanan) {
    if (satu.status === STATUS_MENUNGGU) {
      menunggu.push(satu);
    } else if (
      satu.status === STATUS_ANTREAN ||
      satu.status === STATUS_DIKERJAKAN
    ) {
      dikerjakan.push(satu);
    } else {
      selesai.push(satu);
    }
  }

  // createdAt dibandingkan lewat konversi ke milidetik (lihat catatan di
  // bandingkanWaktuMembuat), jadi urutan pakai comparator yang sama untuk
  // kelompok yang urutannya "lama ke baru".
  menunggu.sort(bandingkanLamaKeBaru);
  dikerjakan.sort(bandingkanLamaKeBaru);
  // Yang terbaru dulu: comparator-nya dibalik.
  selesai.sort(bandingkanBaruKeLama);

  return {
    menunggu: menunggu,
    dikerjakan: dikerjakan,
    selesai: selesai,
  };
}

/**
 * Comparator: a lebih dulu kalau waktunya lebih lama.
 *
 * Kalau waktu satu pesanan tidak diketahui, pesanan itu dianggap paling akhir
 * supaya tidak mendahului pesanan yang waktunya jelas.
 */
function bandingkanLamaKeBaru(a: PesananRingkas, b: PesananRingkas): number {
  return bandingkanWaktu(a, b);
}

/**
 * Comparator: a lebih dulu kalau waktunya lebih baru.
 *
 * Ini comparator yang dibalik dari bandingkanLamaKeBaru.
 */
function bandingkanBaruKeLama(a: PesananRingkas, b: PesananRingkas): number {
  return bandingkanWaktu(b, a);
}

/**
 * Membandingkan waktu dibuat dua pesanan.
 *
 * Output: angka negatif kalau a lebih dulu, positif kalau b lebih dulu, dan 0
 *         kalau waktunya sama.
 *
 * Kenapa waktu diubah jadi milidetik dulu: supaya perbandingan benar. Membandingkan
 * teks secara langsung bisa salah kalau formatnya berbeda (mis. satu pakai "Z"
 * dan satu pakai "+07:00"). new Date() understanding understands keduanya.
 *
 * Kalau waktunya sama, dipakai nomor antrean supaya urutannya konsisten. Nomor
 * antrean mulai dari 1 tiap hari (docs/order-flow.md bagian 7).
 */
function bandingkanWaktu(a: PesananRingkas, b: PesananRingkas): number {
  const waktuA = waktuMilidetik(a.createdAt);
  const waktuB = waktuMilidetik(b.createdAt);

  // Dua-duanya tidak diketahui waktu: urutkan dari nomor antrean.
  if (waktuA === null && waktuB === null) {
    return a.queueNumber - b.queueNumber;
  }

  // Hanya a yang tidak diketahui: a dianggap paling akhir.
  if (waktuA === null) {
    return 1;
  }

  // Hanya b yang tidak diketahui: b dianggap paling akhir.
  if (waktuB === null) {
    return -1;
  }

  if (waktuA === waktuB) {
    return a.queueNumber - b.queueNumber;
  }

  return waktuA - waktuB;
}

/**
 * Mengubah waktu dari database (timestamptz) menjadi milidetik sejak 1970.
 *
 * Input: teks waktu seperti "2026-10-08T09:15:00+07:00".
 * Output: angka milidetik, atau null kalau teksnya tidak bisa dibaca.
 */
function waktuMilidetik(waktu: string): number | null {
  const tanggal = new Date(waktu);

  // new Date("bukan tanggal") menghasilkan Invalid Date, yang getTime()-nya NaN.
  if (Number.isNaN(tanggal.getTime())) {
    return null;
  }

  return tanggal.getTime();
}

/**
 * Memetakan kolom source jadi label yang tampil ke Cashier.
 *
 * Input: nilai source dari database ("online" atau "cashier").
 * Output: "Online", "Kasir", atau teks cadangan kalau asalnya tidak dikenal.
 *
 * Kenapa tidak menampilkan nilai mentah: pengguna tidak boleh melihat nama
 * kolom database. Kalau nanti ada sumber baru, teksnya tinggal ditambah di satu
 * tempat.
 */
export function labelAsalPesanan(source: string): string {
  if (source === "online") {
    return "Online";
  }
  if (source === "cashier") {
    return "Kasir";
  }
  return "Asal tidak diketahui";
}

/**
 * Memeriksa apakah pilihan metode bayar sudah valid.
 *
 * Input: nilai yang dipilih Cashier, atau null kalau belum memilih.
 * Output: true kalau nilainya "qris" atau "tunai".
 *
 * Kenapa tidak ada nilai bawaan: Cashier wajib memilih sendiri sebelum konfirmasi
 * (docs/order-flow.md bagian 6, acceptance criteria 3). Karena itu fungsi ini
 * selalu false untuk null, string kosong, atau nilai lain.
 */
export function metodeBayarValid(
  pilihan: string | null,
): pilihan is MetodeBayar {
  return pilihan === "qris" || pilihan === "tunai";
}
