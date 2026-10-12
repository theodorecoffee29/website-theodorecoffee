// File ini: logika MURNI untuk alasan pembatalan pesanan oleh Cashier/Admin.
//
// Tanpa React, tanpa database, tanpa panggilan API, jadi bisa diuji langsung.
//
// Yang dikerjakan file ini:
//   1. Mengubah nilai alasan dari database menjadi teks yang tampil ke Cashier.
//   2. Mengubah daftar alasan menjadi daftar pilihan siap tampil di dialog.
//   3. Memeriksa apakah alasan yang dipilih beserta catatannya boleh dikirim.
//
// ATURANNYA (docs/order-flow.md bagian 6 acceptance criteria 22, dan bagian 7
// ayat 5):
//   - Alasan WAJIB dipilih. Tidak ada nilai bawaan, supaya Cashier benar-benar
//     memilih alasannya sendiri.
//   - Alasan "lainnya" WAJIB memakai catatan 1-100 karakter, karena alasan
//     yang tidak dikenal harus dijelaskan.
//   - Catatan untuk alasan lain boleh diisi atau tidak, maksimal 100 karakter.

import { ALASAN_BATAL, type AlasanBatal } from "@/lib/alasan-batal";
import { teksCashier } from "./teks";

// Bentuk satu alasan pembatalan, dipakai untuk merender pilihan di dialog.
export type PilihanAlasan = {
  // Nilai yang dikirim ke server (harus sama dengan nilai enum di database).
  nilai: AlasanBatal;
  // Teks yang tampil ke Cashier.
  label: string;
};

/**
 * Mengubah alasan dari database menjadi teks yang tampil.
 *
 * Input: nilai cancel_reason dari server (atau null).
 * Output: teks alasannya, atau null kalau tidak ada alasan.
 *
 * Kenapa null kalau kosong: untuk pesanan yang tidak dibatalkan, alasan memang
 * tidak ada. Kalau diubah jadi string kosong, tampilan akan menulis
 * "Dibatalkan: " tanpa isi, dan itu tidak bisa dibedakan dari alasan yang
 * benar-benar tidak terbaca.
 */
export function labelAlasanBatal(alasan: string | null): string | null {
  if (alasan === null) {
    return null;
  }

  // Alasan yang dikenal: pakai teks yang rapi dari teksCashier.
  const label = teksCashier.alasanBatal.label[alasan as AlasanBatal];
  if (typeof label === "string") {
    return label;
  }

  // Alasan yang tidak dikenal (mis. nilai baru di database tapi labelnya belum
  // ditambahkan). Nama aslinya ditampilkan supaya Cashier tetap punya
  // informasi, bukan melihat baris kosong.
  return alasan;
}

/**
 * Mengubah daftar alasan menjadi daftar pilihan siap tampil.
 *
 * Output: array { nilai, label } sesuai urutan yang ditampilkan di dialog.
 */
export function pilihanAlasanBatal(): PilihanAlasan[] {
  return ALASAN_BATAL.map((satu) => ({
    nilai: satu,
    // Label selalu ada karena daftar alasan dan daftar label dibuat bersamaan.
    label: teksCashier.alasanBatal.label[satu],
  }));
}

/**
 * Memeriksa apakah alasan dan catatannya boleh dikirim ke server.
 *
 * Input: alasan yang dipilih (atau null kalau belum memilih) dan catatan yang
 *        diketik (boleh teks apa pun, termasuk spasi saja).
 * Output: { boleh, pesan }.
 *
 * Kenapa mengembalikan pesan, bukan melempar error: komponen tampilan tinggal
 * menampilkan pesannya tanpa try/catch.
 */
export function periksaAlasanBatal(
  alasan: AlasanBatal | null,
  catatan: string,
): { boleh: boolean; pesan: string | null } {
  // Belum memilih alasan: tombol "Ya, batalkan" tetap nonaktif.
  if (alasan === null) {
    return { boleh: false, pesan: teksCashier.alasanBatal.pesanPilihDulu };
  }

  // Catatan dipangkas spasi pinggir, sama seperti aturan server. Catatan yang
  // cuma spasi dianggap tidak ada.
  const catatanBersih = catatan.trim();

  if (catatanBersih.length > 100) {
    return { boleh: false, pesan: teksCashier.alasanBatal.pesanCatatanMaks };
  }

  // "Lainnya" tanpa catatan tidak menjelaskan apa pun.
  if (alasan === "lainnya" && catatanBersih === "") {
    return { boleh: false, pesan: teksCashier.alasanBatal.pesanCatatanWajib };
  }

  return { boleh: true, pesan: null };
}
