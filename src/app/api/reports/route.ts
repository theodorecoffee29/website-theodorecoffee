// File ini: route handler GET /api/reports.
//
// Tugasnya: mengembalikan DAFTAR Riwayat (satu baris ringkasan per hari yang
// sudah tersimpan), sesuai docs/api-contract.md bagian 4c.
//
// Kenapa daftar ini memanggil save_missing_reports lebih dulu:
//   Laporan harian disimpan otomatis oleh pg_cron setiap pukul 00.05 WIB. Kalau
//   pg_cron gagal (mis. proyek sedang tidur, atau jadwalnya tidak jalan), ada
//   hari yang belum tersimpan dan TIDAK akan muncul di Riwayat. Cashier yang
//   membuka Riwayat lalu akan melihat daftar yang kurang, padahal datanya ada.
//
//   Jadi sebelum membaca daftar, server memanggil save_missing_reports sebagai
//   cadangan: fungsi itu menyimpan semua hari lalu yang belum tersimpan, dan
//   karena idempoten, hari yang sudah tersimpan tidak berubah sama sekali
//   (Riwayat tidak boleh berubah setelah tersimpan).
//
// ATURAN PENTING: kalau save_missing_reports GAGAL, seluruh permintaan TIDAK
// boleh gagal. Daftar Riwayat yang bisa dibaca tetap berguna, dan Cashier tidak
// boleh melihat halaman error hanya karena satu langkah tambahan gagal. Jadi
// kegagalannya dicatat lewat logError, dan daftarnya tetap dikirim dengan
// tambahan catchUpFailed: true supaya layar bisa memberi tahu Cashier bahwa
// daftar ini mungkin belum lengkap.
//
// PERAN: hanya Cashier dan Admin (docs/pemissions.md bagian 2). Barista
// DITOLAK dengan FORBIDDEN dan access.denied dicatat.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasLaporanDariErrorDatabase,
  balasLaporanGagal,
  balasLaporanOk,
} from "@/lib/server/balas-laporan";
import { ambilDetailError } from "@/lib/errors";
import { logError } from "@/lib/log";
import { jagaPeranStaf } from "@/lib/server/jaga-peran";
import { petakanDaftarLaporan } from "@/lib/server/petikan-laporan";
import { ubahKeAngka } from "@/lib/server/ubah-ke-angka";

export const dynamic = "force-dynamic";

// Nama endpoint untuk pesan penolakan peran dan pesan log.
const NAMA_ENDPOINT = "daftar laporan (Riwayat)";

// Peran yang boleh memakai endpoint ini. Cashier dan Admin saja.
const PERAN_LAPORAN = ["cashier", "admin"] as const;

/**
 * Handler GET untuk daftar Riwayat.
 *
 * Output:
 *   { ok: true, data: { reports: [...], catchUpSaved: 0 } }
 *   atau dengan tambahan catchUpFailed: true kalau catch-up gagal.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  // 1. Penjagaan peran.
  const jaga = await jagaPeranStaf([...PERAN_LAPORAN], NAMA_ENDPOINT);
  if (!jaga.diizinkan) {
    return balasLaporanGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  const klien = getAdminClient();

  // 2. Cadangan: simpan laporan hari-hari yang belum tersimpan.
  //
  //    Kegagalan DI SINI TIDAK menggagalkan permintaan. Yang dilakukan:
  //    catat lewat logError, lalu lanjutkan membaca daftar.
  let jumlahTersimpanBaru = 0;
  let catchUpGagal = false;

  const hasilCatchUp = await klien.rpc("save_missing_reports", {
    p_actor_id: jaga.sesi.userId,
  });

  if (hasilCatchUp.error) {
    catchUpGagal = true;

    // Dicatat sebagai kegagalan sistem (severity error) supaya Admin bisa
    // mencarinya di error_logs: kalau pg_cron juga gagal, ini tanda ada masalah
    // yang lebih besar dari sekadar satu hari yang belum tersimpan.
    const detail = ambilDetailError(hasilCatchUp.error);
    logError({
      message:
        "Gagal menyimpan laporan yang lewat (save_missing_reports) di " +
        NAMA_ENDPOINT +
        ": " +
        detail.message,
      severity: "error",
      source: "database",
      context: {
        konteks: NAMA_ENDPOINT,
        fungsi: "save_missing_reports",
        message: detail.message,
        code: detail.code,
        details: detail.details,
        hint: detail.hint,
      },
      userId: jaga.sesi.userId,
    });
  } else {
    // savedCount bisa datang sebagai teks (jsonb dari PostgREST), jadi diubah
    // ke angka lewat fungsi pembantu yang sudah ada.
    jumlahTersimpanBaru = ubahKeAngka(
      hasilCatchUp.data && typeof hasilCatchUp.data === "object"
        ? (hasilCatchUp.data as Record<string, unknown>).savedCount
        : 0,
      0,
    );
  }

  // 3. Baca daftar Riwayat. Kegagalan di sini TIDAK ditoleransi: tanpa daftar
  //    ini tidak ada yang bisa ditampilkan, jadi ini kegagalan sungguhan.
  const { data, error } = await klien.rpc("list_reports", {
    p_actor_id: jaga.sesi.userId,
  });

  if (error) {
    return balasLaporanDariErrorDatabase(error, NAMA_ENDPOINT);
  }

  // 4. Sukses. Ringkasan per hari diteruskan, angkanya diubah ke angka.
  return balasLaporanOk(
    petakanDaftarLaporan(data, jumlahTersimpanBaru, catchUpGagal),
  );
}
