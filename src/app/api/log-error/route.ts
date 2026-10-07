// File ini: route handler POST /api/log-error.
//
// Tugasnya: menerima error penting yang terjadi di browser dan mencatatnya ke
// tabel error_logs (docs/logging.md bagian 7).
//
// Yang diterima (docs/logging.md bagian 7):
//   - gagal kirim order,
//   - gagal muat status,
//   - gagal konfirmasi,
//   - gagal aksi Cashier/Barista.
// Jadi HANYA empat jenis ini yang diterima. Jenis lain ditolak supaya browser
// tidak bisa membanjiri tabel log dengan error palsu (mis. error kecil atau
// percobaan sengaja).
//
// Pengaman:
//   - Ada pembatas permintaan per IP.
//   - Isi dipangkas oleh zod (batas panjang message dan context).
//   - Isi DIBERSIHKAN lewat redactSecrets supaya password, token, atau api key
//     tidak pernah masuk ke log (docs/logging.md bagian 6 poin 3).
//   - Body tidak pernah disimpan utuh, hanya message, context, dan orderId.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { balasGagal, balasValidasiGagal } from "@/lib/server/balas";
import {
  periksaPembatas,
  BATASAN_ENDPOINT,
} from "@/lib/server/pembatas-permintaan";
import { ambilIpPemanggil } from "@/lib/server/ambil-ip";
import { logErrorBrowserSchema } from "@/lib/server/validasi";
import { logError, redactSecrets } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // 1. Pembatas permintaan. Ketat, karena ini bukan aksi bisnis dan tidak boleh
  //    dipakai untuk membanjiri tabel error_logs.
  const cekBatas = periksaPembatas(
    "log-error:" + ambilIpPemanggil(request),
    Date.now(),
    BATASAN_ENDPOINT.logError,
  );
  if (!cekBatas.boleh) {
    return balasGagal({
      type: "RATE_LIMITED",
      message: "Terlalu banyak permintaan. Coba lagi sebentar.",
    });
  }

  // 2. Baca body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasGagal({
      type: "VALIDATION_FAILED",
      message: "Body permintaan harus berupa JSON yang valid.",
    });
  }

  // 3. Validasi: hanya jenis error yang terdaftar, dan isinya dipangkas.
  const hasilValidasi = logErrorBrowserSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { kind, message, context, orderId } = hasilValidasi.data;

  // 4. Bersihkan isi dari nilai rahasia (password, token, api key, dll).
  //    redactSecrets mengganti nilai pada kunci yang mengandung kata-kata itu
  //    dengan "[DISEMBUNYIKAN]". Hasilnya diubah ke bentuk objek biasa supaya
  //    bisa digabung di bawah.
  const contextBersih = redactSecrets(context ?? {}) as Record<string, unknown>;

  // 5. Catat ke error_logs. source = "client" karena error berasal dari browser.
  //    Semua error dari browser diberi severity "error" karena itu aksi yang
  //    gagal, bukan peringatan kecil.
  //
  //    Catatan: kegagalan menulis log TIDAK boleh menggagalkan aksi ini sendiri.
  //    Respons tetap "diterima" walau penulisan ke database gagal, karena
  //    browser hanya ingin mengirim error, bukan melakukan aksi bisnis.
  logError({
    message: "[browser] " + kind + ": " + message,
    severity: "error",
    source: "client",
    context: {
      kind: kind,
      ...contextBersih,
    },
    orderId: orderId,
  });

  // 6. Balas ringkas. Isi respons sengaja tidak meniru isi database.
  return NextResponse.json(
    { ok: true, data: { tercatat: true } },
    { status: 202 },
  );
}
