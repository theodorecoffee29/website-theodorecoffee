// File ini: pemanggil API untuk area Admin (/admin/menu), berada di browser.
//
// Semua panggilan melewati file ini, supaya:
//   1. hanya ada satu tempat yang tahu bentuk URL dan bentuk respons,
//   2. setiap kegagalan ditangani di satu tempat, dan
//   3. komponen tampilan tidak pernah memanggil API langsung (cuma menerima
//      props), sesuai aturan di AGENTS.md.
//
// Bentuk data mengikuti src/lib/server/petakan-admin.ts (pemetaan camelCase
// yang dilakukan di server).

import type { BahanTampil, MenuTampil } from "@/lib/server/petakan-admin";

// Metode bayar tidak dipakai di area ini, jadi tidak ada tipe untuk itu di sini.

// Bentuk error yang sudah diterjemahkan ke bahasa manusia.
export type GagalApi = {
  // Tipe error dari server. Untuk area ini yang paling sering adalah
  // VALIDATION_FAILED (misalnya nama menu sudah dipakai) dan FORBIDDEN.
  type: string;
  // Pesan untuk ditampilkan. Untuk VALIDATION_FAILED, pesan ini sudah
  // memuat penjelasan dari server (misalnya "nama ... sudah dipakai"), jadi
  // Admin tahu apa yang harus diperbaiki.
  message: string;
  // Kode ERR-xxxx kalau errornya sudah dicatat di server. Boleh kosong.
  code?: string;
};

// Hasil pemanggilan API: sukses atau gagal. Tidak pernah melempar error.
export type HasilApi<T> =
  { berhasil: true; data: T } | { berhasil: false; error: GagalApi };

/**
 * Mengambil semua menu beserta resepnya dari /api/admin/menu.
 *
 * Output: HasilApi berisi array menu (aktif dan nonaktif), atau GagalApi.
 */
export async function ambilSemuaMenu(): Promise<HasilApi<MenuTampil[]>> {
  const hasil = await panggilApi<{ menuItems: MenuTampil[] }>(
    "/api/admin/menu",
    { method: "GET" },
  );

  if (!hasil.berhasil) {
    return hasil;
  }

  return {
    berhasil: true,
    data: Array.isArray(hasil.data.menuItems) ? hasil.data.menuItems : [],
  };
}

/**
 * Mengambil semua bahan dari /api/admin/ingredients.
 *
 * Output: HasilApi berisi array bahan, atau GagalApi.
 *
 * Dipakai editor resep untuk menampilkan pilihan bahan yang belum dipakai.
 */
export async function ambilSemuaBahan(): Promise<HasilApi<BahanTampil[]>> {
  const hasil = await panggilApi<{ ingredients: BahanTampil[] }>(
    "/api/admin/ingredients",
    { method: "GET" },
  );

  if (!hasil.berhasil) {
    return hasil;
  }

  return {
    berhasil: true,
    data: Array.isArray(hasil.data.ingredients) ? hasil.data.ingredients : [],
  };
}

/**
 * Membuat menu baru.
 *
 * Input: nama menu, harga (angka), dan idempotencyKey.
 * Output: HasilApi berisi { menuItemId, name, price }, atau GagalApi.
 */
export async function buatMenu(params: {
  name: string;
  price: number;
}): Promise<HasilApi<{ menuItemId: string; name: string; price: number }>> {
  return panggilApi("/api/admin/menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: params.name, price: params.price }),
  });
}

/**
 * Mengubah nama dan harga menu.
 *
 * Input: id menu, nama baru, harga baru.
 * Output: HasilApi berisi { menuItemId, name, price }, atau GagalApi.
 *
 * CATATAN: harga baru hanya berlaku untuk pesanan yang dibuat SETELAH ini.
 * Pesanan yang sudah ada menyimpan harga saat itu (docs/data-model.md aturan 6).
 */
export async function ubahMenu(params: {
  menuItemId: string;
  name: string;
  price: number;
}): Promise<HasilApi<{ menuItemId: string; name: string; price: number }>> {
  return panggilApi("/api/admin/menu/" + params.menuItemId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: params.name, price: params.price }),
  });
}

/**
 * Mengaktifkan atau menonaktifkan menu.
 *
 * Input: id menu, dan status baru.
 * Output: HasilApi berisi { menuItemId, isActive }, atau GagalApi.
 */
export async function ubahStatusMenu(params: {
  menuItemId: string;
  isActive: boolean;
}): Promise<HasilApi<{ menuItemId: string; isActive: boolean }>> {
  return panggilApi("/api/admin/menu/" + params.menuItemId + "/active", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive: params.isActive }),
  });
}

/**
 * Mengganti seluruh resep satu menu.
 *
 * Input: id menu, dan baris resep baru.
 * Output: HasilApi berisi { menuItemId, lines }, atau GagalApi.
 *
 * Ini MENGGANTI seluruh resep, bukan menambah satu baris. Resep kosong diizinkan
 * (artinya menu dianggap selalu tersedia).
 */
export async function simpanResep(params: {
  menuItemId: string;
  lines: { ingredientId: string; qtyPerPortion: number }[];
}): Promise<
  HasilApi<{
    menuItemId: string;
    lines: { ingredientId: string; qtyPerPortion: number }[];
  }>
> {
  return panggilApi("/api/admin/menu/" + params.menuItemId + "/recipe", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines: params.lines }),
  });
}

/**
 * Melaporkan error penting dari browser ke /api/log-error.
 *
 * Input: jenis error (dari daftar yang diizinkan server) dan pesan singkat.
 * Output: void. Kegagalan melaporkan log di sini tidak boleh mengganggu halaman,
 *         jadi error ditelan setelah dicatat ke console.error.
 *
 * Kenapa perlu: halaman Admin tidak punya cara lain melaporkan error ke server
 * (docs/logging.md bagian 7). Tanpa ini, kegagalan di laptop Admin tidak akan
 * pernah terlihat.
 */
export async function kirimLogErrorKeServer(
  jenis: "gagal_aksi_staf",
  message: string,
): Promise<void> {
  try {
    await fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: jenis, message: message }),
    });
  } catch (error) {
    // Laporan log gagal dikirim (mis. internet putus). Bukan error fatal untuk
    // halaman, jadi cukup dicatat ke console browser.
    console.error(
      "[src/features/admin/menu/api] gagal mengirim log error ke server: " +
        String(error),
    );
  }
}

/**
 * Fungsi inti: melakukan satu panggilan fetch dan membaca format respons server.
 *
 * Input: URL dan opsi fetch.
 * Output: HasilApi. Fungsi ini TIDAK melempar error, semua masalah diubah jadi
 *         GagalApi supaya pemanggil tidak perlu try/catch.
 *
 * Cara kerja:
 *   1. Panggil server. Kalau gagal (internet putus, server mati), kembalikan
 *      GagalApi dengan pesan ramah.
 *   2. Baca JSON. Kalau server membalas hal lain, juga dikembalikan sebagai
 *      GagalApi.
 *   3. Kalau responsnya ok=false, ambil bagian error-nya.
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
      "[src/features/admin/menu/api] gagal memanggil " +
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

  // 2. Baca isi respons sebagai JSON. Server mungkin membalas bukan JSON kalau
  //    ada masalah, jadi ini juga perlu ditangani.
  let data: unknown;
  try {
    data = await respons.json();
  } catch (error) {
    console.error(
      "[src/features/admin/menu/api] balasan " +
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

  // Server menolak permintaan. Ambil pesan dan kodenya kalau ada.
  //
  // CATATAN: untuk VALIDATION_FAILED, pesan dari server SUDAH memuat penjelasan
  // yang berguna (misalnya nama menu sudah dipakai), jadi pesannya dipakai
  // apa adanya. Jangan digabung dengan pesan lain supaya Admin tetap bisa
  // membaca penyebabnya.
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
