// File ini: membantu route handler Admin membaca dan memeriksa id dari alamat.
//
// KENAPA PERLU: setiap route yang punya id di alamat (menu/[id], ingredients/[id])
// harus menolak id yang bukan uuid SEBELUM menyentuh database. Alasannya:
//   - id yang bukan uuid pasti tidak ada di database, jadi jawabannya sama dengan
//     "tidak ditemukan" (docs/api-contract.md bagian 4b),
//   - dan ini BUKAN kegagalan sistem, jadi tidak boleh ditulis ke error_logs.
//     Kalau diteruskan ke database, PostgreSQL akan melempar error yang technical
//     dan bisa salah dicatat sebagai kegagalan sistem.
//
// Pola ini sama dengan yang dipakai route order di tugas sebelumnya (lihat
// balasOrderTidakDitemukan dan apakahUuidValid).
//
// File ini MURNI (tanpa database), jadi bisa diuji langsung.

import { NextResponse } from "next/server";
import { apakahUuidValid } from "@/lib/uuid";
import { balasGagal } from "@/lib/server/balas";

/**
 * Memeriksa id dari alamat dan mengembalikan respons 400 kalau tidak valid.
 *
 * Input:
 *   - id: nilai id yang diambil dari parameter alamat,
 *   - namaField: nama field untuk pesan, misal "menuItemId" atau "ingredientId".
 * Output:
 *   - null kalau id-nya valid (route boleh lanjut memanggil database), atau
 *   - NextResponse kalau idnya tidak valid (route harus langsung mengembalikannya).
 *
 * Cara pakai di route handler:
 *   const cek = cekIdAlamat(id, "menuItemId");
 *   if (cek !== null) {
 *     return cek;
 *   }
 */
export function cekIdAlamat(
  id: string,
  namaField: string,
): NextResponse | null {
  if (apakahUuidValid(id)) {
    return null;
  }

  // Id tidak valid: jawabannya VALIDATION_FAILED (bukan ORDER_NOT_FOUND, karena
  // ini bukan order) dan database tidak disentuh.
  return balasGagal({
    type: "VALIDATION_FAILED",
    message: `${namaField} harus berupa uuid yang valid.`,
  });
}
