// File ini: route handler GET /api/admin/logs/errors.
//
// Tugasnya: mengembalikan satu HALAMAN log error (50 baris), terbaru dulu, dengan
// filter dari query string dan penanda lanjutan (cursor).
//
// PERAN: HANYA Admin. Cashier, Barista, dan customer mendapat FORBIDDEN dan
// percobaannya dicatat sebagai access.denied oleh jagaPeranAdmin. Belum login mendapat
// UNAUTHENTICATED (docs/pemissions.md bagian 2). Endpoint activity_logs DAN error_logs
// dijaga dengan penjaga yang sama supaya aturannya tidak berbeda antara keduanya.
//
// HANYA ADA GET DI FILE INI. Tidak ada POST, PUT, PATCH, atau DELETE. Baris log error
// hanya bisa ditambah oleh sistem (helper logError), tidak pernah diubah atau dihapus
// (docs/data-model.md aturan 1). Ada tes yang memeriksa file ini tidak mengekspor
// handler lain.
//
// CARA MEMBACA DATA: lewat klien admin (kunci service role), sama seperti endpoint log
// aktivitas. RLS error_logs juga hanya mengizinkan Admin membaca.
//
// CATATAN SOAL PENCARIAN KODE: kode error disimpan apa adanya seperti yang dibuat helper
// log, yaitu "ERR-" diikuti 4 huruf besar atau angka. Filter ini hanya menerima kode yang
// BENTUKNYA persis seperti itu, dan huruf kecil dinormalkan jadi huruf besar sebelum
// dikirim ke database. Jadi Admin bisa menyalin kode dari customer tanpa perlu Caps Lock.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { balasValidasiGagal } from "@/lib/server/balas";
import {
  balasLogDariErrorDatabase,
  balasLogGagal,
  balasLogOk,
} from "@/lib/server/balas-log";
import {
  bacaCursor,
  buatCursor,
  filterAtau,
  type ArahUrut,
} from "@/lib/server/cursor-log";
import { jagaPeranAdmin } from "@/lib/server/jaga-admin";
import {
  petakanBarisError,
  type BarisErrorTampil,
} from "@/lib/server/petakan-log";
import {
  filterErrorSchema,
  rentangTanggalNalik,
  rentangWaktuWib,
  tanggalNyataDiKalender,
} from "@/lib/server/validasi-log";

export const dynamic = "force-dynamic";

// Nama endpoint untuk pesan penolakan peran dan pesan log.
const NAMA_ENDPOINT = "daftar log error";

// Jumlah baris yang dikirim ke browser dalam satu permintaan.
const JUMLAH_BARIS = 50;

// Bentuk data untuk GET /api/admin/logs/errors (camelCase, sesuai kontrak).
export type HasilLogError = {
  items: BarisErrorTampil[];
  // Penanda untuk mengambil halaman berikutnya, atau null kalau ini sudah baris
  // terakhir.
  nextCursor: string | null;
};

/**
 * Handler GET: satu halaman log error.
 *
 * Input: query string yang boleh berisi from, to, severity, source, code, orderId,
 *        dan cursor.
 * Output: { ok: true, data: { items, nextCursor } } atau { ok: false, error }.
 */
export async function GET(request: NextRequest) {
  // 1. Penjagaan peran. Hanya Admin.
  const jaga = await jagaPeranAdmin(NAMA_ENDPOINT);
  if (!jaga.diizinkan) {
    return balasLogGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Validasi filter DULU, sebelum database disentuh. Filter yang tidak valid
  //    dibalas VALIDATION_FAILED dan TIDAK dicatat ke error_logs, karena itu
  //    kesalahan pemakai, bukan kegagalan sistem (docs/api-contract.md bagian 6).
  const hasilValidasi = filterErrorSchema.safeParse(
    ambilFilterDariQuery(request),
  );
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const filter = hasilValidasi.data;

  // Tanggal yang formatnya benar tapi tanggalnya tidak ada di kalender ditolak di
  // sini, supaya tidak diam-diam mengembalikan daftar kosong.
  const pesanTanggal = periksaTanggal(filter.from, filter.to);
  if (pesanTanggal !== null) {
    return balasValidasiGagal([{ path: ["from"], message: pesanTanggal }]);
  }

  // 3. Baca cursor. Cursor yang rusak dianggap "tidak ada cursor" (lihat bacaCursor).
  const cursor = bacaCursor(filter.cursor);

  // 4. Arah urutan. Sama seperti endpoint aktivitas: "terbaru" jadi bawaan, dan
  //    dibalik jadi "terlama" kalau Admin menelusuri satu order, supaya jejaknya
  //    terbaca dari awal.
  const arah: ArahUrut = filter.orderId === undefined ? "terbaru" : "terlama";

  const klien = getAdminClient();

  // 5. Susun query.
  let query = klien
    .from("error_logs")
    // Hanya kolom yang ada di kontrak respons. sentry_event_id sengaja tidak diambil:
    // Sentry baru dipasang di Fase 9, dan halaman ini tidak butuh isinya.
    .select(
      "id, at, code, severity, source, message, context, user_id, order_id",
    )
    .order("at", { ascending: arah === "terlama" })
    .order("id", { ascending: arah === "terlama" });

  // 5a. Filter tanggal, dibatasi ke awal dan akhir hari menurut WIB.
  const rentang = rentangWaktuWib(filter.from, filter.to);
  if (rentang.gte !== undefined) {
    query = query.gte("at", rentang.gte);
  }
  if (rentang.lte !== undefined) {
    query = query.lte("at", rentang.lte);
  }

  // 5b. Filter tingkat keparahan, sumber, dan kode error. Semua ini syarat satu kolom
  //     saja, jadi cukup .eq().
  if (filter.severity !== undefined) {
    query = query.eq("severity", filter.severity);
  }
  if (filter.source !== undefined) {
    query = query.eq("source", filter.source);
  }
  if (filter.code !== undefined) {
    // toUpperCase: filter ini sudah lolos pemeriksaan bentuk, jadi yang perlu
    // dinormalkan hanya huruf besar-kecilnya.
    query = query.eq("code", filter.code.toUpperCase());
  }

  // 5c. Filter id order dan penanda lanjutan digabung menjadi SATU .or().
  //
  //     Berbeda dengan activity_logs, error_logs hanya punya SATU kolom penunjuk order
  //     yaitu order_id. Tidak ada entity_id di sini, jadi tidak ada dua kolom yang perlu
  //     digabung.
  const kelompokOrder: string[][] = [];

  if (filter.orderId !== undefined) {
    kelompokOrder.push(["order_id.eq." + filter.orderId]);
  }

  const syaratOr = filterAtau(kelompokOrder, cursor, arah);
  if (syaratOr !== null) {
    query = query.or(syaratOr);
  }

  // 6. Ambil satu baris lebih banyak untuk mengetahui apakah masih ada halaman
  //    berikutnya.
  const { data, error } = await query.limit(JUMLAH_BARIS + 1);

  if (error) {
    return balasLogDariErrorDatabase(error, NAMA_ENDPOINT);
  }

  const baris = (
    Array.isArray(data) ? data : []
  ) as Database["public"]["Tables"]["error_logs"]["Row"][];

  // 7. Pisahkan baris yang dikirim dari baris penanda.
  const terkirim = baris.slice(0, JUMLAH_BARIS);
  const masihAda = baris.length > JUMLAH_BARIS;

  // 8. Petakan ke bentuk camelCase. before/after/meta tidak ada di tabel ini;
  //    yang cleaned adalah kolom context.
  const items = terkirim.map((satu) => petakanBarisError(satu));

  // 9. Penanda lanjutan diambil dari baris terakhir yang DIKIRIM, supaya baris ke-51
  //    menjadi baris pertama halaman berikutnya dan tidak ada baris yang terlewat.
  const barisTerakhir = terkirim[terkirim.length - 1];
  const nextCursor =
    masihAda && barisTerakhir !== undefined
      ? buatCursor(barisTerakhir.at, barisTerakhir.id)
      : null;

  return balasLogOk({ items: items, nextCursor: nextCursor });
}

/**
 * Membaca parameter filter dari query string.
 *
 * Input: permintaan HTTP.
 * Output: objek berisi setiap parameter yang ada di query string.
 *
 * SEMUA parameter diteruskan, bukan cuma nama yang dikenal. Tujuannya supaya skema
 * validasi (yang memakai .strict()) bisa menolak nama parameter yang tidak dikenal.
 * Kalau parameter yang tidak dikenal dibuang di sini, salah ketik akan hilang tanpa jejak
 * dan Admin mengira dia sedang memfilter padahal tidak.
 *
 * Parameter yang ada tapi kosong TIDAK diteruskan: "?code=" berarti Admin tidak mengisi
 * apa pun, dan kalau diteruskan sebagai string kosong, server akan menolaknya dengan
 * pesan "tidak sesuai" padahal tidak ada kesalahan.
 */
function ambilFilterDariQuery(request: NextRequest): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  for (const [nama, nilai] of request.nextUrl.searchParams.entries()) {
    if (nilai.trim() !== "") {
      filter[nama] = nilai;
    }
  }

  return filter;
}

/**
 * Memeriksa tanggal filter: formatnya sudah dicek zod, di sini diperiksa apakah
 * tanggalnya benar-benar ada dan tidak terbalik.
 *
 * Input: tanggal awal dan tanggal akhir (boleh undefined).
 * Output: pesan kesalahan, atau null kalau tidak ada masalah.
 */
function periksaTanggal(
  from: string | undefined,
  to: string | undefined,
): string | null {
  for (const tanggal of [from, to]) {
    if (tanggal !== undefined && !tanggalNyataDiKalender(tanggal)) {
      return "Tanggal " + tanggal + " tidak ada di kalender.";
    }
  }

  if (!rentangTanggalNalik(from, to)) {
    return "Tanggal awal jangan lebih besar dari tanggal akhir.";
  }

  return null;
}
