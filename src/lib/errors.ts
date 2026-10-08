// File ini: definisi bentuk error dan format respons di sisi server.
// Dipakai semua fungsi server supaya setiap jawaban punya bentuk yang sama,
// persis seperti docs/api-contract.md bagian 1 dan 6.
//
// Tiga hal yang ada di file ini:
//   1. Daftar tipe error yang TETAP (bagian 6). Daftar ini tidak boleh ditambah
//      seenaknya; kalau butuh tipe baru, dokumennya dulu yang diubah.
//   2. fromDatabaseError: mengubah error yang dilempar database (raise exception)
//      menjadi tipe error kita. Kalau tipenya tidak dikenal, dianggap INTERNAL_ERROR.
//   3. ok() dan fail(): pembuat respons dengan format yang seragam.

import { z } from "zod";

/**
 * Daftar tipe error yang tetap, persis docs/api-contract.md bagian 6.
 * Urutannya sama seperti di dokumen supaya mudah dibandingkan.
 */
export const ERROR_TYPES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VALIDATION_FAILED",
  "ORDER_NOT_FOUND",
  "ORDER_STATUS_CHANGED",
  "MENU_UNAVAILABLE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

// Satu tipe saja yang diambil dari daftar di atas. TypeScript tidak mengizinkan
// menulis nama di luar daftar ini.
export type ErrorType = (typeof ERROR_TYPES)[number];

/**
 * Bentuk satu error yang dikirim ke pengguna.
 *
 * - type: jenis error yang tetap (dipakai kode untuk menentukan tampilan).
 * - message: pesan ramah untuk pengguna (BUKAN detail teknis).
 * - code: kode pendek "ERR-xxxx" untuk mencari di error_logs. Hanya ada kalau
 *   errornya sudah dicatat lewat logError.
 */
export type AppError = {
  type: ErrorType;
  message: string;
  code?: string;
};

/**
 * Bentuk respons gagal: { ok: false, error: { ... } }.
 */
export type FailResponse = {
  ok: false;
  error: AppError;
};

/**
 * Bentuk respons berhasil: { ok: true, data: { ... } }.
 * "data" dibuat generik (T) supaya tipe datanya ikut menyesuaikan isi yang
 * dikirim server, tanpa perlu menulis ulang tipe berkali-kali.
 */
export type OkResponse<T> = {
  ok: true;
  data: T;
};

// Setiap respons server adalah salah satu dari dua bentuk di atas.
export type ApiResponse<T> = OkResponse<T> | FailResponse;

/**
 * Memeriksa apakah sebuah teks adalah salah satu tipe error yang dikenal.
 *
 * Cara kerja: z.enum(...) hanya menerima nilai yang ada di dalam daftar.
 * Kalau teksnya bukan salah satu dari daftar, pemeriksaan gagal.
 */
const tipeErrorSchema = z.enum(ERROR_TYPES);

/**
 * Bentuk detail satu error dari database.
 *
 * Supabase mengirim error sebagai OBJEK BIASA (bukan turunan Error) dengan
 * empat field: message, code, details, dan hint. Sebelumnya objek ini diubah
 * dengan String(error), sehingga isinya hilang dan tertulis "[object Object]".
 * Bentuk inilah yang dipakai untuk mengambil isinya dengan benar.
 */
export type DetailErrorDatabase = {
  // Pesan utama. Untuk proyek ini isinya salah satu tipe error (ORDER_NOT_FOUND,
  // VALIDATION_FAILED, dst) ketika error datang dari fungsi database kita.
  message: string;
  // Kode SQLSTATE PostgreSQL, contoh "P0001". Null kalau tidak ada.
  code: string | null;
  // Detail tambahan dari "raise exception ... using detail". Null kalau tidak ada.
  details: string | null;
  // Saran dari PostgreSQL. Null kalau tidak ada.
  hint: string | null;
};

/**
 * Membaca detail error database apa pun menjadi objek yang aman dicatat.
 *
 * Input: error apa pun (objek dari supabase-js, Error biasa, teks, null, dll).
 * Output: DetailErrorDatabase. Field yang tidak ada diisi null.
 *
 * Kenapa tidak memakai String(error): untuk objek biasa, String(error) hanya
 * menghasilkan "[object Object]", sehingga pesan aslinya hilang. Fungsi ini
 * membaca field satu per satu supaya isinya tetap terbaca.
 */
export function ambilDetailError(error: unknown): DetailErrorDatabase {
  // 1. Error biasa (mis. dilempar kode sendiri). Hanya punya message, tapi bisa
  //    saja ada field tambahan; diambil kalau memang berupa teks.
  if (error instanceof Error) {
    const tambahan = error as Error & {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    return {
      message: error.message,
      code: jadikanTeks(tambahan.code),
      details: jadikanTeks(tambahan.details),
      hint: jadikanTeks(tambahan.hint),
    };
  }

  // 2. Objek biasa (bentuk error dari supabase-js): ambil tiap field kalau
  //    memang berupa teks.
  if (error !== null && typeof error === "object") {
    const kolom = error as Record<string, unknown>;
    return {
      message: jadikanTeks(kolom.message) ?? "",
      code: jadikanTeks(kolom.code),
      details: jadikanTeks(kolom.details),
      hint: jadikanTeks(kolom.hint),
    };
  }

  // 3. Bukan objek (teks, angka, null, undefined): jadikan teks apa adanya.
  //    null dan undefined dianggap kosong.
  return {
    message: error === null || error === undefined ? "" : String(error),
    code: null,
    details: null,
    hint: null,
  };
}

// Mengubah sebuah nilai menjadi teks hanya kalau memang berupa teks. Selain itu
// dianggap tidak ada (null), supaya tidak ada "[object Object]" yang lolos.
function jadikanTeks(nilai: unknown): string | null {
  return typeof nilai === "string" ? nilai : null;
}

/**
 * Mengubah error dari database menjadi AppError.
 *
 * Input: error apa pun yang dilempar database. Fungsi database di proyek ini
 * memakai raise exception dengan message berupa salah satu tipe error, dan
 * detail berisi penjelasan field yang salah.
 *
 * Output: AppError. Kalau message-nya bukan tipe error yang dikenal, hasilnya
 * INTERNAL_ERROR, karena error yang tidak dikenal dianggap kegagalan sistem.
 *
 * Detail teknis dari database (pesan asli PostgreSQL) TIDAK ikut dikembalikan
 * ke pengguna, hanya disimpan di log. Yang dikembalikan ke pengguna cuma pesan
 * ramah per tipe error.
 */
export function fromDatabaseError(error: unknown): AppError {
  // Pesan error dibaca lewat ambilDetailError, supaya bentuk objek dari
  // supabase-js (bukan turunan Error) tetap terbaca di field message-nya.
  const detail = ambilDetailError(error);

  // Cek apakah pesan itu persis salah satu tipe error yang dikenal.
  const cekTipe = tipeErrorSchema.safeParse(detail.message);

  if (cekTipe.success) {
    // Detail (field yang salah) tidak dikirim ke pengguna; pesan ramah saja.
    return {
      type: cekTipe.data,
      message: pesanRamahUntuk(cekTipe.data),
    };
  }

  // Tidak dikenal: perlakukan sebagai kegagalan sistem.
  return {
    type: "INTERNAL_ERROR",
    message: pesanRamahUntuk("INTERNAL_ERROR"),
  };
}

/**
 * Mengembalikan pesan ramah untuk pengguna berdasarkan tipe error.
 *
 * Kenapa perlu: pesan dari database itu teknis dan tidak ramah untuk dibaca
 * customer (misalnya "MENU_UNAVAILABLE"). Fungsi ini menerjemahkan setiap tipe
 * menjadi kalimat yang bisa langsung ditampilkan.
 */
export function pesanRamahUntuk(type: ErrorType): string {
  switch (type) {
    case "UNAUTHENTICATED":
      return "Kamu harus masuk dulu.";
    case "FORBIDDEN":
      return "Kamu tidak punya izin untuk melakukan ini.";
    case "VALIDATION_FAILED":
      return "Data yang dikirim tidak sesuai. Periksa kembali isianmu.";
    case "ORDER_NOT_FOUND":
      return "Pesanan tidak ditemukan.";
    case "ORDER_STATUS_CHANGED":
      return "Status pesanan sudah berubah. Muat ulang halaman.";
    case "MENU_UNAVAILABLE":
      return "Menu ini sedang tidak tersedia.";
    case "RATE_LIMITED":
      return "Terlalu banyak permintaan. Coba lagi sebentar.";
    case "INTERNAL_ERROR":
    default:
      return "Terjadi kesalahan. Coba lagi.";
  }
}

/**
 * Membuat respons berhasil: { ok: true, data }.
 *
 * Input: data apa pun yang mau dikirim ke pengguna.
 * Output: objek ApiResponse dengan ok bernilai true.
 */
export function ok<T>(data: T): OkResponse<T> {
  return { ok: true, data };
}

/**
 * Membuat respons gagal: { ok: false, error }.
 *
 * Input: error yang sudah berbentuk AppError (type, message, dan code bila ada).
 * Output: objek ApiResponse dengan ok bernilai false.
 */
export function fail(error: AppError): FailResponse {
  return { ok: false, error };
}
