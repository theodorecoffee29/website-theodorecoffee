// File ini: logika form order manual di sisi browser (tanpa React, tanpa API).
//
// Yang dikerjakan file ini:
//   1. Memeriksa nama customer (wajib, maksimal 50 karakter).
//   2. Memeriksa isian jumlah tiap menu (0 sampai 99, bilangan bulat).
//   3. Memeriksa catatan tiap menu (maksimal 100 karakter).
//   4. Menghitung total untuk ditampilkan (ANGKA ASLI DIHITUNG SERVER).
//   5. Menentukan kapan tombol "Periksa dan simpan" boleh ditekan.
//
// Kenapa validasi ganda: server sudah memvalidasi semuanya (wajib, karena aturan
// bisnis dan harga dihitung di server). Tapi memeriksa di browser membuat pesan
// muncul langsung tanpa menunggu bolak-balik ke server, dan tombol bisa
// dinonaktifkan lebih awal. Aturan yang dipakai DISINI harus sama dengan di
// server (docs/api-contract.md bagian 2).
//
// PENTING: total yang dihitung di sini HANYA untuk ditampilkan sebagai
// perkiraan. Harga yang sebenarnya selalu dihitung ulang di server dari
// menu_items (docs/api-contract.md bagian 2), jadi angka di layar tidak pernah
// dipakai untuk menghitung pembayaran.
//
// File ini MURNI (tanpa server), jadi bisa diuji langsung.

// Batas jumlah per menu (docs/api-contract.md bagian 2: bilangan bulat 1-99).
// Di form, 0 berarti menu itu tidak dipilih, jadi 0 juga boleh di sini.
export const MAKSIMAL_QTY = 99;

// Batas panjang catatan per item (100 karakter).
export const MAKSIMAL_CATATAN = 100;

// Batas panjang nama customer (50 karakter).
export const MAKSIMAL_NAMA = 50;

// Hasil pemeriksaan satu hal: valid atau tidak, plus pesan kalau tidak valid.
export type HasilPemeriksaan = { valid: boolean; pesan: string | null };

/**
 * Memeriksa nama customer.
 *
 * Input: nama yang diketik Cashier (boleh kosong).
 * Output: HasilPemeriksaan.
 *
 * Aturan (setelah spasi pinggir dipangkas): wajib, maksimal 50 karakter
 * (docs/api-contract.md bagian 2).
 */
export function periksaNama(
  nama: string,
  pesan: {
    wajib: string;
    maks: string;
  },
): HasilPemeriksaan {
  const namaBersih = nama.trim();

  if (namaBersih.length === 0) {
    return { valid: false, pesan: pesan.wajib };
  }

  if (namaBersih.length > MAKSIMAL_NAMA) {
    return { valid: false, pesan: pesan.maks };
  }

  return { valid: true, pesan: null };
}

/**
 * Memeriksa jumlah (qty) yang diketik untuk satu menu.
 *
 * Input: qty sebagai teks dari isian (boleh kosong).
 * Output: HasilPemeriksaan.
 *
 * Aturan: kosong berarti 0 (menu tidak dipilih, jadi boleh). Kalau diisi, harus
 * bilangan bulat dari 0 sampai 99 (docs/api-contract.md bagian 2).
 */
export function periksaQty(
  qtyTeks: string,
  pesanMaks: string,
): HasilPemeriksaan {
  const teks = qtyTeks.trim();

  // Isian kosong berarti 0, yaitu menu tidak dipilih.
  if (teks === "") {
    return { valid: true, pesan: null };
  }

  // Harus bilangan bulat: hanya angka, tanpa desimal, negatif, atau huruf.
  if (!/^[0-9]+$/.test(teks)) {
    return { valid: false, pesan: pesanMaks };
  }

  if (Number(teks) > MAKSIMAL_QTY) {
    return { valid: false, pesan: pesanMaks };
  }

  return { valid: true, pesan: null };
}

/**
 * Memeriksa catatan satu menu.
 *
 * Input: catatan yang diketik (boleh kosong).
 * Output: HasilPemeriksaan.
 *
 * Aturan: opsional, maksimal 100 karakter (docs/api-contract.md bagian 2).
 */
export function periksaCatatan(
  catatan: string,
  pesanMaks: string,
): HasilPemeriksaan {
  if (catatan.length > MAKSIMAL_CATATAN) {
    return { valid: false, pesan: pesanMaks };
  }

  return { valid: true, pesan: null };
}

// Satu baris isian untuk satu menu.
export type BarisForm = {
  menuItemId: string;
  // Jumlah masih berupa teks, karena datang dari isian <input>.
  qty: string;
  note: string;
};

// Batas jumlah baris item per order (docs/api-contract.md bagian 2: 1-20 baris).
export const MAKSIMAL_BARIS = 20;

/**
 * Memeriksa semua isian form sekaligus.
 *
 * Input: nama customer, baris form, dan teks pesan.
 * Output: HasilPemeriksaan. Kalau ada yang salah, pesannya yang pertama
 *         ditemukan dikembalikan (sesuai urutan: nama dulu, jumlah baris, lalu
 *         tiap menu).
 *
 * Kenapa memeriksa semuanya: tombol Simpan hanya boleh aktif kalau SEMUA isian
 * benar, dan Cashier perlu tahu semua yang salah sekaligus, bukan satu per satu.
 */
export function periksaForm(
  nama: string,
  baris: BarisForm[],
  pesan: {
    nama: { wajib: string; maks: string };
    qtyMaks: string;
    catatanMaks: string;
    jumlahBarisMaks: string;
  },
): HasilPemeriksaan {
  // Nama dulu, karena itu isian paling atas.
  const hasilNama = periksaNama(nama, pesan.nama);
  if (!hasilNama.valid) {
    return hasilNama;
  }

  // Jumlah baris item dibatasi 20 (api-contract bagian 2). Order dengan lebih
  // dari 20 baris akan ditolak server, jadi lebih baik dicegah di sini.
  if (baris.length > MAKSIMAL_BARIS) {
    return { valid: false, pesan: pesan.jumlahBarisMaks };
  }

  // Lalu tiap menu.
  for (const satuBaris of baris) {
    const hasilQty = periksaQty(satuBaris.qty, pesan.qtyMaks);
    if (!hasilQty.valid) {
      return hasilQty;
    }

    const hasilCatatan = periksaCatatan(satuBaris.note, pesan.catatanMaks);
    if (!hasilCatatan.valid) {
      return hasilCatatan;
    }
  }

  return { valid: true, pesan: null };
}

/**
 * Menghitung total perkiraan dari baris form dan daftar menu.
 *
 * Input: baris form (qty berupa teks) dan daftar menu (id dan harga).
 * Output: jumlah rupiah (angka bulat).
 *
 * Cara kerja: untuk tiap baris, cari harga menunya di daftar menu, lalu kalikan
 * dengan qty-nya. Baris dengan qty 0 atau yang menunya tidak ditemukan
 * diabaikan. Catatan TIDAK berpengaruh ke total.
 *
 * PENTING: hasil ini hanya untuk ditampilkan. Harga sebenarnya dihitung ulang
 * di server, jadi kalau selisih, angka server yang dipakai untuk pembayaran.
 */
export function hitungTotal(
  baris: BarisForm[],
  daftarMenu: { id: string; price: number }[],
): number {
  let total = 0;

  for (const satuBaris of baris) {
    const qty = Number(satuBaris.qty.trim());

    // Abaikan qty 0 atau yang bukan angka (menu tidak dipilih).
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const menu = daftarMenu.find(
      (satuMenu) => satuMenu.id === satuBaris.menuItemId,
    );

    // Menu tidak ditemukan (mis. dinonaktifkan): lewati, jangan gagalkan total.
    if (!menu) {
      continue;
    }

    total += menu.price * qty;
  }

  return total;
}

/**
 * Mengubah baris form menjadi daftar item yang siap dikirim ke server.
 *
 * Input: baris form (qty berupa teks).
 * Output: array { menuItemId, qty, note? } HANYA untuk baris yang qty-nya lebih
 *         dari 0. Baris lain tidak dikirim karena tidak akan dihitung.
 *
 * Catatan kosong tidak ikut dikirim (server memperlakukan catatan kosong sama
 * saja dengan tidak ada catatan).
 */
export function menjadiItemSiapKirim(
  baris: BarisForm[],
): { menuItemId: string; qty: number; note?: string }[] {
  const hasil: { menuItemId: string; qty: number; note?: string }[] = [];

  for (const satuBaris of baris) {
    const qty = Number(satuBaris.qty.trim());

    // qty 0 atau tidak valid: tidak dikirim.
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const catatan = satuBaris.note.trim();
    hasil.push({
      menuItemId: satuBaris.menuItemId,
      qty: qty,
      // Catatan hanya dikirim kalau ada isinya.
      ...(catatan.length > 0 ? { note: catatan } : {}),
    });
  }

  return hasil;
}

/**
 * Menentukan apakah tombol "Periksa dan simpan" boleh ditekan.
 *
 * Input: nama customer, baris form, metode bayar yang dipilih, pesan, dan
 *        waktu manual (hasil cekWaktuManual).
 * Output: true kalau tombol boleh aktif.
 *
 * Aturan tombol aktif (docs/Order-flow.md bagian 6):
 *   1. Nama customer valid,
 *   2. Semua isian jumlah dan catatan valid,
 *   3. Ada minimal satu menu dengan jumlah lebih dari 0,
 *   4. Metode bayar sudah dipilih (TIDAK ADA nilai bawaan),
 *   5. Kalau waktu manual dipakai, waktunya tidak melanggar aturan (tidak di
 *      masa depan dan di hari ini WIB).
 *
 * Kenapa poin 5 ikut diperiksa: kalau waktunya salah, order akan ditolak
 * server. Menonaktifkan tombol lebih baik daripada mengirim lalu ditolak.
 */
export function bolehSimpan(
  nama: string,
  baris: BarisForm[],
  metodeBayar: string | null,
  pesan: {
    nama: { wajib: string; maks: string };
    qtyMaks: string;
    catatanMaks: string;
    jumlahBarisMaks: string;
  },
  pesanWaktuManual: string | null = null,
): boolean {
  // Semua isian harus benar dulu.
  if (!periksaForm(nama, baris, pesan).valid) {
    return false;
  }

  // Metode bayar wajib dipilih sendiri oleh Cashier (tidak ada nilai bawaan).
  if (metodeBayar !== "qris" && metodeBayar !== "tunai") {
    return false;
  }

  // Waktu manual: kalau dicentang, waktunya harus tidak melanggar aturan.
  if (pesanWaktuManual !== null) {
    return false;
  }

  // Harus ada minimal satu item yang benar-benar dipilih (qty lebih dari 0).
  return menjadiItemSiapKirim(baris).length > 0;
}
