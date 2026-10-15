// File ini: route handler GET /api/reports/today.
//
// Tugasnya: mengembalikan laporan penjualan HARI INI yang masih berjalan
// (live), sesuai docs/api-contract.md bagian 4c.
//
// Bedanya dengan Riwayat: laporan hari ini belum disimpan, jadi isinya berubah
// setiap ada transaksi. Karena itu laporan ini hanya relevan untuk HARI INI
// (WIB) dan tidak bisa dibuka ulang besok.
//
// PERAN: hanya Cashier dan Admin (docs/pemissions.md bagian 2). Barista
// DITOLAK dengan FORBIDDEN dan percobaannya dicatat sebagai access.denied.
//
// Respons memakai header no-store, supaya angka penjualan yang tampil selalu
// yang terbaru (lihat src/lib/server/balas-laporan.ts).

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasLaporanDariErrorDatabase,
  balasLaporanGagal,
  balasLaporanOk,
} from "@/lib/server/balas-laporan";
import { jagaPeranStaf } from "@/lib/server/jaga-peran";
import { petakanLaporanHariIni } from "@/lib/server/petikan-laporan";

export const dynamic = "force-dynamic";

// Nama endpoint untuk pesan penolakan peran dan pesan log.
const NAMA_ENDPOINT = "laporan hari ini";

// Peran yang boleh memakai endpoint ini. Cashier dan Admin saja.
const PERAN_LAPORAN = ["cashier", "admin"] as const;

/**
 * Handler GET untuk laporan hari ini.
 *
 * Input: tidak ada (hari ini ditentukan server/database, bukan dari klien).
 * Output: { ok: true, data: <isi laporan> } atau { ok: false, error }.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  // 1. Penjagaan peran. Belum login -> UNAUTHENTICATED. Peran lain (mis.
  //    Barista) -> FORBIDDEN plus access.denied dicatat oleh jagaPeranStaf.
  const jaga = await jagaPeranStaf([...PERAN_LAPORAN], NAMA_ENDPOINT);
  if (!jaga.diizinkan) {
    return balasLaporanGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Panggil fungsi database get_today_report.
  //    p_actor_id diisi id staf yang login; peran dibaca lagi di dalam fungsi
  //    dari tabel profiles, jadi nilai dari klien tidak pernah dipercaya.
  //    Fungsi ini sudah mengembalikan jsonb dengan kunci camelCase.
  const { data, error } = await getAdminClient().rpc("get_today_report", {
    p_actor_id: jaga.sesi.userId,
  });

  if (error) {
    // Error dari database diubah menjadi respons yang aman: penolakan bisnis
    // normal (VALIDATION_FAILED, FORBIDDEN) menjadi pesan ramah tanpa mencatat
    // error, sedangkan INTERNAL_ERROR dicatat lewat logError dan diberi kode
    // ERR-xxxx supaya bisa dicari Admin.
    return balasLaporanDariErrorDatabase(error, NAMA_ENDPOINT);
  }

  // 3. Sukses. Isi laporan diteruskan apa adanya; hanya angka yang datang
  //    sebagai teks yang diubah ke angka (docs/api-contract.md bagian 4c).
  return balasLaporanOk(petakanLaporanHariIni(data));
}
