// File ini: memvalidasi dan membersihkan filter halaman log yang datang dari query
// string, lalu mengubahnya menjadi rentang waktu timestamptz.
//
// Filter dibaca dari alamat, jadi isinya TIDAK bisa dipercaya: Admin bisa mengubah
// alamat dengan tangan, dan program lain juga bisa memanggil endpoint ini. Karena itu
// setiap filter divalidasi dengan zod SEBELUM database disentuh. Filter yang tidak
// valid dibalas VALIDATION_FAILED dan TIDAK dicatat ke error_logs, karena itu
// kesalahan pemakai, bukan kegagalan sistem (docs/api-contract.md bagian 6).
//
// CATATAN SOAL ZONA WAKTU:
//   Filter tanggal yang diketik Admin adalah tanggal biasa ("2026-10-11"), sedangkan
//   kolom at di database adalah timestamptz. Jadi "dari tanggal X" harus berarti
//   "dari pukul 00.00.00 tanggal X di zona WIB", dan "sampai tanggal Y" berarti
//   "sampai 23.59.59 tanggal Y di WIB". Kalau tidak, satu hari bisa hilang atau
//   appear dua kali (mis. filter 11 Oktober tanpa jam, lalu diisi 11 Oktober 00.05).
//
// KENAPA TIDAK MEMAKAI WATU-HITUNG-SENDIRI DARI JAM SERVER:
//   Server produksi berjalan di zona UTC. Kalau batas harian dihitung dari jam
//   server lalu dikirim sebagai timestamptz, hasilnya akan bergeser 7 jam dan filter
//   "hari ini" bisa salah. Karena itu batasnya dibangun langsung dengan offset
//   WIB (+07:00), tanpa bergantung pada jam server sama sekali.
//
// File ini mengimpor ACTIVITY_ACTIONS dari @/lib/log supaya nama aksi yang
// diterima server persis sama dengan daftar resmi di docs/logging.md bagian 2.
// Modul itu ditandai server-only, jadi file ini HANYA boleh dipakai di sisi server.

import { z } from "zod";
import { ACTIVITY_ACTIONS } from "@/lib/log";
import {
  JENIS_OBJEK_LOG,
  PERAN_LOG,
  SUMBER_ERROR,
  TINGKAT_ERROR,
} from "@/lib/enum-log";
import { MAKSIMAL_CURSOR } from "./cursor-log";

// Zona waktu Indonesia Barat. Dipakai sebagai teks offset (+07:00) di bawah.
export const OFFSET_WIB = "+07:00";

// Pola kode error: "ERR-" diikuti tepat 4 huruf besar atau angka
// (docs/logging.md bagian 5). Huruf kecil juga diterima lalu dinormalkan supaya
// Admin tidak perlu Caps Lock saat menyalin kode dari customer.
const POLA_KODE_ERROR = /^ERR-[A-Z0-9]{4}$/i;

// Pola tanggal yang diketik Admin pada kolom tanggal: YYYY-MM-DD.
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

// Skema untuk satu tanggal filter.
//
// zod sudah memangkas string secara bawaan? Tidak. Jadi spasi pinggir dipangkas
// sendiri dengan .trim() supaya " 2026-10-11 " tetap diterima.
const tanggalSchema = z
  .string("Tanggal harus diisi.")
  .trim()
  .regex(POLA_TANGGAL, "Tanggal harus format YYYY-MM-DD, misalnya 2026-10-11.");

/**
 * Skema filter untuk GET /api/admin/logs/activity.
 *
 * Semua field opsional: tanpa filter apa pun, endpoint mengembalikan 50 baris
 * terbaru.
 *
 * .strict() dipakai supaya nama filter yang tidak dikenal DITOLAK, bukan diabaikan
 * diam-diam. Kalau diabaikan, Admin yang salah ketik nama filter akan mengira dia sedang
 * memfilter padahal tidak, dan dia bisa salah simpul dari daftar yang tampil.
 */
export const filterAktivitasSchema = z
  .object({
    // Tanggal awal (WIB).
    from: tanggalSchema.optional(),
    // Tanggal akhir (WIB), termasuk seluruh hari itu.
    to: tanggalSchema.optional(),
    // Nama aksi. Hanya yang ada di ACTIVITY_ACTIONS, supaya tidak ada aksi fiktif
    // yang tidak akan pernah mengembalikan hasil.
    action: z.enum(ACTIVITY_ACTIONS).optional(),
    // Peran pelaku, termasuk customer dan system yang tidak punya akun.
    actorRole: z.enum(PERAN_LOG).optional(),
    // Jenis objek yang berubah.
    entityType: z.enum(JENIS_OBJEK_LOG).optional(),
    // Id order untuk menelusuri jejak satu pesanan.
    orderId: z
      .string()
      .trim()
      .uuid("orderId harus berupa uuid yang valid.")
      .optional(),
    // Penanda lanjutan halaman sebelumnya.
    cursor: z
      .string()
      .trim()
      .max(MAKSIMAL_CURSOR, "cursor terlalu panjang.")
      .optional(),
  })
  .strict();

/**
 * Skema filter untuk GET /api/admin/logs/errors.
 *
 * Field yang sama seperti aktivitas, ditambah pencarian kode error. .strict() juga
 * dipakai di sini, dengan alasan yang sama: nama filter yang salah ketik harus
 * complains, bukan diabaikan.
 */
export const filterErrorSchema = z
  .object({
    // Tanggal awal (WIB).
    from: tanggalSchema.optional(),
    // Tanggal akhir (WIB), termasuk seluruh hari itu.
    to: tanggalSchema.optional(),
    // Tingkat keparahan.
    severity: z.enum(TINGKAT_ERROR).optional(),
    // Tempat error terjadi.
    source: z.enum(SUMBER_ERROR).optional(),
    // Kode error yang dicari. Huruf kecil diterima lalu dinormalkan ke huruf besar.
    code: z
      .string("Kode harus diisi.")
      .trim()
      .regex(POLA_KODE_ERROR, "Kode harus format ERR-XXXX, misalnya ERR-4F2A.")
      .optional(),
    // Id order untuk menelusuri jejak satu pesanan.
    orderId: z
      .string()
      .trim()
      .uuid("orderId harus berupa uuid yang valid.")
      .optional(),
    // Penanda lanjutan halaman sebelumnya.
    cursor: z
      .string()
      .trim()
      .max(MAKSIMAL_CURSOR, "cursor terlalu panjang.")
      .optional(),
  })
  .strict();

/**
 * Filter aktivitas yang sudah dibersihkan, dengan batas waktu siap pakai.
 */
export type FilterAktivitas = z.infer<typeof filterAktivitasSchema>;

/**
 * Filter error yang sudah dibersihkan, dengan batas waktu siap pakai.
 */
export type FilterError = z.infer<typeof filterErrorSchema>;

// Bentuk hasil setelah tanggal diubah menjadi batas timestamptz.
export type RentangWaktu = {
  // Batas bawah untuk filter "at lebih besar dari ini", atau undefined kalau
  // tanggal awal tidak diisi.
  gte?: string;
  // Batas atas untuk filter "at lebih kecil dari ini", atau undefined kalau
  // tanggal akhir tidak diisi.
  lte?: string;
};

/**
 * Mengubah tanggal filter menjadi batas atas dan bawah satu hari dalam WIB.
 *
 * Input:
 *   - from: tanggal awal (atau undefined).
 *   - to: tanggal akhir (atau undefined).
 * Output: objek { gte, lte } berisi timestamptz siap pakai, atau objek kosong
 *         kalau keduanya tidak diisi.
 *
 * Cara kerja:
 *   - from "2026-10-11" -> gte "2026-10-11T00:00:00.000+07:00"
 *   - to   "2026-10-11" -> lte "2026-10-11T23:59:59.999+07:00"
 *
 * Batas atas memakai 23.59.59.999 supaya order terakhir hari itu (yang bisa saja
 * tercatat pada 23.59.59.5) tidak terlewat.
 *
 * Pengecekan tanggal yang benar-benar ada di kalender dilakukan terpisah, supaya
 * "2026-02-31" ditolak dengan pesan jelas, bukan diam-diam menghasilkan rentang
 * kosong.
 */
export function rentangWaktuWib(
  from: string | undefined,
  to: string | undefined,
): RentangWaktu {
  const rentang: RentangWaktu = {};

  if (from !== undefined) {
    rentang.gte = from + "T00:00:00.000" + OFFSET_WIB;
  }

  if (to !== undefined) {
    rentang.lte = to + "T23:59:59.999" + OFFSET_WIB;
  }

  return rentang;
}

/**
 * Memeriksa apakah sebuah tanggal benar-benar ada di kalender.
 *
 * Input: teks tanggal "YYYY-MM-DD" yang sudah lolos pola di atas.
 * Output: true kalau tanggalnya nyata.
 *
 * KENAPA PERLU: pola /^\d{4}-\d{2}-\d{2}$/ menerima "2026-02-31", padahal tanggal
 * itu tidak ada. Tanpa pemeriksaan ini, filter seperti itu akan mengembalikan
 * daftar kosong dan Admin mengira berarti tidak ada log.
 *
 * Cara kerja: tanggalnya diubah menjadi tengah malam UTC, lalu dikembalikan ke
 * tanggal aslinya. Kalau berbeda, berarti tanggal itu tidak ada (mis. 31 Februari
 * jadi 3 Maret).
 */
export function tanggalNyataDiKalender(tanggal: string): boolean {
  const bagian = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal.trim());

  if (bagian === null) {
    return false;
  }

  const tahun = Number(bagian[1]);
  const bulan = Number(bagian[2]);
  const hari = Number(bagian[3]);

  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) {
    return false;
  }

  // new Date(year, month-1, day) otomatis menggulir ke bulan berikutnya kalau
  // tanggalnya tidak ada, jadi tidak perlu daftar panjang bulan.
  const batasAkhirBulan = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();

  return hari <= batasAkhirBulan;
}

/**
 * Memeriksa apakah tanggal awal tidak lebih besar dari tanggal akhir.
 *
 * Input: dua teks tanggal (boleh undefined kalau tidak diisi).
 * Output: true kalau rentangnya masuk akal (tidak terbalik).
 *
 * KENAPA PERLU: filter "dari 12 Oktober sampai 11 Oktober" tidak mungkin
 * menunjukkan apa pun, dan lebih mudah dimengerti kalau ditolak dengan pesan
 * "tanggal awal jangan lebih besar dari tanggal akhir".
 */
export function rentangTanggalNalik(
  from: string | undefined,
  to: string | undefined,
): boolean {
  if (from === undefined || to === undefined) {
    return true;
  }

  return from.trim() <= to.trim();
}
