// File ini: mengubah error dari database pada endpoint Admin menjadi respons.
//
// KENAPA FILE INI TERPISA DARI balasDariErrorDatabase: fungsi database Admin
// menulis detail yang BERGUNA untuk Admin, misalnya
//   'name "Kopi Susu" sudah dipakai (huruf besar/kecil tidak dibedakan)'
// atau 'bahan dengan id ... tidak ditemukan'. Detail itu dibuat sendiri oleh
// kode kita (bukan pesan error PostgreSQL), jadi aman dan sangat membantu Admin
// tahu apa yang harus diperbaiki.
//
// balasDariErrorDatabase yang umum sengaja membuang semua detail, karena untuk
// customer detail teknis tidak boleh tampil. Untuk Admin, membuang "nama sudah
// dipakai" justru membuat dia bingung.
//
// Yang TIDAK boleh ikut: pesan PostgreSQL yang tidak kita tulis sendiri
// (misalnya "violates foreign key constraint"), kode SQL, dan hint. Jadi hanya
// detail yang persis berupa tipe error milik kita sendiri yang diteruskan.

import {
  ambilDetailError,
  fromDatabaseError,
  type AppError,
} from "@/lib/errors";
import { logError } from "@/lib/log";
import { balasGagal } from "@/lib/server/balas";

/**
 * Mengubah error dari database pada endpoint Admin menjadi respons.
 *
 * Input:
 *   - error: objek error dari supabase-js (atau error tak terduga),
 *   - konteks: keterangan singkat tentang apa yang sedang gagal, untuk log.
 *             Contoh: "create_menu_item".
 * Output: NextResponse dengan format gagal.
 *
 * Cara kerja:
 *   1. Error dibaca lewat ambilDetailError supaya isi objeknya tidak berubah
 *      menjadi "[object Object]".
 *   2. Tipenya dibaca dari field message. Fungsi database Admin melempar
 *      raise exception dengan message berupa VALIDATION_FAILED atau FORBIDDEN,
 *      jadi keduanya terbaca dengan benar.
 *   3. Kalau VALIDATION_FAILED, detail yang aman ikut dikirim ke Admin (lihat
 *      penjelasan di kepala file).
 *   4. Kalau INTERNAL_ERROR (kegagalan yang tidak dikenal), kegagalan dicatat
 *      lewat logError dan kode ERR-xxxx dikembalikan supaya bisa dicari di
 *      error_logs.
 */
export function balasDariErrorAdmin(
  error: unknown,
  konteks: string,
): ReturnType<typeof balasGagal> {
  const appError = fromDatabaseError(error);
  const detail = ambilDetailError(error);

  if (appError.type === "INTERNAL_ERROR") {
    // Dicatat sebagai kegagalan sistem, dan kodenya dikembalikan ke Admin.
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

  // Penolakan yang bukan kegagalan sistem: tidak dicatat ke error_logs
  // (docs/api-contract.md bagian 6).
  if (appError.type === "VALIDATION_FAILED") {
    return balasGagal({
      type: "VALIDATION_FAILED",
      message: pesanValidasiAdmin(detail.details, appError),
    });
  }

  // FORBIDDEN dan tipe lain: pakai pesan ramah bawaannya.
  return balasGagal(appError);
}

/**
 * Menyusun pesan VALIDATION_FAILED untuk Admin.
 *
 * Input: detail dari database (bisa null), dan AppError hasil pemetaan.
 * Output: pesan yang aman untuk dikirim ke Admin.
 *
 * Aturan: detail dari database hanya dipakai kalau aman, yaitu kalau isinya
 * bukan kosong, tidak terlalu panjang, dan tidak tampak seperti pesan error
 * PostgreSQL (yang biasanya berisi nama constraint atau baris tabel).
 *
 * Kalau detailnya tidak aman, pesan ramah bawaan yang dipakai. Ini penting:
 * endpoint Admin memanggil fungsi yang kodenya kita kendalikan, tapi kalau suatu
 * saat ada error lain (mis. pelanggaran constraint dari database yang belum kita
 * tangani), pesan PostgreSQL-nya tidak boleh bocor ke layar.
 */
function pesanValidasiAdmin(
  details: string | null,
  appError: AppError,
): string {
  // Detail kosong: pakai pesan bawaan.
  if (details === null || details.trim() === "") {
    return appError.message;
  }

  const teks = details.trim();

  // Terlalu panjang: bukan pesan yang ditulis untuk dibaca Admin.
  if (teks.length > 300) {
    return appError.message;
  }

  // Ada tanda-tanda pesan teknis PostgreSQL: jangan diteruskan.
  // (nama constraint, nama tabel/kolom, atau kata yang muncul di error SQL)
  const polaTeknis = [
    "constraint",
    "violates",
    "duplicate key",
    "SQLSTATE",
    "public.",
    "pg_",
  ];
  for (const pola of polaTeknis) {
    if (teks.includes(pola)) {
      return appError.message;
    }
  }

  // Detailnya aman: kirim bersama pesan dasar supaya konteksnya jelas.
  return appError.message + " (" + teks + ")";
}
