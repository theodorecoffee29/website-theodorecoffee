// File ini: pemanggil API untuk panel "Sisa stok" (dipakai Cashier dan Barista).
//
// File ini dikumpulkan di src/features/stok/ (bukan di features/cashier atau
// features/barista) karena panelnya dipakai dua area dengan komponen tampilan
// yang sama.
//
// CATATAN KEAMANAN: layar Barista tidak boleh melihat harga dan pembayaran
// (docs/pemissions.md bagian 2). Karena itu tipe di file ini tidak punya kolom
// harga, total, maupun pembayaran sama sekali. Kalau nanti ada field yang
// ditambah, panel ini otomatis membocorkan data terlarang ke Barista.

// Bentuk data yang dibutuhkan panel, sesuai hasil GET /api/staff/stok.
//
// Bentuk ini adalah BENTUK FINAL: field yang tidak ada di sini tidak boleh
// pernah muncul di panel sisa stok.
export type MenuSisaStok = {
  menuItemId: string;
  name: string;
  // Sisa porsi (angka 0 atau lebih), atau null kalau menu tanpa resep.
  portionsLeft: number | null;
};

export type BahanSisaStok = {
  ingredientId: string;
  name: string;
  // Satuan dari database: "g", "ml", atau "pcs".
  unit: string;
  // Stok saat ini. Boleh negatif.
  stockQty: number;
  // true kalau stoknya di bawah 0.
  isNegative: boolean;
};

export type HasilSisaStok = {
  menus: MenuSisaStok[];
  ingredients: BahanSisaStok[];
};

// Bentuk error yang sudah diterjemahkan ke bahasa manusia.
export type GagalApi = {
  type: string;
  message: string;
  code?: string;
};

// Hasil pemanggilan API: sukses atau gagal. Tidak pernah melempar error.
export type HasilApi<T> =
  { berhasil: true; data: T } | { berhasil: false; error: GagalApi };

/**
 * Mengambil ringkasan sisa stok dari /api/staff/stock.
 *
 * Output: HasilApi berisi { menus, ingredients }, atau GagalApi.
 *
 * Endpoint ini hanya boleh dipanggil Cashier, Barista, dan Admin. Kalau peran
 * lain yang memanggil, server membalas FORBIDDEN dan hasilnya sampai ke sini
 * sebagai GagalApi (bukan error yang dilempar).
 */
export async function ambilSisaStok(): Promise<HasilApi<HasilSisaStok>> {
  const hasil = await panggilApi<HasilSisaStok>("/api/staff/stock", {
    method: "GET",
  });

  if (!hasil.berhasil) {
    return hasil;
  }

  // Kalau server mengirim data tak terduga, daftar kosong lebih aman daripada
  // membuat halaman error. Panel ini hanya informasi tambahan.
  return {
    berhasil: true,
    data: {
      menus: Array.isArray(hasil.data.menus) ? hasil.data.menus : [],
      ingredients: Array.isArray(hasil.data.ingredients)
        ? hasil.data.ingredients
        : [],
    },
  };
}

/**
 * Melaporkan error penting dari browser ke /api/log-error.
 *
 * Input: jenis error dan pesan singkat.
 * Output: void. Kegagalan melaporkan log di sini tidak boleh mengganggu panel,
 *         jadi error ditelan setelah dicatat ke console.error.
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
      "[src/features/stok/api] gagal mengirim log error ke server: " +
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

  try {
    respons = await fetch(url, opsi);
  } catch (error) {
    console.error(
      "[src/features/stok/api] gagal memanggil " + url + ": " + String(error),
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

  let data: unknown;
  try {
    data = await respons.json();
  } catch (error) {
    console.error(
      "[src/features/stok/api] balasan " +
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

  const bentukRespons = data as {
    ok?: boolean;
    data?: T;
    error?: { type?: string; message?: string; code?: string };
  };

  if (bentukRespons.ok === true) {
    return { berhasil: true, data: bentukRespons.data as T };
  }

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
