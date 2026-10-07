// ============================================================================
// SEMENTARA, hapus di Fase 3.
// ============================================================================
//
// File ini: route development untuk mengecek fungsi database get_menu.
// Gunanya hanya memeriksa fondasi server: apakah klien admin bisa memanggil
// fungsi database dan mengembalikan JSON. Ini bukan fitur aplikasi.
//
// Kenapa route ini harus dihapus di Fase 3: route ini memakai kunci service
// role untuk mengambil data apa pun yang diminta. Kalau route seperti ini
// terbawa ke production, siapa pun yang mengetahui alamatnya bisa memakai
// kunci service role aplikasi kita lewat server. Karena itu route ini hanya
// boleh hidup di development.
//
// Pengaman yang dipakai di sini:
//   1. Kalau NODE_ENV adalah "production", route ini membalas 404 sehingga
//      route ini dianggap tidak ada sama sekali di server production.
//   2. Nama foldernya "dev" sehingga mudah dicari saat menghapus nanti.
//
// Cara memakai: jalankan `npm run dev`, lalu buka di browser:
//   http://localhost:3000/api/dev/menu
// Balasannya adalah JSON berisi daftar menu aktif beserta status ketersediaannya.

import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fromDatabaseError, fail, ok } from "@/lib/errors";
import { logError } from "@/lib/log";

// Route ini tidak boleh di-cache supaya data menu selalu terbaru saat dicek
// selama development.
export const dynamic = "force-dynamic";

/**
 * Handler GET untuk route development /api/dev/menu.
 *
 * Alurnya:
 *   1. Kalau NODE_ENV production, balas 404 dan berhenti.
 *   2. Panggil fungsi database get_menu lewat klien admin.
 *   3. Kalau gagal, catat lewat logError dan balas fail().
 *   4. Kalau berhasil, balas ok(data) sesuai format api-contract bagian 1.
 */
export async function GET() {
  // Pengaman nomor 1: route ini tidak boleh hidup di production.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    // Panggil fungsi database get_menu. Memakai klien admin karena fungsi ini
    // hanya boleh dipanggil server yang memegang kunci service role.
    const { data, error } = await getAdminClient().rpc("get_menu");

    // supabase-js mengembalikan objek { data, error }; kalau error tidak kosong,
    // berarti pemanggilan fungsi gagal (mis. RLS menutup atau fungsi belum ada).
    if (error) {
      const kode = logError({
        message: "Gagal memanggil get_menu dari route dev: " + error.message,
        severity: "error",
        source: "database",
        context: { file: "src/app/api/dev/menu/route.ts" },
      });

      const appError = fromDatabaseError(error);
      // Samakan nama variabel dengan nama properti: kode error = kode.
      return NextResponse.json(fail({ ...appError, code: kode }), {
        status: 500,
      });
    }

    // Berhasil: kirim data apa adanya sesuai format api-contract bagian 1.
    return NextResponse.json(ok(data));
  } catch (error) {
    // Tangkap error yang tidak terduga (mis. env belum lengkap) supaya tidak
    // menggagalkan halaman, tapi tetap dicatat supaya mudah dicari.
    const kode = logError({
      message: "Kesalahan tak terduga di route dev menu: " + String(error),
      severity: "error",
      source: "server",
      context: { file: "src/app/api/dev/menu/route.ts" },
    });

    return NextResponse.json(
      fail({
        type: "INTERNAL_ERROR",
        message: "Terjadi kesalahan. Coba lagi.",
        code: kode,
      }),
      { status: 500 },
    );
  }
}
