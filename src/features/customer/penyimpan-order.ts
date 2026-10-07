// File ini: menyimpan dan membaca daftar order aktif di localStorage.
//
// Kenapa disimpan di browser: customer tidak punya akun (docs/permissions.md
// bagian 3), jadi tidak ada tempat lain untuk mengingat order-nya. Id order
// disimpan di HP customer, sehingga membuka QR booth lagi dari HP yang sama
// langsung menampilkan order yang sedang berjalan.
//
// Yang disimpan hanya ringkasan order (id dan nama), bukan data pesanan. Data
// pesanan (status, item, total) selalu ditanyakan ulang ke server, jadi isinya
// tidak pernah dianggap benar.
//
// CATATAN PENTING soal nama customer: fungsi get_order_status sengaja tidak
// mengembalikan nama (docs/api-contract.md bagian 4: outputnya hanya status,
// queueNumber, queueDate, items, dan total). Padahal halaman status perlu
// menampilkan nama. Karena API-nya tidak diubah, nama diambil dari sini: HP ini
// yang membuat pesanan, jadi nama yang dipakai saat memesan ikut disimpan.
//
// Kenapa setiap akses dibungkus try/catch: localStorage bisa tidak tersedia.
// Contohnya Safari mode privat, atau browser yang memblokir penyimpanan. Kalau
// tidak ditangani, satu error penyimpanan bisa membuat halaman tidak bisa dibuka
// sama sekali. Jadi setiap kegagalan dianggap "tidak ada apa-apa" dan halaman
// tetap jalan.

export const KUNCI_PENYIMPANAN_ORDER = "theodore-coffee:order-aktif";

// Satu order yang tersimpan di HP ini.
export type OrderTersimpan = {
  orderId: string;
  customerName: string;
};

// Bentuk penyimpanan yang dipakai file ini. Sengaja hanya memakai sebagian
// kecil dari API localStorage, supaya mudah ditiru saat pengujian.
export type PenyimpananSederhana = {
  getItem(kunci: string): string | null;
  setItem(kunci: string, nilai: string): void;
  removeItem(kunci: string): void;
};

/**
 * Mengambil localStorage browser, atau null kalau tidak tersedia.
 *
 * Output: objek localStorage, atau null kalau browser memblokirnya.
 *
 * Kenapa tidak langsung memakai window.localStorage: di server (SSR) dan di
 * tes, objek itu tidak ada, jadi harus diperiksa lebih dulu.
 */
export function ambilPenyimpanan(): PenyimpananSederhana | null {
  // Dicek apa adanya "window" supaya aman dipanggil di server dan di tes.
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    // Mengakses localStorage saja sudah bisa melempar error di beberapa browser.
    return null;
  }
}

/**
 * Membaca daftar order aktif dari penyimpanan.
 *
 * Output: array OrderTersimpan. Kalau tidak ada isinya, penyimpanannya error,
 * atau isinya rusak, hasilnya array kosong.
 *
 * Kenapa isinya diperiksa: localStorage bisa diubah sendiri oleh orang (lewat
 * console browser), jadi isinya tidak bisa dipercaya tanpa diperiksa. Order
 * tanpa id yang benar dilepas, karena tidak berguna.
 */
export function bacaOrderAktif(
  penyimpanan: PenyimpananSederhana | null = ambilPenyimpanan(),
): OrderTersimpan[] {
  // Tidak ada penyimpanan: anggap tidak ada order.
  if (!penyimpanan) {
    return [];
  }

  let teksTersimpan: string | null = null;
  try {
    teksTersimpan = penyimpanan.getItem(KUNCI_PENYIMPANAN_ORDER);
  } catch {
    // Penyimpanan error saat dibaca: anggap tidak ada order, jangan menjatuhkan
    // halaman.
    return [];
  }

  // Belum pernah ada order tersimpan.
  if (teksTersimpan === null) {
    return [];
  }

  let data: unknown;
  try {
    data = JSON.parse(teksTersimpan);
  } catch {
    // Isinya bukan JSON yang valid (misalnya diubah manual). Buang saja.
    return [];
  }

  // Hanya terima array. Selain itu, anggap kosong.
  if (!Array.isArray(data)) {
    return [];
  }

  const hasil: OrderTersimpan[] = [];
  for (const satuItem of data) {
    if (satuItem === null || typeof satuItem !== "object") {
      continue;
    }

    const kolom = satuItem as Record<string, unknown>;
    const orderId = kolom.orderId;
    if (typeof orderId !== "string" || orderId.length === 0) {
      // Tanpa id yang benar, order ini tidak bisa dipakai. Lewati.
      continue;
    }

    const customerName = kolom.customerName;
    hasil.push({
      orderId: orderId,
      customerName: typeof customerName === "string" ? customerName : "",
    });
  }

  return hasil;
}

/**
 * Menulis daftar order aktif ke penyimpanan.
 *
 * Input: daftar order, dan penyimpanan (opsional, untuk pengujian).
 * Output: void. Kalau gagal menulis, tidak ada yang terjadi (diam-diam),
 *         karena halaman tetap harus bisa dipakai walau storage tidak ada.
 */
export function tulisOrderAktif(
  daftarOrder: OrderTersimpan[],
  penyimpanan: PenyimpananSederhana | null = ambilPenyimpanan(),
): void {
  if (!penyimpanan) {
    return;
  }

  try {
    // Kalau daftarnya kosong, hapus kuncinya saja supaya storage tidak penuh
    // dengan "[]" yang tidak berguna.
    if (daftarOrder.length === 0) {
      penyimpanan.removeItem(KUNCI_PENYIMPANAN_ORDER);
      return;
    }

    penyimpanan.setItem(KUNCI_PENYIMPANAN_ORDER, JSON.stringify(daftarOrder));
  } catch {
    // Kuota penuh atau mode privat: biarkan saja. Ini bukan error fatal.
  }
}

/**
 * Menambah satu order ke daftar order aktif.
 *
 * Input: id order yang baru dibuat, dan nama customer yang dipakai.
 * Output: void.
 *
 * Kalau order dengan id yang sama sudah ada, namanya diperbarui dan tidak
 * ditambah dua kali.
 */
export function tambahOrderAktif(
  orderId: string,
  customerName: string,
  penyimpanan: PenyimpananSederhana | null = ambilPenyimpanan(),
): void {
  const daftar = bacaOrderAktif(penyimpanan);

  const sudahAda = daftar.some((satuOrder) => satuOrder.orderId === orderId);

  if (sudahAda) {
    // Sudah ada: cukup perbarui namanya kalau berubah, jangan tambah lagi.
    if (daftar.some((satuOrder) => satuOrder.orderId === orderId && satuOrder.customerName !== customerName)) {
      tulisOrderAktif(
        daftar.map((satuOrder) =>
          satuOrder.orderId === orderId ? { orderId: orderId, customerName: customerName } : satuOrder,
        ),
        penyimpanan,
      );
    }
    return;
  }

  tulisOrderAktif([...daftar, { orderId: orderId, customerName: customerName }], penyimpanan);
}

/**
 * Menghapus satu order dari daftar order aktif.
 *
 * Input: id order yang sudah selesai atau dibatalkan.
 * Output: void.
 *
 * Dipakai saat order mencapai status akhir, supaya membuka halaman awal tidak
 * lagi menawarkannya.
 */
export function buangOrderAktif(
  orderId: string,
  penyimpanan: PenyimpananSederhana | null = ambilPenyimpanan(),
): void {
  const daftar = bacaOrderAktif(penyimpanan);
  const daftarBaru = daftar.filter((satuOrder) => satuOrder.orderId !== orderId);

  // Kalau tidak ada yang berubah, jangan tulis ulang (hemat operasi).
  if (daftarBaru.length === daftar.length) {
    return;
  }

  tulisOrderAktif(daftarBaru, penyimpanan);
}

/**
 * Mengganti seluruh daftar order aktif sekaligus.
 *
 * Input: daftar order yang baru.
 * Output: void.
 *
 * Dipakai halaman awal setelah memeriksa status semua order yang tersimpan:
 * order yang sudah selesai, dibatalkan, atau tidak ditemukan dibuang, lalu
 * daftar yang tersisa ditulis ulang.
 */
export function gantiOrderAktif(
  daftarOrder: OrderTersimpan[],
  penyimpanan: PenyimpananSederhana | null = ambilPenyimpanan(),
): void {
  tulisOrderAktif(daftarOrder, penyimpanan);
}

/**
 * Mencari nama customer untuk satu order, dari daftar yang tersimpan.
 *
 * Input: id order.
 * Output: nama customer, atau string kosong kalau tidak ditemukan.
 */
export function cariNamaCustomer(
  orderId: string,
  penyimpanan: PenyimpananSederhana | null = ambilPenyimpanan(),
): string {
  const daftar = bacaOrderAktif(penyimpanan);
  const ditemukan = daftar.find((satuOrder) => satuOrder.orderId === orderId);
  return ditemukan ? ditemukan.customerName : "";
}