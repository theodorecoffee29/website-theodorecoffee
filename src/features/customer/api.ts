// File ini: pemanggil API untuk area customer (berada di browser).
//
// Semua panggilan ke server melewati file ini, supaya:
//   1. hanya ada satu tempat yang tahu bentuk URL dan bentuk respons,
//   2. setiap kegagalan ditangani di satu tempat (tidak ada error yang ditelan
//      diam-diam), dan
//   3. komponen tampilan tidak pernah memanggil API langsung (cuma menerima
//      props), sesuai aturan di AGENTS.md.
//
// Format respons server selalu { ok, data } atau { ok: false, error }
// (docs/api-contract.md bagian 1), jadi setiap pemanggil memeriksa "ok".

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
export type HasilApi<T> = { berhasil: true; data: T } | { berhasil: false; error: GagalApi };

// Satu item menu dari /api/menu.
export type MenuItem = {
  id: string;
  name: string;
  price: number;
  // false berarti tampil "Habis" dan tidak bisa dipilih.
  available: boolean;
};

// Hasil status order dari /api/orders/[id]/status.
export type StatusOrderResponse = {
  status: string;
  queueNumber: number;
  queueDate: string;
  items: { name: string; qty: number; note: string | null }[];
  total: number;
};

/**
 * Mengambil daftar menu dari /api/menu.
 *
 * Output: HasilApi berisi array menu, atau GagalApi.
 */
export async function ambilMenu(): Promise<HasilApi<MenuItem[]>> {
  // getMenu() mengembalikan { items: [...] }.
  const hasil = await panggilApi<{ items: MenuItem[] }>("/api/menu", { method: "GET" });

  if (!hasil.berhasil) {
    return hasil;
  }

  // Kalau items bukan array (mis. server berubah), anggap menu kosong.
  return {
    berhasil: true,
    data: Array.isArray(hasil.data.items) ? hasil.data.items : [],
  };
}

/**
 * Mengirim pesanan baru ke /api/orders.
 *
 * Input: nama customer, item pesanan, dan idempotencyKey.
 * Output: HasilApi berisi { orderId, queueNumber, queueDate, status, total },
 *         atau GagalApi.
 *
 * PENTING: tidak ada harga atau total yang dikirim. Server menghitung ulang
 * harga dari menu_items (docs/api-contract.md bagian 2).
 */
export async function kirimPesanan(params: {
  customerName: string;
  items: { menuItemId: string; qty: number; note?: string }[];
  idempotencyKey: string;
}): Promise<HasilApi<{ orderId: string; queueNumber: number; status: string; total: number }>> {
  return panggilApi("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: params.customerName,
      items: params.items,
      idempotencyKey: params.idempotencyKey,
    }),
  });
}

/**
 * Mengambil status satu order dari /api/orders/[id]/status.
 *
 * Input: id order.
 * Output: HasilApi berisi status order, atau GagalApi (misalnya ORDER_NOT_FOUND
 *         kalau id-nya tidak ada).
 */
export async function ambilStatusOrder(orderId: string): Promise<HasilApi<StatusOrderResponse>> {
  return panggilApi("/api/orders/" + orderId + "/status", { method: "GET" });
}

/**
 * Membatalkan satu order oleh customer.
 *
 * Input: id order.
 * Output: HasilApi berisi { status: "dibatalkan" }, atau GagalApi.
 *
 * Kalau server menjawab ORDER_STATUS_CHANGED (mis. karena Cashier sudah
 * mengonfirmasi lebih dulu), pemanggil harus menampilkan pesan itu ke pengguna.
 */
export async function batalkanOrder(
  orderId: string,
): Promise<HasilApi<{ status: string }>> {
  return panggilApi("/api/orders/" + orderId + "/cancel", { method: "POST" });
}

/**
 * Melaporkan error penting dari browser ke /api/log-error.
 *
 * Input: jenis error (dari daftar yang diizinkan server) dan pesan singkat.
 * Output: void. Kegagalan dilaporkan di sini tidak boleh mengganggu halaman,
 *         jadi error ditelan setelah dicatat ke console.error.
 *
 * Kenapa perlu: halaman customer tidak punya cara lain melaporkan error ke
 * server (docs/logging.md bagian 7). Tanpa ini, kegagalan di HP customer tidak
 * akan pernah terlihat oleh Admin.
 */
export async function kirimLogErrorKeServer(
  jenis: "gagal_kirim_order" | "gagal_muat_status" | "gagal_konfirmasi" | "gagal_aksi_staf",
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
    // Laporan log gagal dikirim (mis. internet putus). Ini bukan error fatal
    // untuk halaman, jadi cukup dicatat di console browser.
    console.error(
      "[src/features/customer/api] gagal mengirim log error ke server: " + String(error),
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
async function panggilApi<T>(url: string, opsi: RequestInit): Promise<HasilApi<T>> {
  let respons: Response;

  // 1. Panggil server. Ini bisa gagal karena jaringan.
  try {
    respons = await fetch(url, opsi);
  } catch (error) {
    // Jaringan atau server tidak bisa dihubungi.
    console.error("[src/features/customer/api] gagal memanggil " + url + ": " + String(error));
    return {
      berhasil: false,
      error: {
        type: "INTERNAL_ERROR",
        message: "Tidak bisa menghubungi server. Periksa koneksi internet kamu.",
      },
    };
  }

  // 2. Baca isi respons sebagai JSON. Server mungkin membalas bukan JSON kalau
  //    ada masalah, jadi ini juga perlu ditangani.
  let data: unknown;
  try {
    data = await respons.json();
  } catch (error) {
    console.error("[src/features/customer/api] balasan " + url + " bukan JSON: " + String(error));
    return {
      berhasil: false,
      error: { type: "INTERNAL_ERROR", message: "Terjadi kesalahan. Coba lagi." },
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