// File ini: membantu setiap route handler membuat respons dengan bentuk yang
// sama (docs/api-contract.md bagian 1) dan_status HTTP yang sesuai.
//
// Semua route handler memakai file ini supaya tidak ada satu pun yang lupa
// membungkus jawabannya dengan format { ok, data } atau { ok, error }.

import { NextResponse } from "next/server";
import {
  ambilDetailError,
  fail,
  fromDatabaseError,
  ok,
  pesanRamahUntuk,
  type AppError,
  type ErrorType,
} from "@/lib/errors";
import { logError } from "@/lib/log";

// Kode status HTTP untuk setiap tipe error. Ini penting supaya kode di browser
// (fetch) tahu membedakan jenis kegagalan tanpa membaca isi json.
const STATUS_HTTP: Record<ErrorType, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  ORDER_NOT_FOUND: 404,
  ORDER_STATUS_CHANGED: 409,
  MENU_UNAVAILABLE: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Membuat respons berhasil dengan status 200 (atau status lain bila perlu).
 *
 * Input: data apa pun yang dikirim ke pemanggil.
 * Output: objek NextResponse berisi { ok: true, data }.
 */
export function balasOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(ok(data), { status });
}

/**
 * Membuat respons gagal dari objek AppError, dengan status HTTP yang sesuai
 * tipe errornya.
 *
 * Input:
 *   - error: objek AppError (type, message, dan code bila ada).
 *   - status: status HTTP khusus bila ingin menimpa nilai bawaan.
 * Output: objek NextResponse berisi { ok: false, error }.
 */
export function balasGagal(error: AppError, status?: number): NextResponse {
  const statusAkhir = status ?? STATUS_HTTP[error.type];
  return NextResponse.json(fail(error), { status: statusAkhir });
}

/**
 * Membuat respons VALIDATION_FAILED yang menyebutkan field mana yang salah.
 *
 * Input: array pesan kesalahan dari zod (hasil .error.issues).
 * Output: NextResponse dengan tipe VALIDATION_FAILED.
 *
 * Kenapa menyebut field: docs/api-contract.md bagian 6 meminta respons
 * mentioning field yang salah, supaya pengguna tahu apa yang perlu diperbaiki.
 * Detail teknis zod tidak ikut ditampilkan, hanya nama field dan pesannya.
 */
export function balasValidasiGagal(
  issues: readonly { path: unknown[]; message: string }[],
): NextResponse {
  // Ringkas jadi satu kalimat per field yang bermasalah. Path dari zod bisa
  // berisi angka (untuk index array) atau string (nama field), jadi keduanya
  // diubah menjadi teks lebih dulu.
  const ringkas = issues
    .map((isu) => {
      const namaField = isu.path.map((bagian) => String(bagian)).join(".");
      return namaField.length > 0
        ? `${namaField}: ${isu.message}`
        : isu.message;
    })
    .join("; ");

  return balasGagal({
    type: "VALIDATION_FAILED",
    message: "Data yang dikirim tidak sesuai. " + ringkas,
  });
}

/**
 * Membuat respons ORDER_NOT_FOUND standar (status 404).
 *
 * Input: tidak ada.
 * Output: NextResponse { ok: false, error: { type: "ORDER_NOT_FOUND", ... } }.
 *
 * Kenapa dipakai di route handler: id order yang bukan uuid ditolak SEBELUM
 * menyentuh database. Jadi route handler memanggil fungsi ini dan berhenti;
 * database tidak disentuh dan error_logs tidak ditulis (bukan kegagalan sistem).
 */
export function balasOrderTidakDitemukan(): NextResponse {
  return balasGagal({
    type: "ORDER_NOT_FOUND",
    message: pesanRamahUntuk("ORDER_NOT_FOUND"),
  });
}

/**
 * Mengubah error apa pun yang muncul saat memanggil database menjadi respons.
 *
 * Input:
 *   - error: objek error dari supabase-js (atau error tak terduga).
 *   - konteks: keterangan singkat tentang apa yang sedang gagal, dipakai untuk
 *     log. Contoh: "confirm_order".
 * Output: NextResponse dengan format gagal.
 *
 * Cara kerja:
 *   1. Error dari database diubah menjadi tipe error lewat fromDatabaseError.
 *      Fungsi database melempar raise exception dengan message berupa tipe
 *      error, jadi message itu yang dibaca.
 *   2. Kalau hasilnya INTERNAL_ERROR (artinya kegagalan yang tidak dikenal),
 *      kegagalan itu dicatat lewat logError dan kode ERR-xxxx disertakan di
 *      respons supaya bisa dicari di error_logs.
 *   3. Kalau bukan INTERNAL_ERROR (misalnya ORDER_STATUS_CHANGED), tidak dicatat
 *      karena penolakan bisnis normal bukan kegagalan sistem
 *      (docs/api-contract.md bagian 6).
 */
export function balasDariErrorDatabase(
  error: unknown,
  konteks: string,
): NextResponse {
  const appError = fromDatabaseError(error);

  if (appError.type === "INTERNAL_ERROR") {
    // Baca isi error dengan benar (message, code, details, hint). Sebelumnya
    // objek error diubah dengan String(error) sehingga tertulis
    // "[object Object]" dan penyebab aslinya hilang.
    const detail = ambilDetailError(error);

    // Dicatat sebagai kegagalan sistem, dan kodenya dikembalikan ke pengguna.
    // Keempat field detail ikut dimasukkan ke context. redactSecrets (di dalam
    // logError) tetap membersihkan context sebelum ditulis ke database.
    const kode = logError({
      message: "Gagal memanggil database di " + konteks + ": " + detail.message,
      severity: "error",
      source: "database",
      context: {
        konteks: konteks,
        message: detail.message,
        code: detail.code,
        details: detail.details,
        hint: detail.hint,
      },
    });

    return balasGagal({ ...appError, code: kode });
  }

  return balasGagal(appError);
}
