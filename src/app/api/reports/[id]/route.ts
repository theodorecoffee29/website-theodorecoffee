// File ini: route handler GET /api/reports/[id].
//
// Tugasnya: mengembalikan isi SATU laporan yang sudah tersimpan (snapshot),
// sesuai docs/api-contract.md bagian 4c.
//
// PERAN: hanya Cashier dan Admin (docs/pemissions.md bagian 2). Barista
// DITOLAK dengan FORBIDDEN dan access.denied dicatat.
//
// VALIDASI ID: id dicek dengan zod SEBELUM database disentuh. Id yang bukan
// uuid tidak mungkin ada, jadi jawabannya sama dengan "laporan tidak ditemukan".
// Penolakan seperti ini bukan kegagalan sistem, jadi tidak dicatat ke
// error_logs (docs/api-contract.md bagian 6).
//
// CATATAN: Riwayat tidak boleh berubah setelah tersimpan. Endpoint ini hanya
// MEMBACA; tidak ada endpoint yang menulis atau menghapus laporan.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasLaporanDariErrorDatabase,
  balasLaporanGagal,
  balasLaporanOk,
  balasLaporanTidakDitemukan,
} from "@/lib/server/balas-laporan";
import { jagaPeranStaf } from "@/lib/server/jaga-peran";
import { laporanIdSchema } from "@/lib/server/validasi";
import { petakanLaporanTersimpan } from "@/lib/server/petikan-laporan";

export const dynamic = "force-dynamic";

// Nama endpoint untuk pesan penolakan peran dan pesan log.
const NAMA_ENDPOINT = "isi laporan";

// Peran yang boleh memakai endpoint ini. Cashier dan Admin saja.
const PERAN_LAPORAN = ["cashier", "admin"] as const;

/**
 * Handler GET untuk isi satu laporan.
 *
 * Input: id laporan dari parameter alamat ([id]).
 * Output: { ok: true, data: { reportId, date, generatedAt, data } } atau
 *         { ok: false, error }.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran.
  const jaga = await jagaPeranStaf([...PERAN_LAPORAN], NAMA_ENDPOINT);
  if (!jaga.diizinkan) {
    return balasLaporanGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Di Next.js 15 ke atas, params harus di-await.
  const { id } = await params;

  // 3. Validasi id dengan zod, SEBELUM menyentuh database.
  const hasilValidasi = laporanIdSchema.safeParse({ id: id });
  if (!hasilValidasi.success) {
    // Id tidak mungkin ada, jadi jawabannya sama dengan laporan yang tidak
    // ditemukan. Database tidak disentuh dan error_logs tidak ditulis.
    return balasLaporanTidakDitemukan();
  }

  // 4. Panggil fungsi database get_report.
  //    p_report_id dikirim sebagai teks (sesuai signature fungsi), bukan uuid:
  //    sudah dipastikan uuid oleh langkah sebelumnya.
  const { data, error } = await getAdminClient().rpc("get_report", {
    p_actor_id: jaga.sesi.userId,
    p_report_id: hasilValidasi.data.id,
  });

  if (error) {
    // Fungsi database memakai VALIDATION_FAILED dengan detail "laporan tidak
    // ditemukan" kalau idnya tidak ada. fromDatabaseError mengubahnya menjadi
    // pesan ramah tanpa mencatat error, karena itu penolakan bisnis normal.
    return balasLaporanDariErrorDatabase(error, NAMA_ENDPOINT);
  }

  // 5. Sukses. Isi laporan diteruskan apa adanya; hanya angkanya yang diubah.
  return balasLaporanOk(petakanLaporanTersimpan(data));
}
