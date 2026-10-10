// File ini: mengubah data resep dari server menjadi teks ringkasan yang tampil di
// daftar menu.
//
// Kenapa perlu: di daftar menu, setiap menu hanya butuh satu kalimat ringkas
// tentang resepnya (misal "3 bahan"), bukan daftar lengkap. Hitungan ini harus
// ada di satu tempat supaya tidak berbeda antar tampilan.
//
// File ini MURNI (tanpa React dan tanpa database), jadi bisa diuji langsung.

import type { BarisResepTampil } from "@/lib/server/petakan-admin";
import { teksMenuAdmin } from "./teks";

/**
 * Mengubah daftar baris resep menjadi kalimat ringkasan.
 *
 * Input: baris resep sebuah menu (boleh kosong).
 * Output: teks ringkasan.
 *
 * Contoh:
 *   0 baris  -> "Belum ada resep"
 *   1 baris  -> "1 bahan"
 *   3 baris  -> "3 bahan"
 *
 * Perhatikan: yang dihitung adalah JUMLAH BAHAN, bukan jumlah total takaran.
 * Resep kosong memakai kalimat sendiri, karena "0 bahan" membingungkan (bahan
 * memang tidak ada, bukan banyakannya nol).
 */
export function ringkasResep(resep: BarisResepTampil[]): string {
  if (resep.length === 0) {
    return teksMenuAdmin.daftarMenu.belumAdaResep;
  }

  if (resep.length === 1) {
    return teksMenuAdmin.daftarMenu.satuBahan;
  }

  return teksMenuAdmin.daftarMenu.jumlahBahan.replace(
    "{jumlah}",
    String(resep.length),
  );
}
