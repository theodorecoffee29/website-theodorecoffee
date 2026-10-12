// File ini: mengubah hasil fungsi database get_stock_overview menjadi bentuk
// kontrak yang dikirim ke browser (camelCase), sesuai
// docs/api-contract.md bagian 4.
//
// Kenapa perlu pemetaan di server (bukan di browser):
//   1. Bentuk balasan API harus dijamin sama di semua route, seperti yang
//      sudah dilakukan di petakan-hasil-fungsi.ts.
//   2. Angka dari kolom numeric PostgreSQL bisa datang sebagai TEKS
//      (mis. "5000.000" atau "-12.500"). Kalau teks itu dipakai di
//      perhitungan JavaScript, hasilnya salah diam-diam. Karena itu semua
//      angka wajib lewat ubahKeAngka dari src/lib/server/ubah-ke-angka.ts
//      (pemetaan tidak mengarang fungsi baru).
//
// File ini MURNI (tanpa database dan tanpa Supabase), jadi bisa diuji langsung.
//
// CATATAN PENTING SOAL portionsLeft:
//   portionsLeft bernilai null untuk menu tanpa resep. Null HARUS tetap null
//   dan tidak boleh diubah jadi 0. Null berarti "tidak bisa dihitung" (tidak
//   ada bahan), sedangkan 0 berarti "sudah habis". Kalau keduanya jadi 0,
//   Cashier akan melihat menu tanpa resep sebagai menu yang habis.
//
// CATATAN SOAL KEAMANAN:
//   Layar Barista tidak boleh melihat harga dan pembayaran
//   (docs/pemissions.md bagian 2). Isi file ini karena itu tidak punya kolom
//   harga, total, maupun pembayaran sama sekali: kalau nanti ada yang ditambah,
//   panel ini akan otomatis membocorkan ke Barista.

import { ubahKeAngka } from "./ubah-ke-angka";

// Peran yang boleh memakai endpoint sisa stok (GET /api/staff/stock).
//
// Cashier perlu tahu sisa porsi untuk memilih order mana yang diterima kalau
// dua order bersaing untuk stok terakhir, Barista perlu tahu sisa bahan untuk
// menyiapkan pesanan, dan Admin boleh semuanya
// (docs/pemissions.md bagian 2). Customer tidak termasuk di sini.
export const PERAN_SISA_STOK = ["cashier", "barista", "admin"] as const;

// Satu menu beserta sisa porsinya, dari get_stock_overview.
export type MenuSisaStok = {
  menuItemId: string;
  name: string;
  // Sisa porsi, bilangan bulat 0 atau lebih. null kalau menu tanpa resep.
  portionsLeft: number | null;
};

// Satu bahan beserta sisa stoknya, dari get_stock_overview.
export type BahanSisaStok = {
  ingredientId: string;
  name: string;
  // Satuan dari database: "g", "ml", atau "pcs".
  unit: string;
  // Stok saat ini. BOLEH negatif (docs/data-model.md aturan 4), jadi tipe
  // angkanya bukan nilai yang selalu positif.
  stockQty: number;
  // true kalau stoknya di bawah 0, supaya tampilan bisa menandai dengan jelas.
  isNegative: boolean;
};

// Bentuk balasan GET /api/staff/stok (docs/api-contract.md bagian 4).
export type HasilSisaStok = {
  menus: MenuSisaStok[];
  ingredients: BahanSisaStok[];
};

/**
 * Mengubah hasil get_stock_overview menjadi bentuk kontrak.
 *
 * Input: data apa pun hasil pemanggilan fungsi get_stock_overview.
 * Output: HasilSisaStok.
 *
 * Data yang bentuknya tidak sesuai (bukan objek, array hilang, entri bukan
 * objek) diubah menjadi daftar kosong atau nilai netral, BUKAN error. Alasannya:
 * panel sisa stok adalah informasi tambahan yang hanya dibaca, jadi lebih baik
 * menampilkan panel kosong daripada membuat halaman Cashier/Barista error.
 */
export function petakanSisaStok(data: unknown): HasilSisaStok {
  const kolom = jadiObjek(data);

  return {
    menus: petakanMenu(jadiTeksDari(kolom.menus)),
    ingredients: petakanBahan(jadiTeksDari(kolom.ingredients)),
  };
}

/**
 * Mengubah daftar menu dari database.
 *
 * Input: apa pun yang diterima dari server.
 * Output: array MenuSisaStok.
 */
function petakanMenu(mentah: unknown): MenuSisaStok[] {
  const daftar = keArray(mentah);
  const hasil: MenuSisaStok[] = [];

  for (const satuMentah of daftar) {
    const satu = jadiObjek(satuMentah);

    // Nama wajib ada. Menu tanpa nama tidak berguna untuk Cashier, dan
    // menampilkan baris kosong hanya membingungkan.
    const nama = ambilTeks(satu, "name");
    if (nama === "") {
      continue;
    }

    hasil.push({
      menuItemId: ambilTeks(satu, "menuItemId", "menu_item_id"),
      name: nama,
      // null (menu tanpa resep) HARUS tetap null. Lihat catatan di atas file.
      portionsLeft: bacaPorsi(satu),
    });
  }

  return hasil;
}

/**
 * Membaca sisa porsi satu menu.
 *
 * Input: satu objek menu dari database.
 * Output: angka 0 atau lebih, atau null kalau tidak ada / tidak bisa dibaca.
 *
 * Kenapa tidak memakai nilai cadangan 0: 0 berarti "habis", sedangkan null
 * berarti "tidak bisa dihitung". Dua hal itu beda maknanya, jadi di sini tidak
 * ada nilai cadangan.
 */
function bacaPorsi(satu: Record<string, unknown>): number | null {
  const mentah =
    satu.portionsLeft !== undefined ? satu.portionsLeft : satu.portions_left;

  // Tidak ada kunci sama sekali, atau null dari database: berarti menu tanpa
  // resep (atau server tidak mengirimnya).
  if (mentah === null || mentah === undefined) {
    return null;
  }

  // Angka dari database bisa teks ("277") atau sudah angka (277).
  if (typeof mentah === "number") {
    return Number.isFinite(mentah) ? Math.floor(mentah) : null;
  }

  if (typeof mentah === "string" && mentah.trim() !== "") {
    const angka = Number(mentah);
    return Number.isFinite(angka) ? Math.floor(angka) : null;
  }

  return null;
}

/**
 * Mengubah daftar bahan dari database.
 *
 * Input: apa pun yang diterima dari server.
 * Output: array BahanSisaStok.
 */
function petakanBahan(mentah: unknown): BahanSisaStok[] {
  const daftar = keArray(mentah);
  const hasil: BahanSisaStok[] = [];

  for (const satuMentah of daftar) {
    const satu = jadiObjek(satuMentah);

    const nama = ambilTeks(satu, "name");
    if (nama === "") {
      continue;
    }

    // Stok boleh minus, jadi angka negatif harus diteruskan apa adanya. Nilai
    // cadangan 0 dipakai kalau angkanya benar-benar tidak terbaca.
    const stok = ubahKeAngka(
      satu.stockQty !== undefined ? satu.stockQty : satu.stock_qty,
      0,
    );

    hasil.push({
      ingredientId: ambilTeks(satu, "ingredientId", "ingredient_id"),
      name: nama,
      unit: ambilTeks(satu, "unit"),
      stockQty: stok,
      // isNegative dihitung ulang dari stoknya, bukan hanya dibaca dari server.
      // Alasannya: kalau field itu hilang atau berubah bentuk, tanda minusnya
      // hilang dari tampilan padahal stoknya memang minus.
      isNegative: stok < 0,
    });
  }

  return hasil;
}

// ---------------------------------------------------------------------------
// Helper internal
// ---------------------------------------------------------------------------

/** Mengubah data apa pun menjadi objek yang bisa dibaca dengan aman. */
function jadiObjek(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return {};
}

/** Mengubah apa pun menjadi array. Hasil lain dianggap daftar kosong. */
function keArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

/**
 * Membaca nilai pertama yang ada dari beberapa nama kunci.
 *
 * Input: objek dan daftar nama kunci (camelCase lalu snake_case).
 * Output: teks dari kunci pertama yang ditemukan.
 *
 * Kenapa menerima dua nama: fungsi database ditulis dengan camelCase, tapi
 * route lain di project ini memakai snake_case. supaya pemetaan ini tahan kalau
 * salah satunya berubah tanpa merusak panel.
 */
function ambilTeks(
  satu: Record<string, unknown>,
  ...namaKunci: string[]
): string {
  for (const kunci of namaKunci) {
    const nilai = satu[kunci];
    if (typeof nilai === "string") {
      return nilai;
    }
  }
  return "";
}

/**
 * Mengubah nilai apa pun menjadi teks (dipakai saat memanggil keArray).
 *
 * Kenapa perlu: kolom jsonb yang berisi array akan sampai di browser sebagai
 * teks '{"menuItemId":"..."}' kalau PostgREST menyalinnya apa adanya. Fungsi
 * ini melepas satu lapis JSON supaya daftar di dalamnya terbaca.
 */
function jadiTeksDari(nilai: unknown): unknown {
  if (typeof nilai === "string") {
    const teks = nilai.trim();
    if (teks.startsWith("[") || teks.startsWith("{")) {
      try {
        return JSON.parse(teks) as unknown;
      } catch {
        // Bukan JSON yang bisa dibaca: kembalikan apa adanya supaya
        // keArray() mengubahnya menjadi daftar kosong, bukan error.
        return [];
      }
    }
  }
  return nilai;
}
