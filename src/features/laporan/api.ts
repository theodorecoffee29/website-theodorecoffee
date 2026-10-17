// File ini: pemanggil API untuk area Laporan (/cashier/laporan, /admin/laporan),
// berada di browser.
//
// Semua panggilan melewati file ini, supaya hanya ada satu tempat yang tahu
// bentuk URL dan bentuk respons, setiap kegagalan ditangani di satu tempat, dan
// komponen tampilan tidak pernah memanggil API langsung (cuma menerima props).
//
// Endpoint yang dipakai (docs/api-contract.md bagian 4c):
//   GET  /api/reports/today          -> laporan hari ini (live, belum disimpan)
//   GET  /api/reports                -> daftar Riwayat (+ penyimpanan cadangan)
//   GET  /api/reports/[id]           -> isi satu laporan tersimpan
//   POST /api/reports/[id]/printed   -> catat laporan tersimpan yang dicetak
//   POST /api/reports/today/printed  -> catat laporan hari ini yang dicetak
//
// Peran: hanya Cashier dan Admin (docs/pemissions.md bagian 2). Kalau peran lain
// yang memanggil, server membalas FORBIDDEN dan hasilnya sampai ke sini sebagai
// GagalApi (bukan error yang dilempar).

import { formatRupiah } from "@/features/admin/menu/format";
import type {
  HasilLaporanTersimpan,
  RingkasanLaporan,
} from "@/lib/server/petikan-laporan";
import { petakanIsiLaporan, type IsiLaporanTampil } from "./isi-laporan";
import { teksLaporan } from "./teks";
import { formatJumlah, jamWib, tanggalPanjang, tanggalPendek } from "./waktu";

// Bentuk error yang sudah diterjemahkan ke bahasa manusia.
export type GagalApi = {
  // Tipe error dari server. Untuk area ini yang paling sering FORBIDDEN (mis.
  // sesi Cashier sudah habis atau perannya berubah).
  type: string;
  // Pesan untuk ditampilkan.
  message: string;
  // Kode ERR-xxxx kalau errornya sudah dicatat di server. Boleh kosong, tapi
  // kalau ada HARUS ditampilkan supaya Admin bisa mencarinya di error_logs
  // (docs/logging.md bagian 5).
  code?: string;
};

// Hasil pemanggilan API: sukses atau gagal. Tidak pernah melempar error.
export type HasilApi<T> =
  { berhasil: true; data: T } | { berhasil: false; error: GagalApi };

// Satu baris daftar Riwayat, sudah disiapkan untuk tampilan.
export type RiwayatTampil = {
  reportId: string;
  // Tanggal laporan panjang, mis. "11 Oktober 2026".
  tanggalTeks: string;
  // Tanggal laporan pendek, mis. "11/10/2026".
  tanggalPendek: string;
  // Waktu laporan disimpan dalam WIB, mis. "03.05". String kosong kalau tidak
  // terbaca.
  waktuTeks: string;
  // Jumlah order terhitung, dalam teks.
  orderTerhitungTeks: string;
  // Total penjualan dalam teks rupiah.
  totalPenjualanTeks: string;
};

// Hasil dimuatnya daftar Riwayat.
export type HasilRiwayat = {
  reports: RiwayatTampil[];
  // true kalau penyimpanan cadangan laporan yang lewat GAGAL, sehingga daftar ini
  // mungkin belum lengkap. Ini nilai field catchUpFailed dari server.
  catchUpGagal: boolean;
};

// Isi satu laporan tersimpan, sudah disiapkan untuk tampilan.
export type DetailLaporanTampil = {
  isi: IsiLaporanTampil;
  // Tanggal laporan, format "2026-10-11" (dipakai untuk judul cetak).
  tanggal: string;
  // Waktu laporan disimpan, format timestamptz dari database (dipakai untuk
  // kalimat "Disimpan pada ...").
  disimpan: string;
};

// Hasil dimuatnya laporan hari ini.
export type HasilLaporanHariIni = {
  // Isi laporan yang sudah siap tampil.
  isi: IsiLaporanTampil;
  // Tanggal laporan dalam format database ("2026-10-11").
  //
  // Kenapa tanggal mentah ikut diambil padahal isi sudah dipetakan: endpoint
  // pencetakan menerima tanggal dalam format database, sedangkan tampilan
  // memakai tanggal bahasa manusia. Yang perlu dikirim ke server adalah bentuk
  // database, jadi bentuk itu diambil di sini, di satu tempat.
  tanggal: string;
};

/**
 * Mengambil laporan hari ini (live) dari /api/reports/today.
 *
 * Output: HasilApi berisi HasilLaporanHariIni, atau GagalApi.
 *
 * Laporan ini belum disimpan, jadi isinya berubah setiap ada transaksi
 * (docs/api-contract.md bagian 4c).
 */
export async function ambilLaporanHariIni(): Promise<
  HasilApi<HasilLaporanHariIni>
> {
  const hasil = await panggilApi<unknown>("/api/reports/today", {
    method: "GET",
  });

  if (!hasil.berhasil) {
    return hasil;
  }

  return {
    berhasil: true,
    data: {
      isi: petakanIsiLaporan(hasil.data),
      tanggal: bacaTanggalMentah(hasil.data),
    },
  };
}

/**
 * Mengambil daftar Riwayat dari /api/reports.
 *
 * Output: HasilApi berisi HasilRiwayat, atau GagalApi.
 *
 * CATATAN PENTING: permintaan ini menjalankan penyimpanan cadangan laporan yang
 * lewat (save_missing_reports) sebelum membaca daftar, jadi bisa agak lama.
 * Karena itu layar menampilkan "Memuat..." selama menunggu.
 */
export async function ambilRiwayatLaporan(): Promise<HasilApi<HasilRiwayat>> {
  const hasil = await panggilApi<{
    reports?: RingkasanLaporan[];
    catchUpFailed?: boolean;
  }>("/api/reports", { method: "GET" });

  if (!hasil.berhasil) {
    return hasil;
  }

  return {
    berhasil: true,
    data: {
      reports: petakanDaftarRiwayat(hasil.data.reports),
      catchUpGagal: hasil.data.catchUpFailed === true,
    },
  };
}

/**
 * Mengambil isi satu laporan tersimpan dari /api/reports/[id].
 *
 * Input: id laporan (uuid) dari parameter halaman.
 * Output: HasilApi berisi DetailLaporanTampil, atau GagalApi.
 *
 * CATATAN SOAL "TIDAK DITEMUKAN": kalau server membalas VALIDATION_FAILED, itu
 * berarti id-nya tidak ada di Riwayat (bukan kegagalan sistem, jadi tidak dicatat
 * ke error_logs). Pemanggil memeriksa tipe errornya untuk menampilkan pesan ramah
 * dengan tautan kembali ke daftar.
 */
export async function ambilLaporanDetail(
  reportId: string,
): Promise<HasilApi<DetailLaporanTampil>> {
  const hasil = await panggilApi<HasilLaporanTersimpan>(
    "/api/reports/" + reportId,
    { method: "GET" },
  );

  if (!hasil.berhasil) {
    return hasil;
  }

  return {
    berhasil: true,
    data: {
      isi: petakanIsiLaporan(hasil.data.data),
      tanggal: hasil.data.date,
      disimpan: hasil.data.generatedAt,
    },
  };
}

/**
 * Mencatat bahwa laporan hari ini (live) sudah dicetak.
 *
 * Input: tanggal laporan hari ini (format YYYY-MM-DD), supaya Admin tahu laporan
 *        tanggal berapa yang diambil salinannya.
 * Output: void. Fungsi ini SENGAJA tidak mengembalikan hasil apa pun.
 *
 * KENAPA HASILNYA TIDAK DIPERHATIKAN: mencetak tidak boleh gagal, tertunda,
 * atau berubah karena server sedang lambat. Laporan sudah tercetak begitu
 * window.print() dipanggil; jejaknya di log cuma nilai tambahan
 * (docs/logging.md bagian 6 poin 4). Jadi kegagalan hanya ditulis ke
 * console.error supaya bisa dicari kalau memang terjadi.
 */
export async function catatLaporanHariIniDicetak(
  tanggal: string,
): Promise<void> {
  const hasil = await panggilApi("/api/reports/today/printed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tanggal: tanggal }),
  });

  if (!hasil.berhasil) {
    console.error(
      "[src/features/laporan/api] laporan hari ini dicetak tapi jejaknya gagal " +
        "dicatat: " +
        hasil.error.type,
    );
  }
}

/**
 * Mencatat bahwa satu laporan tersimpan sudah dicetak.
 *
 * Input: id laporan yang dicetak.
 * Output: void, dengan alasan yang sama seperti catatLaporanHariIniDicetak di
 *         atas: kegagalan pencatatan tidak boleh menggagalkan pencetakan.
 */
export async function catatLaporanDicetak(reportId: string): Promise<void> {
  const hasil = await panggilApi("/api/reports/" + reportId + "/printed", {
    method: "POST",
  });

  if (!hasil.berhasil) {
    console.error(
      "[src/features/laporan/api] laporan dicetak tapi jejaknya gagal dicatat: " +
        hasil.error.type,
    );
  }
}

/**
 * Melaporkan error penting dari browser ke /api/log-error.
 *
 * Input: jenis error (dari daftar yang diizinkan server) dan pesan singkat.
 * Output: void. Kegagalan melaporkan log di sini tidak boleh mengganggu halaman,
 *         jadi error ditelan setelah dicatat ke console.error.
 *
 * Jenis yang dipakai area ini adalah "gagal_muat_status", karena daftar jenis
 * yang diizinkan server (docs/logging.md bagian 7) belum punya jenis khusus
 * laporan.
 */
export async function kirimLogErrorKeServer(
  jenis: "gagal_muat_status",
  message: string,
): Promise<void> {
  try {
    await fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: jenis, message: message }),
    });
  } catch (error) {
    console.error(
      "[src/features/laporan/api] gagal mengirim log error ke server: " +
        String(error),
    );
  }
}

/**
 * Menyusun pesan ramah untuk kegagalan memuat.
 *
 * Input: error dari server.
 * Output: kalimat untuk ditampilkan ke pengguna.
 *
 * KENAPA KODE ERROR DISISIPKAN DI SINI: server mengirim kode ERR-xxxx terpisah dari
 * pesannya, dan kode itulah yang dicari Admin di tabel error_logs
 * (docs/logging.md bagian 5). Jadi kalau kodenya ada, kode itu harus ikut tampil,
 * kalau tidak ada kesalahan ini tidak bisa dicari.
 *
 * Kalau kodenya tidak ada, errornya hanya penolakan bisnis yang normal (mis.
 * FORBIDDEN karena sesi sudah habis), yang memang tidak dicatat
 * (docs/api-contract.md bagian 6), jadi tidak perlu kode.
 */
export function pesanGagalMuat(error: GagalApi): string {
  if (error.code !== undefined && error.code !== "") {
    return teksLaporan.pesan.gagalMuatDenganKode.replace("{kode}", error.code);
  }

  return error.message;
}

/**
 * Memetakan daftar ringkasan dari server menjadi baris siap tampil.
 *
 * Input: array ringkasan dari server (boleh undefined atau bukan array).
 * Output: array RiwayatTampil.
 *
 * Kenapa urutan dari server dipakai apa adanya: server mengembalikan daftar
 * terbaru dulu (docs/api-contract.md bagian 4c), dan mengurutkan lagi di sini
 * hanya menambah tempat yang bisa salah tanpa menambah informasi.
 */
function petakanDaftarRiwayat(
  laporan: RingkasanLaporan[] | undefined,
): RiwayatTampil[] {
  if (!Array.isArray(laporan)) {
    return [];
  }

  return laporan.map((satu) => {
    const totals =
      satu.totals !== null && typeof satu.totals === "object"
        ? (satu.totals as Record<string, unknown>)
        : {};

    return {
      reportId: satu.reportId,
      tanggalTeks: tanggalPanjang(satu.date),
      tanggalPendek: tanggalPendek(satu.date),
      waktuTeks: jamWib(satu.generatedAt),
      orderTerhitungTeks: formatJumlah(totals.orderCount),
      totalPenjualanTeks: formatRupiah(totals.sales),
    };
  });
}

/**
 * Membaca tanggal laporan ("2026-10-11") dari isi laporan apa adanya.
 *
 * Input: isi laporan dari server (unknown).
 * Output: teks tanggal, atau string kosong kalau tidak terbaca.
 *
 * Isi laporan sudah dipetakan menjadi bentuk siap tampil, jadi bentuk mentahnya
 * tidak ada di layar. Fungsi ini satu-satunya tempat yang membaca bentuk mentah,
 * supaya tidak ada tempat lain yang perlu tahu bentuk itu.
 */
function bacaTanggalMentah(isi: unknown): string {
  if (isi === null || typeof isi !== "object") {
    return "";
  }

  const tanggal = (isi as Record<string, unknown>).date;

  return typeof tanggal === "string" ? tanggal : "";
}

/**
 * Fungsi inti: melakukan satu panggilan fetch dan membaca format respons server.
 *
 * Input: URL dan opsi fetch.
 * Output: HasilApi. Fungsi ini TIDAK melempar error, semua masalah diubah jadi
 *         GagalApi supaya pemanggil tidak perlu try/catch.
 */
async function panggilApi<T>(
  url: string,
  opsi: RequestInit,
): Promise<HasilApi<T>> {
  let respons: Response;

  // 1. Panggil server. Ini bisa gagal karena jaringan.
  try {
    respons = await fetch(url, opsi);
  } catch (error) {
    console.error(
      "[src/features/laporan/api] gagal memanggil " +
        url +
        ": " +
        String(error),
    );
    return {
      berhasil: false,
      error: {
        type: "INTERNAL_ERROR",
        message:
          "Tidak bisa menghubungi server. Periksa koneksi internet kamu.",
      },
    };
  }

  // 2. Baca isi respons sebagai JSON.
  let data: unknown;
  try {
    data = await respons.json();
  } catch (error) {
    console.error(
      "[src/features/laporan/api] balasan " +
        url +
        " bukan JSON: " +
        String(error),
    );
    return {
      berhasil: false,
      error: {
        type: "INTERNAL_ERROR",
        message: "Terjadi kesalahan. Coba lagi.",
      },
    };
  }

  // 3. Bentuk respons server: { ok: true, data } atau { ok: false, error }.
  const bentukRespons = data as {
    ok?: boolean;
    data?: T;
    error?: { type?: string; message?: string; code?: string };
  };

  if (bentukRespons.ok === true) {
    return { berhasil: true, data: bentukRespons.data as T };
  }

  // Server menolak permintaan. Pesan dari server dipakai apa adanya karena sudah
  // ditulis ramah untuk pengguna (docs/api-contract.md bagian 1).
  const dariServer = bentukRespons.error ?? {};
  return {
    berhasil: false,
    error: {
      type: dariServer.type ?? "INTERNAL_ERROR",
      message: dariServer.message ?? "Terjadi kesalahan. Coba lagi.",
      code: dariServer.code,
    },
  };
}
