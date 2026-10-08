// File ini: mendeteksi pesanan baru yang muncul di antara dua hasil polling.
//
// Kenapa perlu: halaman Cashier mengambil daftar pesanan tiap 3 detik
// (docs/api-contract.md bagian 5). Notifikasi "Pesanan baru dari Budi" hanya
// boleh muncul untuk pesanan yang MASIH BARU terlihat, bukan untuk semua pesanan
// menunggu yang ada saat halaman dibuka. Kalau tidak, Cashier akan melihat
// spanduk untuk pesanan yang sudah lama menunggu setiap kali halaman di-refresh.
//
// File ini MURNI (tanpa React dan tanpa API), jadi mudah diuji.

// Bentuk minimum pesanan yang dipakai di file ini.
export type PesananPantau = {
  orderId: string;
  customerName: string;
  status: string;
};

// Status pesanan yang dianggap "baru harus dikonfirmasi Cashier".
const STATUS_MENUNGGU = "menunggu_konfirmasi";

/**
 * Mencari pesanan menunggu_konfirmasi yang belum pernah terlihat sebelumnya.
 *
 * Input:
 *   - sebelumnya: daftar pesanan dari hasil polling sebelumnya,
 *   - sekarang: daftar pesanan dari hasil polling yang baru saja diterima,
 *   - sudahPernahMuat: true kalau daftar sebelumnya BUKAN pemuatan pertama.
 * Output: daftar pesanan yang ADA di "sekarang" tapi TIDAK ada di "sebelumnya".
 *         Urutannya mengikuti "sekarang" (biasanya sudah diurut server).
 *
 * Rules:
 *   1. Hanya pesanan berstatus menunggu_konfirmasi yang dianggap baru. Pesanan
 *      yang sudah dikonfirmasi atau sudah selesai tidak perlu notifikasi.
 *   2. Pemuatan pertama TIDAK memicu notifikasi. Cashier sudah melihat pesanan
 *      itu di layarnya, jadi bukan "baru".
 *
 * Kenapa perlu parameter sudahPernahMuat: daftar kosong belum tentu berarti
 * pemuatan pertama. Kalau polling sempat gagal, daftar sebelumnya bisa kosong
 * sementara halamannya sudah terbuka lama. Tanpa parameter ini, semua pesanan
 * akan dianggap baru begitu koneksi pulih, dan spanduk akan menyala terus.
 *
 * Kenapa memakai orderId sebagai pembeda: orderId adalah uuid yang unik dan
 * tidak pernah berubah, sedangkan nomor antrean selalu berulang tiap hari.
 */
export function cariPesananBaru(
  sebelumnya: PesananPantau[],
  sekarang: PesananPantau[],
  sudahPernahMuat: boolean,
): PesananPantau[] {
  // Pemuatan pertama: tidak ada notifikasi apa pun.
  if (!sudahPernahMuat) {
    return [];
  }

  // Kumpulan id yang sudah pernah terlihat.
  const idYangSudahTerlihat = new Set<string>();
  for (const satu of sebelumnya) {
    idYangSudahTerlihat.add(satu.orderId);
  }

  const hasil: PesananPantau[] = [];
  for (const satu of sekarang) {
    // Hanya yang menunggu konfirmasi, dan belum pernah terlihat.
    if (
      satu.status === STATUS_MENUNGGU &&
      !idYangSudahTerlihat.has(satu.orderId)
    ) {
      hasil.push(satu);
    }
  }

  return hasil;
}

/**
 * Menghitung berapa pesanan yang masih menunggu konfirmasi.
 *
 * Input: daftar pesanan.
 * Output: jumlahnya.
 *
 * Dipakai untuk judul tab browser, misal "(2) Cashier" kalau ada dua pesanan
 * menunggu.
 */
export function hitungPesananMenunggu(pesanan: PesananPantau[]): number {
  let jumlah = 0;
  for (const satu of pesanan) {
    if (satu.status === STATUS_MENUNGGU) {
      jumlah += 1;
    }
  }
  return jumlah;
}

/**
 * Menentukan isi spanduk notifikasi pesanan baru.
 *
 * Input: daftar pesanan baru dari cariPesananBaru (boleh kosong).
 * Output: teks spanduk, atau null kalau tidak ada pesanan baru (artinya
 *         spanduk tidak boleh tampil).
 *
 * Contoh:
 *   satu pesanan baru -> "Pesanan baru dari Budi"
 *   tiga pesanan baru -> "3 pesanan baru"
 *   tidak ada         -> null
 *
 * Kenapa tidak menyebut nama kalau banyak: nama pertama saja yang tampil, tapi
 * supaya tidak menyesatkan Cashier (yang tahu ada beberapa), kalimatnya jadi
 * bentuk jamak.
 */
export function teksSpandukBaru(
  pesananBaru: PesananPantau[],
  teks: {
    satu: string;
    banyak: string;
  },
): string | null {
  if (pesananBaru.length === 0) {
    return null;
  }

  if (pesananBaru.length === 1) {
    return teks.satu.replace("{nama}", pesananBaru[0].customerName);
  }

  return teks.banyak.replace("{jumlah}", String(pesananBaru.length));
}
