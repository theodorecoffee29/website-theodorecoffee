// File ini: perhitungan kecil untuk halaman Stok Admin, dan pemetaan label jenis
// pergerakan stok.
//
// Yang dikerjakan file ini:
//   1. Menghitung perkiraan stok sesudah restock (stok sekarang + jumlah).
//   2. Menghitung selisih koreksi (jumlah hasil hitung fisik - stok sekarang).
//   3. Memetakan jenis pergerakan stok menjadi label ramah.
//   4. Menandai stok yang minus.
//
// Kenapa file ini terpisah dari hook: perhitungan ini adalah keputusan layar yang
// harus benar, dan jauh lebih mudah diuji di sini daripada lewat klik.
//
// File ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.

import { formatAngkaIndonesia, formatPerubahan } from "./angka";
import { teksStokAdmin } from "./teks";

// -----------------------------------------------------------------------------
// Perhitungan stok
// -----------------------------------------------------------------------------

/**
 * Menghitung perkiraan stok sesudah menambah stok (restock).
 *
 * Input: stok sekarang, dan jumlah yang ditambahkan.
 * Output: perkiraan stok sesudahnya (angka).
 *
 * Restock selalu menambah, jadi hasilnya tidak mungkin lebih kecil dari stok
 * sekarang. Ini yang ditampilkan di dialog konfirmasi, supaya Admin tahu
 * hasilnya sebelum menyetujui.
 */
export function perkiraanStokSesudah(
  stokSekarang: number,
  jumlahTambah: number,
): number {
  return stokSekarang + jumlahTambah;
}

/**
 * Menghitung selisih koreksi stok.
 *
 * Input: stok sekarang, dan jumlah hasil hitung fisik yang baru.
 * Output: selisihnya (angka, bisa positif atau negatif).
 *
 * Contoh:
 *   stok sekarang 7000, hasil hitung 6500  -> selisih -500 (dikurangi)
 *   stok sekarang 6500, hasil hitung 7000  -> selisih +500 (ditambah)
 *   stok sekarang 6500, hasil hitung 6500  -> selisih 0 (tidak berubah)
 *
 * Penting: selisih inilah yang dihitung server dan dicatat sebagai pergerakan
 * bertipe adjustment, jadi nilai yang ditampilkan Admin harus sama dengan yang
 * akan tercatat.
 */
export function hitungSelisihKoreksi(
  stokSekarang: number,
  jumlahFisikBaru: number,
): number {
  return jumlahFisikBaru - stokSekarang;
}

/**
 * Menandai apakah stoknya minus (perlu dikoreksi).
 *
 * Input: stok sekarang.
 * Output: true kalau stoknya di bawah 0.
 *
 * Kenapa perlu penanda: kolom stock_qty tidak punya batasan nol
 * (docs/data-model.md aturan 4), jadi stok minus itu sah terjadi. Admin perlu
 * melihatnya jelas supaya tahu bahan mana yang harus dikoreksi lewat koreksi
 * stok.
 *
 * Nol TIDAK dianggap minus: 0 berarti habis, bukan kurang.
 */
export function stokMinus(stok: number): boolean {
  return stok < 0;
}

// -----------------------------------------------------------------------------
// Pemetaan label jenis pergerakan
// -----------------------------------------------------------------------------

/**
 * Mengubah jenis pergerakan dari database menjadi label ramah.
 *
 * Input: nilai kolom type dari stock_movements.
 * Output: teks yang tampil ke Admin.
 *
 * Pemetaan (docs/data-model.md tabel stock_movements):
 *   - order_confirm       -> stok berkurang karena pesanan dikonfirmasi,
 *   - order_cancel_restore -> stok bertambah kembali karena pesanan dibatalkan,
 *   - restock             -> stok ditambahkan Admin,
 *   - adjustment          -> stok dikoreksi Admin ke hasil hitung fisik.
 *
 * Jenis yang tidak dikenal mendapat teks cadangan, supaya tampilan tidak kosong
 * kalau nanti ada jenis baru.
 */
export function labelJenisPergerakan(type: string): string {
  switch (type) {
    case "order_confirm":
      return teksStokAdmin.riwayat.jenis.order_confirm;
    case "order_cancel_restore":
      return teksStokAdmin.riwayat.jenis.order_cancel_restore;
    case "restock":
      return teksStokAdmin.riwayat.jenis.restock;
    case "adjustment":
      return teksStokAdmin.riwayat.jenis.adjustment;
    default:
      return teksStokAdmin.riwayat.jenis.tidakDiketahui;
  }
}

// -----------------------------------------------------------------------------
// Baris riwayat siap tampil
// -----------------------------------------------------------------------------

// Bentuk baris riwayat yang siap ditampilkan.
export type RiwayatTampil = {
  movementId: string;
  // Waktu dalam WIB (sudah berupa teks jam, misal "09.15").
  waktuTeks: string;
  // Label ramah jenis pergerakan, misal "Restock".
  jenisTeks: string;
  // Perubahan stok dengan tanda, misal "+2.000" atau "-20".
  perubahanTeks: string;
  // Stok sesudah perubahan, misal "5.000".
  stokSesudahTeks: string;
  // Catatan, atau null kalau tidak ada.
  catatan: string | null;
  // 8 karakter pertama id order kalau berasal dari order, atau null kalau
  // berasal dari restock atau koreksi (yang dilakukan manual).
  orderIdPendek: string | null;
};

/**
 * Mengubah baris pergerakan dari server menjadi bentuk siap tampil.
 *
 * Input: satu baris dari GET /api/admin/ingredients/[id]/movements.
 * Output: RiwayatTampil.
 *
 * Yang diproses di sini:
 *   - waktu timestamptz dari database diubah menjadi jam WIB,
 *   - jenis pergerakan diubah menjadi label ramah,
 *   - perubahan diberi tanda + atau -,
 *   - id order dipotong jadi 8 karakter pertama (supaya tidak memenuhi layar
 *     dan Admin tetap bisa mencarinya di halaman pesanan).
 */
export function petakanRiwayat(
  baris: PergerakanDariServer,
  ubahWaktu: (waktu: string) => string,
): RiwayatTampil {
  return {
    movementId: baris.movementId,
    waktuTeks: ubahWaktu(baris.createdAt),
    jenisTeks: labelJenisPergerakan(baris.type),
    perubahanTeks: formatPerubahan(baris.qtyChange),
    stokSesudahTeks: formatAngkaIndonesia(baris.stockAfter),
    catatan: baris.note,
    // 8 karakter pertama id order, atau null kalau tidak ada.
    orderIdPendek:
      baris.orderId !== null && baris.orderId !== ""
        ? baris.orderId.slice(0, 8)
        : null,
  };
}

// Bentuk baris pergerakan dari server (yang dipakai petakanRiwayat).
type PergerakanDariServer = {
  movementId: string;
  type: string;
  qtyChange: number;
  stockAfter: number;
  createdAt: string;
  orderId: string | null;
  note: string | null;
};
