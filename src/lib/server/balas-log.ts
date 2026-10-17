// File ini: membuat respons untuk endpoint log dengan header Cache-Control: no-store.
//
// KENAPA PERLU HEADER no-store: halaman log menampilkan data terbaru setiap kali
// dibuka, dan isinya bisa berbeda setiap beberapa detik (ada transaksi baru yang
// dicatat). Kalau responsnya tersimpan di cache browser atau di cache di tengah, Admin
// bisa membaca log yang sudah lama tanpa sadar. Jadi SEMUA respons log memakai
// "Cache-Control: no-store": tidak boleh ada salinan respons yang dipakai lagi.
//
// Header-nya sengaja diambil dari balas-laporan.ts, bukan ditulis ulang di sini.
// Alasannya: endpoint laporan juga memakai no-store dengan alasan yang sama, dan
// konstanta itu sudah diekspor dari sana. Menyalin isi header yang sama ke dua
// tempat berisiko membuat keduanya berbeda diam-diam. Yang berubah hanya nama
// fungsi pemanggilnya (balasLaporanOk menjadi balasLogOk).
//
// Header no-store ini BUKAN aturan khusus laporan: ini berlaku untuk semua
// bacaan yang isinya boleh berubah setiap saat, jadi pola yang sama bisa dipakai
// endpoint lain di kemudian hari.

import { NextResponse } from "next/server";
import { fail, ok, type AppError } from "@/lib/errors";
import { STATUS_HTTP, balasErrorDatabase } from "./balas";
import { HEADER_LAPORAN } from "./balas-laporan";

/**
 * Membuat respons berhasil untuk endpoint log.
 *
 * Input: data apa pun yang dikirim ke browser.
 * Output: NextResponse berisi { ok: true, data } dengan header no-store.
 */
export function balasLogOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(ok(data), {
    status: status,
    headers: HEADER_LAPORAN,
  });
}

/**
 * Membuat respons gagal untuk endpoint log.
 *
 * Input: objek AppError (type, message, dan code bila ada).
 * Output: NextResponse berisi { ok: false, error } dengan header no-store.
 */
export function balasLogGagal(error: AppError): NextResponse {
  return NextResponse.json(fail(error), {
    status: STATUS_HTTP[error.type],
    headers: HEADER_LAPORAN,
  });
}

/**
 * Mengubah error dari database menjadi respons log.
 *
 * Input:
 *   - error: objek error dari supabase-js (atau error tak terduga).
 *   - konteks: keterangan singkat tentang apa yang sedang gagal, untuk log.
 * Output: NextResponse dengan { ok: false, error } dan header no-store.
 *
 * Kenapa memakai balasErrorDatabase: penjelasan kenapa INTERNAL_ERROR dicatat dan
 * diberi kode ERR-xxxx sedangkan penolakan biasa tidak dicatat, semuanya sudah
 * ditulis di sana. Endpoint log tidak perlu mengulangnya.
 */
export function balasLogDariErrorDatabase(
  error: unknown,
  konteks: string,
): NextResponse {
  return balasErrorDatabase(error, konteks, balasLogGagal);
}
