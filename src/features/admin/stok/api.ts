// File ini: pemanggil API untuk area Stok Admin (/admin/stok), berada di browser.
//
// Semua panggilan melewati file ini, supaya hanya ada satu tempat yang tahu
// bentuk URL dan bentuk respons, setiap kegagalan ditangani di satu tempat, dan
// komponen tampilan tidak pernah memanggil API langsung (cuma menerima props).
//
// Bentuk data mengikuti src/lib/server/petakan-admin.ts (pemetaan camelCase di
// server).

import type { BahanTampil, PergerakanTampil } from "@/lib/server/petakan-admin";

// Bentuk error yang sudah diterjemahkan ke bahasa manusia.
export type GagalApi = {
  // Tipe error dari server. Untuk area ini yang paling sering VALIDATION_FAILED
  // (misalnya nama bahan sudah dipakai) dan FORBIDDEN.
  type: string;
  // Pesan untuk ditampilkan. Untuk VALIDATION_FAILED, pesan ini sudah memuat
  // penjelasan dari server, jadi dipakai apa adanya.
  message: string;
  // Kode ERR-xxxx kalau errornya sudah dicatat di server. Boleh kosong.
  code?: string;
};

// Hasil pemanggilan API: sukses atau gagal. Tidak pernah melempar error.
export type HasilApi<T> =
  { berhasil: true; data: T } | { berhasil: false; error: GagalApi };

/**
 * Mengambil semua bahan beserta stoknya dari /api/admin/ingredients.
 *
 * Output: HasilApi berisi array bahan, atau GagalApi.
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
 * Membuat bahan baru.
 *
 * Input: nama, satuan (g/ml/pcs), dan stok awal (opsional, boleh 0).
 * Output: HasilApi berisi { ingredientId, name, unit, stockQty }, atau GagalApi.
 */
export async function buatBahan(params: {
  name: string;
  unit: string;
  initialStock?: number;
}): Promise<
  HasilApi<{
    ingredientId: string;
    name: string;
    unit: string;
    stockQty: number;
  }>
> {
  return panggilApi("/api/admin/ingredients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      unit: params.unit,
      // Kalau tidak diisi, dikirim null supaya database memakai 0 dan tidak
      // mencatat pergerakan restock.
      ...(params.initialStock === undefined
        ? {}
        : { initialStock: params.initialStock }),
    }),
  });
}

/**
 * Mengubah nama bahan.
 *
 * Input: id bahan, nama baru.
 * Output: HasilApi berisi { ingredientId, name }, atau GagalApi.
 *
 * CATATAN: satuan TIDAK bisa diubah (docs/api-contract.md bagian 4b), jadi
 * fungsi ini hanya mengirim nama.
 */
export async function ubahNamaBahan(params: {
  ingredientId: string;
  name: string;
}): Promise<HasilApi<{ ingredientId: string; name: string }>> {
  return panggilApi("/api/admin/ingredients/" + params.ingredientId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: params.name }),
  });
}

/**
 * Menambah stok bahan (restock).
 *
 * Input: id bahan, jumlah yang ditambahkan (lebih dari 0), dan catatan opsional.
 * Output: HasilApi berisi { ingredientId, stockQty, qtyChange }, atau GagalApi.
 */
export async function tambahStok(params: {
  ingredientId: string;
  qty: number;
  note?: string;
}): Promise<
  HasilApi<{ ingredientId: string; stockQty: number; qtyChange: number }>
> {
  return panggilApi(
    "/api/admin/ingredients/" + params.ingredientId + "/restock",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qty: params.qty,
        // Catatan kosong tidak dikirim; database tetap bisa menerima null.
        ...(params.note === undefined ? {} : { note: params.note }),
      }),
    },
  );
}

/**
 * Mengoreksi stok ke jumlah hasil hitung fisik.
 *
 * Input: id bahan, jumlah hasil hitung fisik (0 atau lebih), dan alasan (wajib).
 * Output: HasilApi berisi { ingredientId, stockQty, qtyChange }, atau GagalApi.
 *
 * Fungsi ini juga dipakai untuk mengembalikan stok yang minus ke angka
 * sebenarnya.
 */
export async function koreksiStok(params: {
  ingredientId: string;
  newQty: number;
  reason: string;
}): Promise<
  HasilApi<{ ingredientId: string; stockQty: number; qtyChange: number }>
> {
  return panggilApi(
    "/api/admin/ingredients/" + params.ingredientId + "/adjust",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newQty: params.newQty,
        reason: params.reason,
      }),
    },
  );
}

/**
 * Mengambil riwayat pergerakan stok satu bahan.
 *
 * Input: id bahan.
 * Output: HasilApi berisi array pergerakan (terbaru dulu), atau GagalApi.
 */
export async function ambilRiwayatStok(
  ingredientId: string,
): Promise<HasilApi<PergerakanTampil[]>> {
  const hasil = await panggilApi<{ movements: PergerakanTampil[] }>(
    "/api/admin/ingredients/" + ingredientId + "/movements",
    { method: "GET" },
  );

  if (!hasil.berhasil) {
    return hasil;
  }

  return {
    berhasil: true,
    data: Array.isArray(hasil.data.movements) ? hasil.data.movements : [],
  };
}

/**
 * Melaporkan error penting dari browser ke /api/log-error.
 *
 * Input: jenis error (dari daftar yang diizinkan server) dan pesan singkat.
 * Output: void. Kegagalan melaporkan log di sini tidak boleh mengganggu halaman,
 *         jadi error ditelan setelah dicatat ke console.error.
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
    console.error(
      "[src/features/admin/stok/api] gagal mengirim log error ke server: " +
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
      "[src/features/admin/stok/api] gagal memanggil " +
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
      "[src/features/admin/stok/api] balasan " +
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

  // Server menolak permintaan.
  //
  // CATATAN: untuk VALIDATION_FAILED, pesan dari server SUDAH memuat penjelasan
  // yang berguna (misalnya nama bahan sudah dipakai), jadi pesannya dipakai apa
  // adanya.
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
