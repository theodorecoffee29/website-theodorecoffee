// File ini: mengubah hasil fungsi database laporan menjadi bentuk yang dikirim ke
// browser (camelCase), sesuai docs/api-contract.md bagian 4c.
//
// KONSEP PENTING file ini:
//
// 1. ISI LAPORAN TIDAK DIUBAH BENTUKNYA.
//    Bentuk isi laporan (date, totals, bySource, byPaymentMethod, topMenu,
//    ingredientUsage, orders) sudah ditetapkan dokumen DAN sudah ditulis dalam
//    camelCase oleh fungsi database. Jadi file ini TIDAK menyusun ulang isi
//    laporan, tidak membuang field, dan tidak menambahkan field baru. Yang
//   dilakukan hanya satu hal: mengubah angka yang datang sebagai TEKS menjadi
//    angka.
//
// 2. ANGKA DARI DATABASE BISA DATANG SEBAGAI TEKS.
//    Nilai angka di dalam jsonb (sum, count, hasil bagi) bisa sampai ke browser
//    sebagai teks, misalnya "15000" atau "12.500". Kalau teks itu dipakai untuk
//    menghitung atau membandingkan di browser, hasilnya salah diam-diam
//    ("15000" + "500" jadi "15000500"). Karena itu angka diubah lewat
//    ubahKeAngka dari src/lib/server/ubah-ke-angka.ts, bukan lewat fungsi baru.
//
// File ini MURNI (tanpa database dan tanpa Supabase), jadi bisa diuji langsung.

import { ubahKeAngka, ubahKeTeks } from "./ubah-ke-angka";

// Nama field yang isinya SELALU angka di dalam isi laporan.
//
// Kenapa daftarnya ditulis eksplisit, bukan "semua teks yang Looks seperti
// angka": nama customer bebas teks, jadi nama customer "12345" akan salah
// diubah jadi angka kalau aturan-nya "kalau kelihatan seperti angka, ubah".
// Dengan daftar eksplisit, hanya field yang memang angka yang diubah.
const FIELD_ANGKA = new Set([
  // totals
  "orderCount",
  "sales",
  "cancelledCount",
  "unfinishedCount",
  // bySource dan byPaymentMethod
  "count",
  "amount",
  // topMenu
  "qty",
  // ingredientUsage
  "used",
  "stockAtEnd",
  // orders
  "queueNumber",
  "total",
]);

// Satu entri Riwayat: ringkasan satu hari.
export type RingkasanLaporan = {
  reportId: string;
  // Tanggal laporan (WIB), misal "2026-10-11".
  date: string;
  // Waktu laporan disimpan, format timestamptz database.
  generatedAt: string;
  // Ringkasan total hari itu, sudah berupa angka.
  totals: unknown;
};

// Hasil GET /api/reports (daftar Riwayat + hasil ridiculously catch up).
export type HasilDaftarLaporan = {
  reports: RingkasanLaporan[];
  // Berapa hari yang baru disimpan oleh save_missing_reports pada permintaan ini.
  catchUpSaved: number;
  // true kalau catch-up GAGAL tapi daftar tetap dikembalikan. Field ini hanya
  // ada kalau ada masalah, supaya respons normal tetap ringkas.
  catchUpFailed?: true;
};

// Hasil GET /api/reports/[id] (isi satu laporan tersimpan).
export type HasilLaporanTersimpan = {
  reportId: string;
  date: string;
  generatedAt: string;
  // Isi laporan apa adanya, hanya angkanya yang sudah diubah ke angka.
  data: unknown;
};

/**
 * Mengubah hasil get_today_report menjadi isi laporan siap kirim.
 *
 * Input: data apa pun hasil pemanggilan fungsi get_today_report.
 * Output: objek isi laporan dengan semua angka sudah berupa angka, dan
 *         live = true.
 *
 * Fungsi database sudah menambahkan live: true sendiri. Nilainya di sini tetap
 * dipastikan true supaya aman kalau nanti fungsi database berubah.
 */
export function petakanLaporanHariIni(data: unknown): unknown {
  const laporan = ubahAngkaDalamLaporan(data);

  if (laporan === null || typeof laporan !== "object") {
    // Bentuk tak terduga: kirim objek paling sederhana yang masih berguna
    // untuk tampilan, bukan error. Laporan tidak boleh membuat halaman Cashier
    // ikut error.
    return { live: true };
  }

  return { ...(laporan as Record<string, unknown>), live: true };
}

/**
 * Mengubah hasil list_reports menjadi daftar Riwayat siap kirim.
 *
 * Input: data apa pun hasil pemanggilan fungsi list_reports, ditambah jumlah
 *        hari yang baru disimpan oleh catch-up.
 * Output: HasilDaftarLaporan.
 *
 * catchUpFailed dipakai supaya browser tahu daftar ini mungkin belum lengkap:
 * kalau catch-up gagal, ada hari yang belum tersimpan dan TIDAK akan muncul di
 * daftar. Layar bisa menampilkan catatan kecil ke Cashier.
 */
export function petakanDaftarLaporan(
  data: unknown,
  catchUpSaved: number,
  catchUpFailed: boolean,
): HasilDaftarLaporan {
  const kolom = jadiObjek(data);
  const daftar = keArray(kolom.reports);

  const reports: RingkasanLaporan[] = [];
  for (const satuMentah of daftar) {
    const satu = jadiObjek(satuMentah);

    // Tanpa reportId, entri ini tidak bisa dibuka lagi dari Riwayat, jadi
    // dilewati.
    const reportId = ubahKeTeks(satu.reportId);
    if (reportId === "") {
      continue;
    }

    reports.push({
      reportId: reportId,
      date: ubahKeTeks(satu.date),
      generatedAt: ubahKeTeks(satu.generatedAt),
      totals: ubahAngkaDalamLaporan(satu.totals),
    });
  }

  return {
    reports: reports,
    catchUpSaved: catchUpSaved,
    // Field ini hanya ditambahkan kalau catch-up memang gagal.
    ...(catchUpFailed ? { catchUpFailed: true } : {}),
  };
}

/**
 * Mengubah hasil get_report menjadi isi satu laporan tersimpan.
 *
 * Input: data apa pun hasil pemanggilan fungsi get_report.
 * Output: HasilLaporanTersimpan.
 */
export function petakanLaporanTersimpan(data: unknown): HasilLaporanTersimpan {
  const kolom = jadiObjek(data);

  return {
    reportId: ubahKeTeks(kolom.reportId),
    date: ubahKeTeks(kolom.date),
    generatedAt: ubahKeTeks(kolom.generatedAt),
    // null (bukan undefined) kalau isinya tidak ada. Alasannya: kunci JSON yang
    // bernilai undefined akan HILANG sama sekali saat respons dikirim, jadi
    // bentuk balasannya berbeda tergantung isi. null selalu ikut terkirim.
    data: kolom.data === undefined ? null : ubahAngkaDalamLaporan(kolom.data),
  };
}

/**
 * Mengubah angka yang datang sebagai teks menjadi angka, di seluruh isi laporan.
 *
 * Input: nilai apa pun (objek, array, teks, angka).
 * Output: nilai dengan bentuk yang sama, kecuali field yang ada di FIELD_ANGKA
 *         yang nilainya diubah dari teks menjadi angka.
 *
 * Cara kerja: fungsi ini menelusuri seluruh isi laporan (objek dan array),
 * karena bentuknya bertingkat-tingkat: totals ada di dalam objek, yang isinya
 * berada di dalam array, dan seterusnya.
 *
 * Field yang TIDAK ada di FIELD_ANGKA (mis. customerName, name, note, date,
 * status) diteruskan apa adanya. Itu penting: nama customer boleh berupa
 * angka, dan mengubahnya jadi angka akan merusak tampilan.
 */
export function ubahAngkaDalamLaporan(nilai: unknown): unknown {
  // Array: telusuri setiap isinya.
  if (Array.isArray(nilai)) {
    return nilai.map((satu) => ubahAngkaDalamLaporan(satu));
  }

  // Objek: periksa setiap fieldnya.
  if (nilai !== null && typeof nilai === "object") {
    const sumber = nilai as Record<string, unknown>;
    const hasil: Record<string, unknown> = {};

    for (const kunci of Object.keys(sumber)) {
      const isi = sumber[kunci];

      if (FIELD_ANGKA.has(kunci)) {
        // Field ini memang angka. Kalau datanya teks, ubah jadi angka.
        // ubahKeAngka juga mengubah angka yang sudah berupa angka (tidak
        //_USA anything), jadi aman untuk kedua kasus.
        hasil[kunci] = ubahKeAngka(isi, 0);
        continue;
      }

      hasil[kunci] = ubahAngkaDalamLaporan(isi);
    }

    return hasil;
  }

  // Teks, angka, null, atau boolean: diteruskan apa adanya.
  return nilai;
}

// ---------------------------------------------------------------------------
// Helper internal
// ---------------------------------------------------------------------------

/** Mengubah data apa pun menjadi objek yang bisa dibaca dengan aman. */
function jadiObjek(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return {};
}

/** Mengubah apa pun menjadi array. Hasil lain dianggap daftar kosong. */
function keArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}
