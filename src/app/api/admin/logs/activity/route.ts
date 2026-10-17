// File ini: route handler GET /api/admin/logs/activity.
//
// Tugasnya: mengembalikan satu HALAMAN log aktivitas (50 baris), terbaru dulu, dengan
// filter dari query string dan penanda lanjutan (cursor).
//
// PERAN: HANYA Admin. Cashier, Barista, dan customer mendapat FORBIDDEN dan
// percobaannya dicatat sebagai access.denied oleh jagaPeranAdmin. Belum login mendapat
// UNAUTHENTICATED (docs/pemissions.md bagian 2: hanya Admin yang boleh membaca log).
//
// HANYA ADA GET DI FILE INI. Tidak ada POST, PUT, PATCH, atau DELETE, karena log hanya
// bisa ditambah oleh sistem dan tidak pernah diubah atau dihapus (docs/data-model.md
// aturan 1, docs/logging.md bagian 1). Membuka halaman log sendiri juga TIDAK dicatat,
// karena itu cuma pembacaan (docs/logging.md bagian 2). Ada tes yang memeriksa file ini
// tidak mengekspor handler lain.
//
// CARA MEMBACA DATA:
//   Tabel dibaca lewat klien admin (kunci service role), bukan lewat RLS. Alasannya,
//   endpoint ini untuk Admin, dan RLS activity_logs memang hanya mengizinkan Admin
//   membaca. Dua lapis penjagaan tetap berlaku: route handler bisa dipanggil langsung
//   dari luar browser, jadi peran diperiksa lebih dulu di sini sebelum database
//   disentuh.
//
// CATATAN SOAL UKURAN HALAMAN: server mengambil 51 baris, lalu 50 dikirim ke browser
// dan 1 dipakai sebagai penanda lanjutan. Kalau benar-benar tidak ada baris lagi,
// 50 baris itu tepat habis dan penandanya kosong, sehingga tombol "Muat lebih banyak"
// tidak muncul.

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
  gabungNamaAktor,
  petakanBarisAktivitas,
  type BarisAktivitasTampil,
} from "@/lib/server/petakan-log";
import { ubahKeTeks } from "@/lib/server/ubah-ke-angka";
import {
  filterAktivitasSchema,
  rentangTanggalNalik,
  rentangWaktuWib,
  tanggalNyataDiKalender,
} from "@/lib/server/validasi-log";

export const dynamic = "force-dynamic";

// Nama endpoint untuk pesan penolakan peran dan pesan log.
const NAMA_ENDPOINT = "daftar log aktivitas";

// Jumlah baris yang dikirim ke browser dalam satu permintaan.
const JUMLAH_BARIS = 50;

// Bentuk data untuk GET /api/admin/logs/activity (camelCase, sesuai kontrak).
export type HasilLogAktivitas = {
  items: BarisAktivitasTampil[];
  // Penanda untuk mengambil halaman berikutnya, atau null kalau ini sudah baris
  // terakhir.
  nextCursor: string | null;
};

/**
 * Handler GET: satu halaman log aktivitas.
 *
 * Input: query string yang boleh berisi from, to, action, actorRole, entityType,
 *        orderId, dan cursor.
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
  const hasilValidasi = filterAktivitasSchema.safeParse(
    ambilFilterDariQuery(request),
  );
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const filter = hasilValidasi.data;

  // Tanggal yang formatnya benar tapi tanggalnya tidak ada di kalender (mis.
  // 2026-02-31) ditolak di sini, supaya tidak diam-diam mengembalikan daftar kosong.
  const pesanTanggal = periksaTanggal(filter.from, filter.to);
  if (pesanTanggal !== null) {
    return balasValidasiGagal([{ path: ["from"], message: pesanTanggal }]);
  }

  // 3. Baca cursor. Cursor yang rusak diperlakukan sebagai "tidak ada cursor" (lihat
  //    bacaCursor), jadi halaman log tetap bisa dibuka.
  const cursor = bacaCursor(filter.cursor);

  // 4. Tentukan arah urutan.
  //
  //    Bawaan "terbaru" (baru ke lama), karena Admin biasanya mencari kejadian paling
  //    akhir.
  //
  //    Kalau Admin mengisi id order, arahnya dibalik jadi "terlama" (lama ke baru).
  //    Alasannya: yang dicari adalah JEJAK satu pesanan, yaitu urutan kejadiannya dari
  //    awal. Kalau tetap terbaru dulu, Admin harus membaca dari bawah ke atas dan
  //    urutannya terbalik, sehingga "order dibuat" justru muncul paling akhir.
  const arah: ArahUrut = filter.orderId === undefined ? "terbaru" : "terlama";

  const klien = getAdminClient();

  // 5. Susun query.
  let query = klien
    .from("activity_logs")
    // Hanya kolom yang ada di kontrak respons. Kolom lain tidak boleh ikut, supaya
    // halaman log tidak pernah mengirim sesuatu yang tidak diminta.
    .select(
      "id, at, actor_id, actor_role, action, entity_type, entity_id, order_id, before, after, meta",
    )
    .order("at", { ascending: arah === "terlama" })
    // id diurutkan dengan arah yang sama supaya cursor (waktu, id) selalu menentukan
    // posisi baris dengan tepat.
    .order("id", { ascending: arah === "terlama" });

  // 5a. Filter tanggal, dibatasi ke awal dan akhir hari menurut WIB.
  const rentang = rentangWaktuWib(filter.from, filter.to);
  if (rentang.gte !== undefined) {
    query = query.gte("at", rentang.gte);
  }
  if (rentang.lte !== undefined) {
    query = query.lte("at", rentang.lte);
  }

  // 5b. Filter nama aksi, jenis objek, dan peran pelaku. Ini syarat satu kolom
  //     saja, jadi cukup .eq() dan tidak perlu ikut gabung ke .or() di bawah.
  if (filter.action !== undefined) {
    query = query.eq("action", filter.action);
  }
  if (filter.entityType !== undefined) {
    query = query.eq("entity_type", filter.entityType);
  }
  if (filter.actorRole !== undefined) {
    query = query.eq("actor_role", filter.actorRole);
  }

  // 5c. Filter id order dan penanda lanjutan digabung menjadi SATU .or().
  //
  //     Alasan searches order: activity_logs punya DUA kolom yang bisa menunjuk ke
  //     satu pesanan, jadi keduanya dipakai sekaligus:
  //       1. order_id  -> kolom khusus yang memang disediakan untuk menelusuri jejak
  //          satu pesanan (lihat komentar kolomnya di migrasi tabel).
  //       2. entity_id -> baris yang OBJEKNYA itu order itu sendiri, misalnya action
  //          "order.created" dengan entity_type "order". Ada baris seperti ini yang
  //          order_id-nya kosong, jadi kalau hanya order_id yang dicari, jejaknya jadi
  //          tidak lengkap.
  //
  //     META DAN AFTER SENGAJA TIDAK DICARI, dan ini keputusan sadar:
  //       - isinya jsonb bebas dengan nama kunci yang tidak seragam (session_id,
  //         queue_number, live, date), jadi tidak ada satu kunci pun yang bisa dicari
  //         dengan pasti. Kalau kunci yang tidak ada ikut dicari, hasilnya baris yang
  //         salah.
  //       - mencari di dalam jsonb tidak bisa memakai index, jadi biayanya jauh lebih
  //         mahal untuk hasil yang tidak pasti benar.
  //     Kalau ada aksi yang hanya menyimpan id order di dalam meta, aksi itu perlu
  //     mengisi kolom order_id di fungsinya (perubahan di sisi database), bukan dicari
  //     lewat jsonb dari halaman log.
  const kelompokOrder: string[][] = [];

  if (filter.orderId !== undefined) {
    kelompokOrder.push(
      ["order_id.eq." + filter.orderId],
      ["entity_id.eq." + filter.orderId],
    );
  }

  const syaratOr = filterAtau(kelompokOrder, cursor, arah);
  if (syaratOr !== null) {
    query = query.or(syaratOr);
  }

  // 6. Ambil satu baris lebih banyak untuk mengetahui apakah masih ada halaman
  //    berikutnya (lihat catatan di kepala file).
  const { data, error } = await query.limit(JUMLAH_BARIS + 1);

  if (error) {
    return balasLogDariErrorDatabase(error, NAMA_ENDPOINT);
  }

  // Bentuk baris diambil dari tipe database, supaya kolom yang dipilih di select
  // dan kolom yang dipetakan tidak bisa berbeda diam-diam.
  const baris = (
    Array.isArray(data) ? data : []
  ) as Database["public"]["Tables"]["activity_logs"]["Row"][];

  // 7. Pisahkan baris yang dikirim dari baris penanda.
  const terkirim = baris.slice(0, JUMLAH_BARIS);
  const masihAda = baris.length > JUMLAH_BARIS;

  // 8. Ambil nama pelaku dengan SATU query untuk seluruh id di halaman ini.
  const petaNama = await ambilNamaAktor(
    terkirim.map((satu) => ubahKeTeks(satu.actor_id)),
  );

  const items = terkirim.map((satu) => petakanBarisAktivitas(satu, petaNama));

  // 9. Penanda lanjutan diambil dari baris terakhir yang DIKIRIM (bukan baris ke-51),
  //    supaya baris ke-51 itu menjadi baris pertama halaman berikutnya dan tidak ada
  //    baris yang terlewat atau tampil dua kali.
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
 * Kalau parameter yang tidak dikenal dibuang di sini, salah ketik akan hilang tanpa
 * jejak dan Admin mengira dia sedang memfilter padahal tidak.
 *
 * Parameter yang ada tapi kosong TIDAK diteruskan: "?action=" berarti Admin tidak memilih
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

/**
 * Mengambil nama pelaku untuk semua id dalam satu halaman, dengan SATU query.
 *
 * Input: daftar actor_id dari baris-baris halaman ini (boleh kosong, boleh ada
 *        duplikat).
 * Output: peta actor_id -> nama.
 *
 * Kenapa harus satu query: halaman ini 50 baris. Kalau nama diambil satu per baris,
 * satu halaman berarti 50 permintaan ke database dan halaman log akan terasa sangat
 * lambat. Satu query dengan .in() cukup untuk semua id di halaman itu.
 *
 * Kalau daftar id-nya kosong (mis. semua baris untuk customer atau sistem), database
 * TIDAK disentuh sama sekali: query dengan .in([]) tidak berguna dan hanya buang
 * satu koneksi.
 */
async function ambilNamaAktor(
  daftarId: string[],
): Promise<Map<string, string>> {
  const idUnik: string[] = [];
  const sudahDikumpulkan = new Set<string>();

  for (const satuId of daftarId) {
    if (satuId !== "" && !sudahDikumpulkan.has(satuId)) {
      sudahDikumpulkan.add(satuId);
      idUnik.push(satuId);
    }
  }

  if (idUnik.length === 0) {
    return new Map();
  }

  const { data, error } = await getAdminClient()
    .from("profiles")
    .select("id, name")
    .in("id", idUnik);

  // Kegagalan query nama TIDAK membuat seluruh permintaan gagal. Baris lognya masih
  // berguna; hanya kolom nama yang kosong. Nama pelaku adalah informasi tambahan,
  // bukan isi log itu sendiri, jadi kegagalan di sini dicatat ke console.error
  // (untuk dicari kalau terjadi) tanpa menggagalkan halaman.
  if (error) {
    console.error(
      "[src/app/api/admin/logs/activity] gagal membaca nama pelaku dari profiles: " +
        error.message,
    );
    return new Map();
  }

  return gabungNamaAktor(daftarId, Array.isArray(data) ? data : []);
}
