// File ini: membuat respons untuk endpoint laporan dengan header Cache-Control.
//
// KENAPA PERLU FILE INI: laporan hari ini berubah terus-menerus karena
// transaksi masih berjalan. Kalau responsnya tersimpan di cache browser atau di
// cache di tengah, Cashier bisa melihat angka penjualan yang sudah lama. Jadi
// SEMUA respons laporan memakai "Cache-Control: no-store": tidak boleh ada
// salinan respons yang dipakai lagi.
//
// File ini memakai fail/ok dari lib/errors dan STATUS_HTTP dari balas.ts, jadi
// bentuk respons dan kode statusnya sama persis dengan endpoint lain
// (docs/api-contract.md bagian 1). Yang berbeda hanya headernya.

import { NextResponse } from "next/server";
import { fail, ok, type AppError } from "@/lib/errors";
import { STATUS_HTTP, balasErrorDatabase } from "./balas";

// Header yang dipasang pada SETIAP respons laporan, sukses maupun gagal.
//
//   no-store          : jangan menyimpan respons ini sama sekali (tidak di
//                       browser, tidak di proxy, tidak di cache mana pun).
//   no-cache, must-   : kalau ada yang tetap menyimpannya, jangan memakainya
//   revalidate          tanpa bertanya dulu ke server.
export const HEADER_LAPORAN: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

/**
 * Membuat respons berhasil untuk endpoint laporan.
 *
 * Input: data apa pun yang dikirim ke pemanggil.
 * Output: NextResponse berisi { ok: true, data } dengan header no-store.
 */
export function balasLaporanOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(ok(data), {
    status: status,
    headers: HEADER_LAPORAN,
  });
}

/**
 * Membuat respons gagal untuk endpoint laporan.
 *
 * Input: objek AppError (type, message, dan code bila ada).
 * Output: NextResponse berisi { ok: false, error } dengan header no-store.
 *
 * Status HTTP-nya mengikuti tipe error, sama seperti balasGagal biasa, karena
 * pemetaannya diambil dari satu tempat (STATUS_HTTP di balas.ts).
 */
export function balasLaporanGagal(error: AppError): NextResponse {
  return NextResponse.json(fail(error), {
    status: STATUS_HTTP[error.type],
    headers: HEADER_LAPORAN,
  });
}

/**
 * Mengubah error dari database menjadi respons laporan.
 *
 * Input:
 *   - error: objek error dari supabase-js (atau error tak terduga).
 *   - konteks: keterangan singkat tentang apa yang sedang gagal, untuk log.
 * Output: NextResponse dengan { ok: false, error } dan header no-store.
 *
 * Isi dan logikanya sama persis dengan balasDariErrorDatabase (penyebabnya ada
 * di sana), hanya pembuat responsnya yang memakai header laporan. Karena itu
 *_balas.ts_ dipakai, bukan menulis ulang blok yang sama.
 */
export function balasLaporanDariErrorDatabase(
  error: unknown,
  konteks: string,
): NextResponse {
  return balasErrorDatabase(error, konteks, balasLaporanGagal);
}

/**
 * Membuat respons "laporan tidak ditemukan".
 *
 * Output: NextResponse dengan tipe VALIDATION_FAILED dan header no-store.
 *
 * Kenapa khusus: id laporan yang bukan uuid tidak mungkin ada di database, jadi
 * jawabannya sama dengan laporan yang tidak ditemukan. Karena itu database tidak
 * boleh disentuh, dan penolakan ini juga tidak dicatat ke error_logs: itu
 * penolakan bisnis normal, bukan kegagalan sistem
 * (docs/api-contract.md bagian 6).
 */
export function balasLaporanTidakDitemukan(): NextResponse {
  return balasLaporanGagal({
    type: "VALIDATION_FAILED",
    message: "Laporan tidak ditemukan.",
  });
}
