// File ini: pemanggil API untuk area Barista (berada di browser).
//
// Semua panggilan Barista ke server melewati file ini, supaya:
//   1. hanya ada satu tempat yang tahu bentuk URL dan bentuk respons,
//   2. setiap kegagalan ditangani di satu tempat (tidak ada error yang ditelan
//      diam-diam), dan
//   3. komponen tampilan tidak pernah memanggil API langsung (cuma menerima
//      props), sesuai aturan di AGENTS.md.
//
// PENTING untuk area Barista: layar ini TIDAK BOLEH memuat harga, total, atau
// data pembayaran (docs/pemissions.md bagian 2). Server juga sudah menyaringnya
// (src/lib/server/petakan-antrean.ts). File ini karena itu TIDAK pernah meminta
// atau menyimpan field harga/pembayaran.

// Satu item dalam pesanan, sesuai keluaran GET /api/barista/queue.
// Sengaja tidak ada harga di sini: server memang tidak mengirimnya.
export type ItemAntrean = {
  name: string;
  qty: number;
  note: string | null;
};

// Satu pesanan dari GET /api/barista/queue.
// Bentuk ini adalah BENTUK FINAL: field yang tidak ada di sini tidak boleh
// pernah muncul di layar Barista.
export type PesananAntrean = {
  orderId: string;
  queueNumber: number;
  customerName: string;
  items: ItemAntrean[];
  // Hanya "antrean" atau "dikerjakan".
  status: string;
};

// Hasil GET /api/barista/queue.
export type HasilAntrean = {
  orders: PesananAntrean[];
};

/**
 * Mengambil antrean Barista dari /api/barista/queue.
 *
 * Output: HasilApi berisi { orders }, atau GagalApi.
 *
 * Catatan urutan: server sudah mengurutkan dari waktu konfirmasi paling awal
 * (docs/order-flow.md bagian 4). Daftar ini TIDAK diurutkan ulang di klien,
 * karena urutan server itulah yang benar.
 */
export async function ambilAntrean(): Promise<HasilApi<HasilAntrean>> {
  const hasil = await panggilApi<HasilAntrean>("/api/barista/queue", {
    method: "GET",
  });

  if (!hasil.berhasil) {
    return hasil;
  }

  // orders mungkin tidak ada kalau server mengirim data tak terduga. Daftar
  // kosong lebih aman daripada membuat halaman error.
  return {
    berhasil: true,
    data: {
      orders: Array.isArray(hasil.data.orders) ? hasil.data.orders : [],
    },
  };
}

/**
 * Memulai satu pesanan (tombol Mulai).
 *
 * Input: id pesanan.
 * Output: HasilApi berisi { status: "digerjakan" }, atau GagalApi.
 *
 * Kalau Barista lain sudah menekan Mulai lebih dulu, server membalas
 * ORDER_STATUS_CHANGED dan pemanggil harus memuat ulang antrean
 * (docs/order-flow.md bagian 5).
 */
export async function mulaiPesanan(
  orderId: string,
): Promise<HasilApi<{ status: string }>> {
  return panggilApi("/api/barista/orders/" + orderId + "/start", {
    method: "POST",
  });
}

/**
 * Menyelesaikan satu pesanan (tombol Selesai).
 *
 * Input: id pesanan.
 * Output: HasilApi berisi { status: "selesai" }, atau GagalApi.
 */
export async function selesaikanPesanan(
  orderId: string,
): Promise<HasilApi<{ status: string }>> {
  return panggilApi("/api/barista/orders/" + orderId + "/finish", {
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
 * Kenapa perlu: halaman Barista tidak punya cara lain melaporkan error ke server
 * (docs/logging.md bagian 7). Tanpa ini, kegagalan di laptop Barista tidak akan
 * pernah terlihat oleh Admin.
 */
export async function kirimLogErrorKeServer(
  jenis: "gagal_muat_status" | "gagal_aksi_staf",
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
      "[src/features/barista/api] gagal mengirim log error ke server: " +
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
      "[src/features/barista/api] gagal memanggil " +
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
      "[src/features/barista/api] balasan " +
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
      code: dariServer.code,
    },
  };
}
