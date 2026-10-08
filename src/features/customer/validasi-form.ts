// File ini: validasi form pesan di sisi browser dan penghitung total.
//
// Kenapa validasi ganda: server sudah memvalidasi semuanya (wajib, karena harga
// dan aturan bisnis dihitung di server). Tapi memeriksa dulu di browser membuat
// pesan error langsung muncul tanpa menunggu bolak-balik ke server, dan tombol
// kirim bisa dinonaktifkan lebih awal. Aturan yang dipakai DISINI harus sama
// dengan di server (docs/api-contract.md bagian 2).
//
// PENTING: total yang dihitung di sini HANYA untuk ditampilkan ke pengguna
// sebagai perkiraan. Harga yang sebenarnya selalu dihitung ulang di server dari
// menu_items, jadi angka di layar tidak pernah dipakai untuk menghitung
// pembayaran.
//
// File ini MURNI (tanpa server), jadi bisa diuji langsung.

// Batas jumlah per item (docs/api-contract.md bagian 2: bilangan bulat 1-99).
export const MAKSIMAL_QTY = 99;

// Batas panjang catatan (100 karakter).
export const MAKSIMAL_CATATAN = 100;

// Batas panjang nama customer (50 karakter).
export const MAKSIMAL_NAMA = 50;

// Hasil pemeriksaan nama customer.
export type HasilValidasiNama = { valid: boolean; pesan: string | null };

/**
 * Memeriksa nama customer.
 *
 * Input: nama yang diketik pengguna (boleh kosong).
 * Output: HasilValidasiNama. "pesan" adalah teks yang tampil kalau tidak valid.
 *
 * Aturan (setelah spasi pinggir dipangkas): wajib, maksimal 50 karakter.
 */
export function validasiNama(
  nama: string,
  pesan: {
    wajib: string;
    maks: string;
  },
): HasilValidasiNama {
  const namaBersih = nama.trim();

  if (namaBersih.length === 0) {
    return { valid: false, pesan: pesan.wajib };
  }

  if (namaBersih.length > MAKSIMAL_NAMA) {
    return { valid: false, pesan: pesan.maks };
  }

  return { valid: true, pesan: null };
}

// Hasil pemeriksaan satu item pesanan.
export type HasilValidasiItem = { valid: boolean; pesan: string | null };

/**
 * Memeriksa jumlah (qty) yang diketik untuk satu menu.
 *
 * Input: qty sebagai teks dari isian (bisa kosong, yang berarti 0).
 * Output: HasilValidasiItem.
 *
 * Aturan: bilangan bulat antara 0 sampai 99. Angka 0 berarti menu itu tidak
 * dipilih (jadi boleh, dan tidak dihitung sebagai item).
 */
export function validasiQty(
  qtyTeks: string,
  pesanMaks: string,
): HasilValidasiItem {
  // Isian kosong dianggap 0 (menu tidak dipilih).
  if (qtyTeks.trim() === "") {
    return { valid: true, pesan: null };
  }

  // Harus berupa bilangan bulat (tanpa desimal, tanpa huruf).
  if (!/^[0-9]+$/.test(qtyTeks.trim())) {
    return { valid: false, pesan: pesanMaks };
  }

  const qty = Number(qtyTeks.trim());
  if (qty > MAKSIMAL_QTY) {
    return { valid: false, pesan: pesanMaks };
  }

  return { valid: true, pesan: null };
}

/**
 * Memeriksa catatan satu item.
 *
 * Input: catatan yang diketik (boleh kosong).
 * Output: HasilValidasiItem.
 *
 * Aturan: opsional, maksimal 100 karakter.
 */
export function validasiCatatan(
  catatan: string,
  pesanMaks: string,
): HasilValidasiItem {
  if (catatan.length > MAKSIMAL_CATATAN) {
    return { valid: false, pesan: pesanMaks };
  }
  return { valid: true, pesan: null };
}

// Bentuk satu baris item yang dipakai form (masih berupa teks dari isian).
export type BarisPesanan = {
  menuItemId: string;
  qty: string;
  note: string;
};

/**
 * Menghitung total perkiraan dari baris pesanan dan daftar menu.
 *
 * Input: baris pesanan (qty masih teks) dan daftar menu (harga dan id).
 * Output: jumlah rupiah (angka bulat).
 *
 * Cara kerja: untuk tiap baris, cari harga menunya di daftar menu, lalu
 * kalikan dengan qty-nya. Baris dengan qty 0 atau menu yang tidak ditemukan
 * diabaikan. Catatan TIDAK berpengaruh ke total.
 *
 * Kenapa diabaikan menu yang tidak ditemukan: kalau menu hilang dari daftar
 * (mis. dinonaktifkan), barisnya tidak bisa dihitung dan tidak perlu
 * menggagalkan tampilan total.
 */
export function hitungTotal(
  barisPesanan: BarisPesanan[],
  daftarMenu: { id: string; price: number }[],
): number {
  let total = 0;

  for (const satuBaris of barisPesanan) {
    const qty = Number(satuBaris.qty.trim());
    // Abaikan yang qty-nya bukan angka positif (mis. 0 atau kosong).
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const menu = daftarMenu.find(
      (satuMenu) => satuMenu.id === satuBaris.menuItemId,
    );
    if (!menu) {
      continue;
    }

    total += menu.price * qty;
  }

  return total;
}

/**
 * Mengubah baris pesanan menjadi daftar item yang siap dikirim ke server.
 *
 * Input: baris pesanan (qty berupa teks).
 * Output: array { menuItemId, qty, note? } HANYA untuk baris yang qty-nya lebih
 *         dari 0, karena baris lain tidak akan dikirim.
 *
 * Catatan yang kosong TIDAK ikut dikirim (server memperlakukan catatan kosong
 * sama saja dengan tidak ada catatan).
 */
export function menjadiItemSiapKirim(
  barisPesanan: BarisPesanan[],
): { menuItemId: string; qty: number; note?: string }[] {
  const hasil: { menuItemId: string; qty: number; note?: string }[] = [];

  for (const satuBaris of barisPesanan) {
    const qty = Number(satuBaris.qty.trim());
    if (!Number.isFinite(qty) || qty <= 0) {
      // qty 0 atau tidak valid: tidak dikirim.
      continue;
    }

    const catatan = satuBaris.note.trim();
    hasil.push({
      menuItemId: satuBaris.menuItemId,
      qty: qty,
      // Hanya kirim note kalau ada isinya.
      ...(catatan.length > 0 ? { note: catatan } : {}),
    });
  }

  return hasil;
}

/**
 * Memeriksa apakah tombol kirim boleh ditekan.
 *
 * Input: nama customer dan baris pesanan.
 * Output: true kalau nama valid dan ada minimal satu item dengan qty lebih dari 0.
 *
 * Kenapa perlu: supaya pengguna tidak bisa mengirim order kosong.
 */
export function bolehKirim(
  nama: string,
  barisPesanan: BarisPesanan[],
  pesan: { nama: { wajib: string; maks: string }; item: string },
): boolean {
  if (!validasiNama(nama, pesan.nama).valid) {
    return false;
  }

  const jumlahItemTerpilih = menjadiItemSiapKirim(barisPesanan).length;
  return jumlahItemTerpilih > 0;
}
