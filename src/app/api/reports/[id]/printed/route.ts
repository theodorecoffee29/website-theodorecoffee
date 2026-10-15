// File ini: route handler POST /api/reports/[id]/printed.
//
// Tugasnya: mencatat bahwa Cashier/Admin sudah MENCETAK satu laporan
// (docs/logging.md bagian 2: aksi "report.printed").
//
// Kenapa Printing perlu dicatat: Riwayat tidak boleh berubah setelah tersimpan
// (docs/pemissions.md bagian 2), jadi jejak siapa yang mengambil salinan
// laporan itu penting. Laporan bisa berisi omzet seluruh hari.
//
// PERAN: hanya Cashier dan Admin. Barista DITOLAK dengan FORBIDDEN dan
// access.denied dicatat.
//
// CATATAN PENTING SOAL KEGAGALAN:
//   Endpoint ini tidak mengubah apa pun di laporan. Yang dia lakukan hanya
//   menulis satu catatan log. Jadi kalau penulisan log gagal, TIDAK boleh
//   menjadi error 500 untuk pengguna: bukan kegagalan sistem yang membuat
//   penghentian, dan Admin tetap tidak boleh gagal mencetak struk karena server
//   sedang lambat. Kegagalan dicatat lewat logError, lalu endpoint membalas
//   { logged: false } supaya layar bisa memberi tahu tanpa memblokir apa pun
//   (docs/logging.md bagian 6 poin 4).

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasLaporanDariErrorDatabase,
  balasLaporanGagal,
  balasLaporanOk,
  balasLaporanTidakDitemukan,
} from "@/lib/server/balas-laporan";
import { logActivity, logError } from "@/lib/log";
import { jagaPeranStaf, metaSesi } from "@/lib/server/jaga-peran";
import { laporanIdSchema } from "@/lib/server/validasi";

export const dynamic = "force-dynamic";

// Nama endpoint untuk pesan penolakan peran dan pesan log.
const NAMA_ENDPOINT = "catat laporan dicetak";

// Peran yang boleh memakai endpoint ini. Cashier dan Admin saja.
const PERAN_LAPORAN = ["cashier", "admin"] as const;

/**
 * Handler POST untuk mencatat laporan yang dicetak.
 *
 * Input: id laporan dari parameter alamat ([id]). Body tidak dipakai.
 * Output: { ok: true, data: { logged: true | false } } atau
 *         { ok: false, error } kalau idnya tidak valid atau laporannya tidak ada.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran.
  const jaga = await jagaPeranStaf([...PERAN_LAPORAN], NAMA_ENDPOINT);
  if (!jaga.diizinkan) {
    return balasLaporanGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil id dari alamat dan validasi bentuknya dengan zod.
  const { id } = await params;
  const hasilValidasi = laporanIdSchema.safeParse({ id: id });
  if (!hasilValidasi.success) {
    // Id tidak mungkin ada, jadi tidak perlu menyentuh database.
    return balasLaporanTidakDitemukan();
  }

  const idLaporan = hasilValidasi.data.id;

  // 3. Pastikan laporannya benar-benar ada, dengan SATU query ke daftar laporan.
  //
  //    Kenapa perlu dicek di sini: tanpa ini, Cashier bisa mencatat "dicetak"
  //    untuk id yang tidak pernah ada, dan log-nya jadi tidak dipercaya.
  //    Dipakai maybeSingle() supaya hasilnya null kalau tidak ada, bukan error.
  //
  //    Query ini memakai klien admin (service_role), yang melewati RLS, karena
  //    tabel daily_reports hanya boleh dibaca oleh Admin lewat RLS. Pola yang
  //    sama dipakai endpoint admin lain.
  const { error: errorCek } = await getAdminClient()
    .from("daily_reports")
    .select("id")
    .eq("id", idLaporan)
    .maybeSingle();

  if (errorCek) {
    return balasLaporanDariErrorDatabase(errorCek, NAMA_ENDPOINT);
  }

  // 4. Catat aktivitas report.printed.
  //
  //    entity_type "report" dan entity_id id laporan, sesuai
  //    docs/data-model.md. Actor diambil dari sesi login, bukan dari kiriman
  //    klien. Meta memuat session_id karena satu akun bisa dipakai di beberapa
  //    laptop (docs/pemissions.md bagian 1), jadi Admin tahu laporan ini diambil
  //    dari perangkat mana.
  //
  //    logActivity sengaja dibungkus try/catch: kalau ia melempar error, aksi
  //    ini tidak boleh menggagalkan pencetakan. Dilaporkan lewat logged: false.
  let berhasilDicatat = true;
  try {
    logActivity({
      action: "report.printed",
      actorRole: jaga.sesi.role,
      actorId: jaga.sesi.userId,
      entityType: "report",
      entityId: idLaporan,
      meta: metaSesi(jaga.sesi),
    });
  } catch (error) {
    berhasilDicatat = false;

    // Dicatat supaya Admin tahu ada laporan yang dicetak tapi jejaknya hilang.
    logError({
      message: "Gagal menulis log report.printed: " + String(error),
      severity: "error",
      source: "server",
      context: {
        konteks: NAMA_ENDPOINT,
        reportId: idLaporan,
      },
      userId: jaga.sesi.userId,
    });
  }

  // 5. Sukses. Ini bukan error: laporan sudah ada dan dicetak, yang hilang
  //    cuma jejaknya di log.
  return balasLaporanOk({ logged: berhasilDicatat });
}
