// File ini: pemeriksaan sederhana ukuran body permintaan.
//
// Kenapa: Next.js tidak memberi pengaturan body size yang mudah untuk route
// handler App Router tanpa konfigurasi server khusus. Karena itu kita cek
// header Content-Length di awal handler. Kalau terlalu besar, tolak sebelum
// memanggil request.json() (yang akan membaca seluruh body ke memori).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { balasGagal } from "@/lib/server/balas";

// Batas bawaan yang dipakai endpoint POST publik dan staf.
export const BATAS_UKURAN_BODY = 16 * 1024; // 16 KB

/**
 * Memeriksa ukuran body permintaan.
 *
 * Input: request dan batas maksimal dalam byte (default 16 KB).
 * Output: null kalau ukuran aman (atau tidak diketahui); NextResponse gagal
 *         kalau Content-Length melebihi batas.
 *
 * Cara pakai di handler:
 *   const tolak = periksaUkuranBody(request);
 *   if (tolak) return tolak;
 */
export function periksaUkuranBody(
  request: NextRequest,
  batas = BATAS_UKURAN_BODY,
): NextResponse | null {
  const panjang = request?.headers?.get?.("content-length") ?? null;
  if (panjang === null) return null;
  const angka = Number(panjang);
  if (Number.isNaN(angka)) return null;
  if (angka > batas) {
    return balasGagal({
      type: "VALIDATION_FAILED",
      message: "Ukuran data yang dikirim terlalu besar (maksimal 16 KB).",
      code: "ERR-BODY-TOO-LARGE",
    });
  }
  return null;
}
