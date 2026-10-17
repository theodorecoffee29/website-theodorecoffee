// File ini: pemanggil API untuk halaman log Admin (/admin/log), berada di browser.
//
// Semua panggilan melewati file ini, supaya hanya ada satu tempat yang tahu bentuk
// URL dan query string, setiap kegagalan ditangani di satu tempat, dan komponen
// tampilan tidak pernah memanggil API langsung (cuma menerima props).
//
// Endpoint yang dipakai:
//   GET /api/admin/logs/activity -> satu halaman log aktivitas
//   GET /api/admin/logs/errors    -> satu halaman log error
//
// Keduanya HANYA boleh dipanggil Admin. Kalau peran lain yang memanggil, server
// membalas FORBIDDEN dan hasilnya sampai ke sini sebagai GagalApi (bukan error yang
// dilempar).

import type {
  BarisAktivitasTampil,
  BarisErrorTampil,
} from "@/lib/server/petakan-log";

// Bentuk error yang sudah diterjemahkan ke bahasa manusia.
export type GagalApi = {
  // Tipe error dari server.
  type: string;
  // Pesan untuk ditampilkan.
  message: string;
  // Kode ERR-xxxx kalau errornya sudah dicatat di server. Boleh kosong, tapi kalau ada
  // HARUS ditampilkan supaya Admin bisa mencarinya di error_logs
  // (docs/logging.md bagian 5).
  code?: string;
};

// Hasil pemanggilan API: sukses atau gagal. Tidak pernah melempar error.
export type HasilApi<T> =
  { berhasil: true; data: T } | { berhasil: false; error: GagalApi };

// Hasil satu halaman log, sama untuk kedua jenis log.
export type HalamanLog<T> = {
  items: T[];
  // Penanda halaman berikutnya, atau null kalau sudah baris terakhir.
  nextCursor: string | null;
};

// Filter untuk log aktivitas. Semua field opsional: tanpa filter apa pun, server
// mengembalikan 50 baris terbaru.
export type FilterAktivitasKirim = {
  // Tanggal awal dan akhir dalam zona WIB, format "2026-10-11".
  from?: string;
  to?: string;
  // Nama aksi mentah dari database, misal "order.confirmed".
  action?: string;
  // Peran pelaku: admin / cashier / barista / customer / system.
  actorRole?: string;
  // Jenis objek: order / payment / menu_item / recipe / ingredient / account /
  // report / auth.
  entityType?: string;
  // Id order untuk menelusuri jejak satu pesanan.
  orderId?: string;
  // Penanda halaman sebelumnya.
  cursor?: string;
};

// Filter untuk log error.
export type FilterErrorKirim = {
  from?: string;
  to?: string;
  // Tingkat: warning / error / critical.
  severity?: string;
  // Sumber: client / server / database.
  source?: string;
  // Kode error yang dicari, sudah dinormalkan ke huruf besar (ERR-XXXX).
  code?: string;
  orderId?: string;
  cursor?: string;
};

/**
 * Mengambil satu halaman log aktivitas.
 *
 * Input: filter (boleh kosong).
 * Output: HasilApi berisi HalamanLog<BarisAktivitasTampil>, atau GagalApi.
 */
export async function ambilLogAktivitas(
  filter: FilterAktivitasKirim,
): Promise<HasilApi<HalamanLog<BarisAktivitasTampil>>> {
  return panggilApi("/api/admin/logs/activity", filter);
}

/**
 * Mengambil satu halaman log error.
 *
 * Input: filter (boleh kosong).
 * Output: HasilApi berisi HalamanLog<BarisErrorTampil>, atau GagalApi.
 */
export async function ambilLogError(
  filter: FilterErrorKirim,
): Promise<HasilApi<HalamanLog<BarisErrorTampil>>> {
  return panggilApi("/api/admin/logs/errors", filter);
}

/**
 * Melaporkan error penting dari browser ke /api/log-error.
 *
 * Input: jenis error (dari daftar yang diizinkan server) dan pesan singkat.
 * Output: void. Kegagalan melaporkan log di sini tidak boleh mengganggu halaman, jadi
 *         error ditelan setelah dicatat ke console.error.
 *
 * Jenis yang dipakai area ini adalah "gagal_muat_status", karena daftar jenis yang
 * diizinkan server (docs/logging.md bagian 7) belum punya jenis khusus untuk halaman
 * log.
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
      "[src/features/log/api] gagal mengirim log error ke server: " +
        String(error),
    );
  }
}

/**
 * Fungsi inti: melakukan satu panggilan fetch dan membaca format respons server.
 *
 * Input: URL dan filter yang akan diubah menjadi query string.
 * Output: HasilApi. Fungsi ini TIDAK melempar error, semua masalah diubah jadi
 *         GagalApi supaya pemanggil tidak perlu try/catch.
 */
async function panggilApi<T>(
  url: string,
  filter: Record<string, string | undefined>,
): Promise<HasilApi<HalamanLog<T>>> {
  // Query string dibuat di sini, bukan di pemanggil, supaya ada satu tempat yang tahu
  // nama parameternya dan satu tempat yang membuang filter yang kosong.
  const query = buatQueryString(filter);

  const alamat = query === "" ? url : url + "?" + query;

  let respons: Response;

  // 1. Panggil server. Ini bisa gagal karena jaringan.
  try {
    respons = await fetch(alamat, { method: "GET" });
  } catch (error) {
    console.error(
      "[src/features/log/api] gagal memanggil " + alamat + ": " + String(error),
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
      "[src/features/log/api] balasan " +
        alamat +
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
    data?: { items?: T[]; nextCursor?: string | null };
    error?: { type?: string; message?: string; code?: string };
  };

  if (bentukRespons.ok === true) {
    const isi = bentukRespons.data ?? {};

    return {
      berhasil: true,
      data: {
        // Server dijamin mengirim array, tapi di sini dicek lagi supaya satu baris
        // yang aneh tidak membuat halaman error.
        items: Array.isArray(isi.items) ? isi.items : [],
        nextCursor: typeof isi.nextCursor === "string" ? isi.nextCursor : null,
      },
    };
  }

  // Server menolak permintaan. Pesan dari server dipakai apa adanya karena sudah ditulis
  // ramah untuk pengguna (docs/api-contract.md bagian 1).
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

/**
 * Mengubah filter menjadi query string.
 *
 * Input: objek filter yang nilainya boleh kosong (string atau undefined).
 * Output: query string tanpa tanda tanya di depan, atau string kosong kalau tidak ada
 *         filter yang perlu dikirim.
 *
 * Kenapa filter kosong TIDAK dikirim sama sekali: kalau dikirim sebagai teks kosong,
 * server akan menolaknya dengan "tidak sesuai", padahal Admin memang tidak mengisi
 * apa pun. Jadi filter kosong dibuang di sini.
 *
 * Kenapa encodeURIComponent dipakai: nilai yang diketik Admin di kolom id order atau
 * kode bisa mengandung karakter aneh, dan tanpa itu karakter "&" atau "#" akan
 * membuat alamat Rusak (bagian filter berikutnya hilang).
 */
export function buatQueryString(
  filter: Record<string, string | undefined>,
): string {
  const bagian: string[] = [];

  for (const [nama, nilai] of Object.entries(filter)) {
    if (nilai === undefined || nilai === "") {
      continue;
    }

    bagian.push(nama + "=" + encodeURIComponent(nilai));
  }

  return bagian.join("&");
}
