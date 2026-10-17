// File ini: route handler POST /api/reports/today/printed.
//
// Tugasnya: mencatat bahwa Cashier/Admin sudah MENCETAK laporan HARI INI yang
// live (docs/logging.md bagian 2: aksi "report.printed").
//
// KENAPA ADA ENDPOINT TERPISAH: laporan hari ini belum tersimpan, jadi tidak
// punya id laporan seperti laporan di Riwayat. Endpoint
// /api/reports/[id]/printed tidak bisa dipakai karena tidak ada id. Endpoint ini
// sengaja dibuat sangat kecil: satu panggilan, satu catatan log.
//
// CATATAN SOAL ENTITY_ID KOSONG: isi catatan memakai entity_type "report" dengan
// entity_id kosong (null), dan tanggal laporan disimpan di meta. Alasannya:
// laporan hari ini memang tidak ada di tabel daily_reports, jadi menuliskan id
// yang tidak ada akan membuat activity_logs menunjuk ke baris yang tidak bisa
// dibuka.
//
// PERAN: hanya Cashier dan Admin (docs/pemissions.md bagian 2). Barista dan
// customer DITOLAK, dan percobaannya dicatat sebagai access.denied oleh
// jagaPeranStaf.
//
// CATATAN PENTING SOAL KEGAGALAN:
//   Endpoint ini tidak mengubah apa pun di laporan, dia hanya menulis satu catatan
//   log. Jadi kalau penulisan log gagal, TIDAK boleh menjadi error untuk pengguna:
//   cetakannya sudah jadi di layar Cashier, dan endpoint yang lambat tidak boleh
//   membuat Admin merasa gagal mencetak laporan. Kegagalan dicatat lewat logError,
//   lalu endpoint membalas { logged: false } supaya layar tidak perlu memblokir apa
//   pun (docs/logging.md bagian 6 poin 4).

import type { NextRequest } from "next/server";
import { balasLaporanGagal, balasLaporanOk } from "@/lib/server/balas-laporan";
import { logActivity, logError } from "@/lib/log";
import { jagaPeranStaf, metaSesi } from "@/lib/server/jaga-peran";

export const dynamic = "force-dynamic";

// Nama endpoint untuk pesan penolakan peran dan pesan log.
const NAMA_ENDPOINT = "catat laporan hari ini dicetak";

// Peran yang boleh memakai endpoint ini. Cashier dan Admin saja.
const PERAN_LAPORAN = ["cashier", "admin"] as const;

/**
 * Handler POST untuk mencatat laporan hari ini yang dicetak.
 *
 * Input: tidak ada yang wajib. Body boleh berisi { tanggal } supaya catatan log
 *        tahu tanggal laporan yang dicetak. Kalau tanggal tidak dikirim, meta
 *        tidak memuat tanggal, dan itu tidak membuat permintaan gagal: jejak log
 *        yang seadanya lebih baik daripada Cashier gagal mencetak.
 * Output: { ok: true, data: { logged: true | false } } atau
 *         { ok: false, error } kalau perannya tidak cocok atau tangannya bukan
 *         teks yang wajar.
 */
export async function POST(request: NextRequest) {
  // 1. Penjagaan peran.
  const jaga = await jagaPeranStaf([...PERAN_LAPORAN], NAMA_ENDPOINT);
  if (!jaga.diizinkan) {
    return balasLaporanGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Baca tanggal dari body kalau ada. Body tidak dibaca atau tidak bisa dibaca
  //    TIDAK membuat permintaan gagal, karena tanggal hanya pelengkap log.
  const tanggal = await bacaTanggalOpsional(request);

  // 3. Catat aktivitas report.printed.
  //
  //    entity_id sengaja kosong karena laporan hari ini belum tersimpan (lihat
  //    catatan di atas file). Actor diambil dari sesi login, bukan dari kiriman
  //    klien. Meta memuat session_id supaya Admin tahu laporan ini diambil dari
  //    perangkat mana, karena satu akun bisa dipakai di beberapa laptop
  //    (docs/pemissions.md bagian 1).
  //
  //    logActivity sengaja dibungkus try/catch: kalau ia melempar error, aksi ini
  //    tidak boleh menggagalkan pencetakan. Dilaporkan lewat logged: false.
  let berhasilDicatat = true;
  try {
    logActivity({
      action: "report.printed",
      actorRole: jaga.sesi.role,
      actorId: jaga.sesi.userId,
      entityType: "report",
      // entity_id dikosongkan (null), bukan string kosong: kolomnya bertipe uuid,
      // jadi string kosong akan ditolak saat di-cast jadi uuid
      // (lihat fungsi write_activity_log di migrasi order_functions_1).
      entityId: null,
      meta: {
        ...metaSesi(jaga.sesi),
        // live: true menandai laporan ini belum tersimpan, supaya Admin bisa
        // membedakannya dari laporan Riwayat yang dicetak lewat
        // /api/reports/[id]/printed.
        live: true,
        // tanggal ditulis hanya kalau ada, supaya meta tidak pernah memuat nilai
        // kosong yang tidak menjelaskan apa pun.
        ...(tanggal === null ? {} : { date: tanggal }),
      },
    });
  } catch (error) {
    berhasilDicatat = false;

    // Dicatat supaya Admin tahu ada laporan yang dicetak tapi jejaknya hilang.
    logError({
      message:
        "Gagal menulis log report.printed untuk laporan hari ini: " +
        String(error),
      severity: "error",
      source: "server",
      context: {
        konteks: NAMA_ENDPOINT,
      },
      userId: jaga.sesi.userId,
    });
  }

  // 4. Sukses. Ini bukan error: cetakannya sudah jadi, yang hilang cuma jejaknya
  //    di log.
  return balasLaporanOk({ logged: berhasilDicatat });
}

/**
 * Membaca tanggal laporan hari ini dari body permintaan.
 *
 * Input: permintaan HTTP.
 * Output: teks tanggal ("YYYY-MM-DD"), atau null kalau tidak dikirim atau tidak
 *         terbaca.
 *
 * Tanggal TIDAK divalidasi ketat di sini. Ini hanya pelengkap log, dan
 * memvalidasinya dengan ketat hanya menambah jalur penolakan tanpa keuntungan
 * apa pun. Batas panjang tetap ada supaya body yang sangat besar tidak bisa
 * dipakai membanjiri log.
 */
async function bacaTanggalOpsional(
  request: NextRequest,
): Promise<string | null> {
  try {
    const body: unknown = await request.json();

    if (body === null || typeof body !== "object") {
      return null;
    }

    const tanggal = (body as Record<string, unknown>).tanggal;

    if (typeof tanggal !== "string") {
      return null;
    }

    const bersih = tanggal.trim().slice(0, 10);

    return bersih === "" ? null : bersih;
  } catch {
    // Body kosong atau bukan JSON: tanggal dianggap tidak ada.
    return null;
  }
}
