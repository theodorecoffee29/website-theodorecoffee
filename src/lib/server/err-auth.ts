// File ini: mengenali kegagalan dari Supabase Auth (auth.admin.*) berdasarkan
// KODE error, bukan berdasarkan teks pesan.
//
// KENAPA TIDAK MENYIAPKAN DARI TEKS PESAN:
//   Pesan error dari Supabase bisa berubah kapan saja (dan sering diubah untuk
//   diterjemahkan ke bahasa lain). Menyalin kalimatnya ke kode ini berarti:
//     - satu kali Supabase mengubah kalimatnya, fitur "email sudah dipakai" diam-diam
//       berhenti bekerja, dan Admin melihat pesan teknis apa adanya,
//     - atau lebih buruk, kalimatnya cocok untuk kesalahan lain, lalu sebuah
//       kegagalan sistem disetor sebagai "email sudah dipakai", yang membuat Admin
//       salah mencari penyebab.
//   Bandingkan dengan kode error (mis. "email_exists"): itu bagian dari kontrak API
//   Supabase yang jauh lebih stabil, dan memang disediakan supaya pemanggil bisa
//   bereaksi tanpa membaca kalimatnya.
//
// File ini MURNI (tanpa database dan tanpa memanggil Auth), jadi bisa diuji langsung.

import { ambilDetailError } from "@/lib/errors";

// Kode error Auth untuk email yang sudah terdaftar.
//
// Dua kode sengaja dicantumkan: "email_exists" adalah kode yang dipakai sekarang,
// sedangkan "user_already_exists" adalah kode lama yang masih muncul di sebagian
// instalasi Supabase (self-hosted, versi lama). Keduanya berarti hal yang sama, jadi
// keduanya diterima.
const KODE_EMAIL_SUDAH_DIPAKAI = ["email_exists", "user_already_exists"];

// Kode error Auth yang berarti kunci server ditolak.
//
// Ini penting untuk tâche "kalau Admin API menolak kunci rahasia": kasusnya harus
// dikenali supaya pesannya tercatat dengan jelas, dan supaya kita TIDAK mencari jalan
// memutar (mis. mencoba lagi dengan kunci lain).
const KODE_KUNCI_RAHASIA_DITOLAK = [
  "invalid_api_key",
  "invalid_client_credentials",
  "bad_jwt",
];

/**
 * Memeriksa apakah error dari Auth berarti email sudah dipakai.
 *
 * Input: error apa pun yang dikembalikan oleh auth.admin.createUser.
 * Output: true kalau email itu sudah terdaftar.
 *
 * Kalau errornya TIDAK punya kode (mis. koneksi putus, yang tidak punya kode sama
 * sekali), hasilnya false. Ini disengaja: kasus itu bukan "email sudah dipakai",
 * dan menganggapnya begitu akan menyembunyikan kegagalan sistem yang sebenarnya.
 */
export function emailSudahDipakai(error: unknown): boolean {
  const kode = bacaKode(error);

  return kode !== null && KODE_EMAIL_SUDAH_DIPAKAI.includes(kode);
}

/**
 * Memeriksa apakah error dari Auth berarti kunci server (service role) ditolak.
 *
 * Input: error apa pun dari auth.admin.*.
 * Output: true kalau kodenya menandakan kunci ditolak, atau status HTTP-nya 401.
 *
 * Kenapa status 401 ikut dianggap: sebagian konfigurasi Supabase membalas 401 tanpa
 * kode yang deskriptif. Status 401 selalu berarti "kredensial yang dikirim ditolak",
 * dan itu persis masalah yang perlu dilaporkan terpisah.
 *
 * CATATAN PENTING: kalau fungsi ini true, tindakan yang benar adalah MENYEBERAHKAN
 * pesan errornya dan BERHENTI. Jangan mengganti kunci, jangan membaca .env.local,
 * dan jangan mencoba permintaan lain. Memutar di sini hanya menyembunyikan masalah
 * yang harus diperbaiki oleh pemilik project.
 */
export function kunciRahasiaDitolak(error: unknown): boolean {
  const kode = bacaKode(error);

  if (kode !== null && KODE_KUNCI_RAHASIA_DITOLAK.includes(kode)) {
    return true;
  }

  return bacaStatus(error) === 401;
}

/**
 * Mengumpulkan detail error Auth untuk dicatat di log.
 *
 * Input: error apa pun dari Auth.
 * Output: objek berisi kode, status, dan pesan teknisnya.
 *
 * Kenapa dikumpulkan: pesan teknisnya hanya boleh masuk ke log (docs/logging.md
 * bagian 6 poin 3), karena bisa memuat detail internal Supabase yang tidak boleh
 * tampil di layar. Yang tampil ke Admin tetap pesan ramah.
 */
export function detailErrorAuth(error: unknown): {
  code: string | null;
  status: number | null;
  message: string;
} {
  const detail = ambilDetailError(error);

  return {
    code: detail.code,
    status: bacaStatus(error),
    message: detail.message,
  };
}

/**
 * Membaca field code dari error Auth.
 *
 * Input: error apa pun.
 * Output: teks kodenya, atau null kalau tidak ada.
 *
 * Error dari Auth adalah objek biasa dengan field message, status, dan code (bukan
 * turunan Error), jadi fieldnya dibaca langsung. Error dari jaringan (mis. gagal
 * koneksi) tidak punya field code sama sekali, dan hasilnya null.
 */
function bacaKode(error: unknown): string | null {
  if (error === null || typeof error !== "object") {
    return null;
  }

  const kode = (error as { code?: unknown }).code;

  return typeof kode === "string" ? kode : null;
}

/**
 * Membaca status HTTP dari error Auth.
 *
 * Input: error apa pun.
 * Output: angkanya, atau null kalau tidak ada atau bukan angka.
 */
function bacaStatus(error: unknown): number | null {
  if (error === null || typeof error !== "object") {
    return null;
  }

  const status = (error as { status?: unknown }).status;

  return typeof status === "number" ? status : null;
}

// Diekspor supaya tes bisa memastikan daftar kode yang dipakai benar-benar yang
// ditulis di sini (bukan hasil ketik ulang yang bisa berbeda).
export const KODE_EMAIL_SUDAH_DIPAKAI_DI_KODE = KODE_EMAIL_SUDAH_DIPAKAI;
