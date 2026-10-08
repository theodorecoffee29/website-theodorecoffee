// File ini: pemanggil API untuk area Cashier (berada di browser).
//
// Semua panggilan Cashier ke server melewati file ini, supaya:
//   1. hanya ada satu tempat yang tahu bentuk URL dan bentuk respons,
//   2. setiap kegagalan ditangani di satu tempat (tidak ada error yang ditelan
//      diam-diam), dan
//   3. komponen tampilan tidak pernah memanggil API langsung (cuma menerima
//      props), sesuai aturan di AGENTS.md.
//
// Catatan: bentuk data di sini sudah mengikuti docs/api-contract.md bagian 4
// (camelCase). Pemetaan dari snake_case milik fungsi database terjadi di sisi
// server (src/lib/server/petakan-hasil-fungsi.ts), bukan di sini.

// Metode bayar yang hanya ada dua (docs/api-contract.md bagian 2).
export type MetodeBayar = "qris" | "tunai";

// Satu item dalam pesanan, sesuai keluaran GET /api/cashier/orders.
export type ItemPesanan = {
  name: string;
  price: number;
  qty: number;
  note: string | null;
  subtotal: number;
};

// Data pembayaran pada pesanan. Hanya ada kalau pesanan sudah dikonfirmasi.
export type Pembayaran = {
  method: string;
  amount: number;
  // true kalau pembayaran sudah di-void (pesanan antrean yang dibatalkan).
  voided: boolean;
};

// Satu pesanan dari GET /api/cashier/orders.
export type PesananCashier = {
  orderId: string;
  queueNumber: number;
  queueDate: string;
  customerName: string;
  // "online" (dari HP customer) atau "cashier" (input manual).
  source: string;
  status: string;
  total: number;
  // Waktu pesanan dibuat, dalam format timestamptz database (misalnya
  // "2026-10-08T09:15:00+07:00"). Jamnya ditampilkan dalam WIB.
  createdAt: string;
  confirmedAt: string | null;
  items: ItemPesanan[];
  payment: Pembayaran | null;
};

// Hasil GET /api/cashier/orders.
export type DaftarPesananResponse = {
  orders: PesananCashier[];
  queueDate: string;
};

// Satu peringatan stok dari konfirmasi (bukan error).
export type PeringatanStokApi = {
  ingredientName: string;
  stockAfter: number;
};

// Hasil POST /api/cashier/orders/[id]/confirm.
export type HasilKonfirmasiApi = {
  status: string;
  queueNumber: number;
  stockWarnings: PeringatanStokApi[];
};

/**
 * Mengambil daftar pesanan hari ini dari /api/cashier/orders.
 *
 * Output: HasilApi berisi { orders, queueDate }, atau GagalApi.
 *
 * Halaman Cashier memanggil ini tiap 3 detik (docs/api-contract.md bagian 5),
 * jadi daftar kosong bukan berarti gagal: server memang belum ada order.
 */
export async function ambilDaftarPesanan(): Promise<
  HasilApi<{ orders: PesananCashier[]; queueDate: string }>
> {
  const hasil = await panggilApi<{
    orders: PesananCashier[];
    queueDate: string;
  }>("/api/cashier/orders", { method: "GET" });

  if (!hasil.berhasil) {
    return hasil;
  }

  // orders mungkin tidak ada kalau server mengirim data tak terduga. Daftar kosong
  // lebih aman daripada membuat halaman error.
  return {
    berhasil: true,
    data: {
      orders: Array.isArray(hasil.data.orders) ? hasil.data.orders : [],
      queueDate: hasil.data.queueDate ?? "",
    },
  };
}

/**
 * Mengonfirmasi satu pesanan dengan metode bayar tertentu.
 *
 * Input: id pesanan dan metode bayar (qris atau tunai).
 * Output: HasilApi berisi { status, queueNumber, stockWarnings }, atau GagalApi.
 *
 * Catatan stockWarnings: daftar ini BUKAN error. Kalau isinya tidak kosong, stok
 * bahan jadi kurang dan Cashier perlu diberi tahu (api-contract bagian 4).
 */
export async function konfirmasiPesanan(
  orderId: string,
  paymentMethod: MetodeBayar,
): Promise<HasilApi<HasilKonfirmasiApi>> {
  return panggilApi("/api/cashier/orders/" + orderId + "/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentMethod: paymentMethod }),
  });
}

/**
 * Membatalkan satu pesanan (oleh Cashier/Admin).
 *
 * Input: id pesanan.
 * Output: HasilApi berisi { status: "dibatalkan" }, atau GagalApi.
 *
 * Cashier boleh membatalkan selama status masih menunggu_konfirmasi atau
 * antrean. Kalau status sudah berubah, server membalas ORDER_STATUS_CHANGED dan
 * pemanggil harus memuat ulang daftar.
 */
export async function batalkanPesanan(
  orderId: string,
): Promise<HasilApi<{ status: string }>> {
  return panggilApi("/api/cashier/orders/" + orderId + "/cancel", {
    method: "POST",
  });
}

// Bentuk error yang sudah diterjemahkan ke bahasa manusia.
export type GagalApi = {
  // Tipe error dari server (VALIDATION_FAILED, ORDER_STATUS_CHANGED, dll).
  type: string;
  // Pesan ramah untuk ditampilkan ke pengguna.
  message: string;
  // Kode ERR-xxxx kalau errornya sudah dicatat di server. Boleh kosong.
  code?: string;
};

// Hasil pemanggilan API: sukses atau gagal. Tidak pernah melempar error.
export type HasilApi<T> =
  { berhasil: true; data: T } | { berhasil: false; error: GagalApi };

/**
 * Melaporkan error penting dari browser ke /api/log-error.
 *
 * Input: jenis error (dari daftar yang diizinkan server) dan pesan singkat.
 * Output: void. Kegagalan melaporkan log di sini tidak boleh mengganggu halaman,
 *         jadi error ditelan setelah dicatat ke console.error.
 *
 * Kenapa perlu: halaman Cashier tidak punya cara lain melaporkan error ke server
 * (docs/logging.md bagian 7). Tanpa ini, kegagalan di laptop Cashier tidak akan
 * pernah terlihat oleh Admin.
 */
export async function kirimLogErrorKeServer(
  jenis: "gagal_konfirmasi" | "gagal_aksi_staf" | "gagal_muat_status",
  message: string,
  orderId?: string,
): Promise<void> {
  try {
    await fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: jenis, message: message, orderId: orderId }),
    });
  } catch (error) {
    // Laporan log gagal dikirim (mis. internet putus). Bukan error fatal untuk
    // halaman, jadi cukup dicatat ke console browser.
    console.error(
      "[src/features/cashier/api] gagal mengirim log error ke server: " +
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
 *   2. Baca JSON. Kalau server membalas hal lain (mis. halaman error), juga
 *      dikembalikan sebagai GagalApi.
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
      "[src/features/cashier/api] gagal memanggil " +
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
      "[src/features/cashier/api] balasan " +
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
  const dariServer = bentukRespons.error ?? {};
  return {
    berhasil: false,
    error: {
      type: dariServer.type ?? "INTERNAL_ERROR",
      message: dariServer.message ?? "Terjadi kesalahan. Coba lagi.",
      // Kode error hanya ada kalau errornya sudah dicatat di server
      // (docs/api-contract.md bagian 1).
      code: dariServer.code,
    },
  };
}
