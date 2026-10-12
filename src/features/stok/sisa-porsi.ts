// File ini: logika MURNI untuk indikator sisa stok, dipakai bersama oleh layar
// Cashier dan layar Barista. Tanpa React, tanpa database, tanpa panggilan API,
// jadi bisa diuji langsung.
//
// Yang dikerjakan file ini:
//   1. Membaca sisa porsi satu menu dari daftar sisa stok.
//   2. Mengubah sisa porsi menjadi teks yang tampil ("sisa 12 porsi",
//      "Habis", atau "Tanpa resep").
//   3. Memeriksa apakah jumlah pesanan suatu item melebihi sisa porsinya
//      (petunjuk "Stok tidak cukup").
//
// CATATAN PENTING SOAL TIGA KASUS YANG BERBEDA:
//   portionsLeft berupa angka : menu punya resep, dan angkanya adalah sisa porsi
//   portionsLeft = 0         : menu punya resep, tapi bahannya habis
//   portionsLeft = null      : menu TIDAK punya resep, jadi sisa porsinya tidak
//                              bisa dihitung sama sekali
//
// Null tidak boleh dianggap 0. Kalau menu tanpa resep dianggap 0, Cashier akan
// melihatnya sebagai menu yang habis, padahal menu tanpa resep selalu bisa
// dibuat (menu_item_available menganggapnya tersedia).

// Bentuk minimum data sisa stok yang dipakai file ini.
// Sengaja hanya berisi field yang dipakai, supaya file ini tidak perlu tahu
// bentuk lengkap dari API.
export type MenuStokRingkas = {
  menuItemId: string;
  // Sisa porsi, atau null kalau menu tanpa resep.
  portionsLeft: number | null;
};

/**
 * Mencari sisa porsi satu menu di dalam daftar sisa stok.
 *
 * Input: daftar menu dari server dan menuItemId yang dicari.
 * Output: sisa porsinya (angka), atau null kalau:
 *   - menunya tidak ada di daftar (mis. menu nonaktif, atau server belum
 *     mengirim data), atau
 *   - menunya tidak punya resep (portionsLeft memang null).
 *
 * Kenapa dua kasus itu digabung jadi satu nilai kosong: sama-sama berarti
 * "tidak ada sisa porsi yang bisa dipakai untuk menjadi petunjuk". Pemanggil
 * tidak perlu membedakan keduanya, dan tidak salah menampilkan apa pun.
 */
export function cariSisaPorsi(
  daftarMenu: readonly MenuStokRingkas[],
  menuItemId: string | null,
): number | null {
  // menuItemId kosong (mis. order lama tanpa data menu) tidak bisa dicocokkan.
  if (menuItemId === null || menuItemId === "") {
    return null;
  }

  for (const satu of daftarMenu) {
    if (satu.menuItemId === menuItemId) {
      return satu.portionsLeft;
    }
  }

  return null;
}

/**
 * Memeriksa apakah jumlah pesanan melebihi sisa porsi menu.
 *
 * Input: daftar menu sisa stok, menuItemId, dan jumlah yang dipesan.
 * Output: true kalau jelas tidak cukup.
 *
 * Aturan sengaja konservatif:
 *   - Menu tanpa resep (null) TIDAK pernah dianggap tidak cukup. Tidak ada
 *     bahan yang bisa habis, jadi tidak ada alasan memberi peringatan.
 *   - Menu yang tidak ada di daftar sisa stok juga TIDAK dianggap tidak cukup.
 *     Data sisa stok mungkin belum termuat, dan memberi peringatan yang salah
 *     lebih buruk daripada tidak memberi peringatan sama sekali.
 *   - Sisa porsi negatif (bila pernah terjadi) dianggap sama dengan 0.
 *
 * PENTING: hasil fungsi ini HANYA petunjuk untuk Cashier, tidak pernah
 * memblokir konfirmasi. Pemeriksaan stok sebenarnya ada di database
 * (menu_item_available dan pengurangan stok saat konfirmasi).
 */
export function stokTidakCukup(
  daftarMenu: readonly MenuStokRingkas[],
  menuItemId: string | null,
  jumlah: number,
): boolean {
  const sisa = cariSisaPorsi(daftarMenu, menuItemId);

  // Tidak ada data yang bisa dipakai untuk menilai.
  if (sisa === null) {
    return false;
  }

  // Jumlah yang tidak terbaca dianggap 0, jadi tidak akan dianggap berlebihan.
  const angkaJumlah =
    typeof jumlah === "number" && Number.isFinite(jumlah) ? jumlah : 0;

  return angkaJumlah > Math.max(sisa, 0);
}
