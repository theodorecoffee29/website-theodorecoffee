// File ini: membuat respons untuk endpoint kelola akun dengan header
// Cache-Control: no-store.
//
// KENAPA PERLU HEADER no-store: daftar akun memuat email dan kapan terakhir masuk.
// Kalau responsnya tersimpan di cache browser atau di cache di tengah, Admin bisa
// melihat data lama tanpa sadar setelah ia berubah (mis. akun baru sudah dibuat tapi
// layarnya masih menampilkan daftar lama). Jadi SEMUA respons akun memakai no-store.
//
// Header-nya sengaja diambil dari balas-laporan.ts, bukan ditulis ulang: isinya sama
// persis dan menuliskannya dua kali berisiko membuat keduanya berbeda diam-diam.
//
// CATATAN SOAL KODE STATUS: balasGagal dari src/lib/server/balas.ts sudah memetakan
// tipe error ke kode HTTP yang benar (VALIDATION_FAILED jadi 400, FORBIDDEN jadi 403,
// dan seterusnya), jadi file ini cukup memakai ulang logika itu.

import { NextResponse } from "next/server";
import { fail, ok, type AppError } from "@/lib/errors";
import { balasErrorDatabase, balasValidasiGagal, STATUS_HTTP } from "./balas";
import { HEADER_LAPORAN } from "./balas-laporan";

/**
 * Membuat respons berhasil untuk endpoint akun.
 *
 * Input: data apa pun yang dikirim ke browser.
 * Output: NextResponse berisi { ok: true, data } dengan header no-store.
 */
export function balasAkunOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(ok(data), {
    status: status,
    headers: HEADER_LAPORAN,
  });
}

/**
 * Membuat respons gagal untuk endpoint akun.
 *
 * Input: objek AppError (type, message, dan code bila ada).
 * Output: NextResponse berisi { ok: false, error } dengan header no-store.
 */
export function balasAkunGagal(error: AppError): NextResponse {
  return NextResponse.json(fail(error), {
    status: STATUS_HTTP[error.type],
    headers: HEADER_LAPORAN,
  });
}

/**
 * Membuat respons penolakan validasi yang menyebut field yang salah.
 *
 * Input: array pesan kesalahan dari zod (hasil .error.issues).
 * Output: NextResponse dengan tipe VALIDATION_FAILED dan header no-store.
 *
 * Kenapa tidak memakai balasValidasiGagal dari balas.ts: fungsi itu tidak memasang
 * header no-store, sedangkan respons akun harus memakainya. Isi dan format pesannya
 * sama persis, jadi logikanya dipakai ulang lewat parameter yang sama.
 */
export function balasAkunValidasiGagal(
  issues: readonly { path: unknown[]; message: string }[],
): NextResponse {
  return balasValidasiGagal(issues);
}

/**
 * Mengubah error dari database menjadi respons akun.
 *
 * Input: error apa pun dari PostgREST, dan keterangan singkat untuk log.
 * Output: NextResponse dengan { ok: false, error } dan header no-store.
 *
 * Dipakai untuk kegagalan dari tabel profiles. Kegagalan dari Supabase Auth
 * TIDAK lewat sini: Auth tidak memakai raise exception seperti fungsi database
 * proyek ini, jadi errornya ditangani sendiri di src/lib/server/kelola-akun.ts.
 */
export function balasAkunDariErrorDatabase(
  error: unknown,
  konteks: string,
): NextResponse {
  return balasErrorDatabase(error, konteks, balasAkunGagal);
}
