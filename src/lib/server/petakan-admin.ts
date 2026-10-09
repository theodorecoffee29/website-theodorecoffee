// File ini: mengubah baris dari database menjadi bentuk camelCase yang dikirim
// ke browser untuk layar Admin.
//
// KENAPA DIPISAH DARI petakan-hasil-fungsi.ts: file itu memetakan hasil fungsi
// database (yang mengembalikan satu jsonb). Endpoint bacaan Admin
// (GET /api/admin/menu dan GET /api/admin/ingredients) membaca langsung dari
// tabel, jadi bentuknya berbeda: satu baris database menjadi beberapa baris
// respons yang dirangkai.
//
// File ini MURNI (tanpa database), jadi bisa diuji langsung.

import {
  ubahKeAngka,
  ubahKeBulat,
  ubahKeTeks,
  nilaiNegatif,
} from "./ubah-ke-angka";

// -----------------------------------------------------------------------------
// Bentuk respons GET /api/admin/menu
// -----------------------------------------------------------------------------

// Satu baris resep di dalam sebuah menu.
export type BarisResepTampil = {
  ingredientId: string;
  ingredientName: string;
  // Satuan bahan (g/ml/pcs), supaya Admin tidak perlu membuka daftar bahan untuk
  // membaca resep.
  unit: string;
  qtyPerPortion: number;
};

// Satu menu beserta resepnya.
export type MenuTampil = {
  menuItemId: string;
  name: string;
  price: number;
  isActive: boolean;
  // Resep dalam bentuk jsonb apa adanya (dari set_recipe), atau baris database
  // dari recipes yang sudah digabung dengan ingredients.
  recipe: BarisResepTampil[];
};

// Bentuk baris menu seperti yang dibaca dari tabel.
type BarisMenuDatabase = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  // Resep dalam dua kemungkinan bentuk:
  //   - array objek (kalau select memakai nested select),
  //   - null / undefined kalau menunya tidak punya resep.
  //
  // Tipe unknown supaya pemeriksa yang memutuskan, bukan tipe ini.
  recipes?: unknown;
};

/**
 * Mengubah daftar baris menu dari database menjadi daftar menu untuk tampilan.
 *
 * Input: baris menu dari tabel menu_items, lengkap dengan resepnya.
 * Output: daftar MenuTampil dalam bentuk camelCase.
 *
 * Resep setiap menu diambil dari kolom recipes. Kalau kolom itu bukan array
 * (mis. null), resepnya dianggap kosong. Baris resep yang tidak lengkap dilewati
 * supaya satu baris rusak tidak membuat seluruh halaman gagal.
 */
export function petakanDaftarMenu(baris: BarisMenuDatabase[]): MenuTampil[] {
  return baris.map((satu) => ({
    menuItemId: ubahKeTeks(satu.id),
    name: ubahKeTeks(satu.name),
    price: ubahKeBulat(satu.price),
    isActive: satu.is_active === true,
    recipe: petakanResep(satu.recipes),
  }));
}

/**
 * Mengubah kolom recipes menjadi daftar baris resep untuk tampilan.
 *
 * Input: isi kolom recipes dari database.
 * Output: BarisResepTampil[].
 *
 * Setiap baris butuh ingredientId, ingredientName, unit, dan qtyPerPortion.
 * Baris yang tidak punya semuanya dilewati, karena tampilannya tidak akan
 * berguna dan lebih baik tidak ditampilkan daripada menampilkan data setengah.
 */
export function petakanResep(resepMentah: unknown): BarisResepTampil[] {
  if (!Array.isArray(resepMentah)) {
    return [];
  }

  const hasil: BarisResepTampil[] = [];
  for (const satuMentah of resepMentah) {
    if (satuMentah === null || typeof satuMentah !== "object") {
      continue;
    }

    const kolom = satuMentah as Record<string, unknown>;

    // Id dan nama bahan wajib ada, kalau tidak baris ini tidak berguna.
    const ingredientId = ubahKeTeks(kolom.ingredient_id);
    const ingredientName = ubahKeTeks(kolom.ingredient_name);
    if (ingredientId === "" || ingredientName === "") {
      continue;
    }

    hasil.push({
      ingredientId: ingredientId,
      ingredientName: ingredientName,
      // Satuan boleh kosong kalau bahannya tidak ada lagi (kemungkinan kecil,
      // tapi tidak boleh membuat halaman error).
      unit: ubahKeTeks(kolom.unit),
      qtyPerPortion: ubahKeAngka(kolom.qty_per_portion),
    });
  }

  return hasil;
}

// -----------------------------------------------------------------------------
// Bentuk respons GET /api/admin/ingredients
// -----------------------------------------------------------------------------

// Satu bahan untuk tampilan.
export type BahanTampil = {
  ingredientId: string;
  name: string;
  unit: string;
  stockQty: number;
  // true kalau stoknya di bawah 0. Stok boleh minus
  // (docs/data-model.md aturan 4), jadi Admin perlu tahu bahan mana yang perlu
  // dikoreksi. Nilai ini hanya dihitung di sini, tidak disimpan di database.
  isNegative: boolean;
};

/**
 * Mengubah daftar baris bahan dari database menjadi daftar bahan untuk tampilan.
 *
 * Input: baris dari tabel ingredients.
 * Output: daftar BahanTampil dalam bentuk camelCase.
 *
 * stockQty diubah dari numeric database (yang bisa datang sebagai teks) menjadi
 * angka, lalu isNegative dihitung darinya.
 */
export function petakanDaftarBahan(
  baris: { id: string; name: string; unit: string; stock_qty: unknown }[],
): BahanTampil[] {
  return baris.map((satu) => {
    const stok = ubahKeAngka(satu.stock_qty);

    return {
      ingredientId: ubahKeTeks(satu.id),
      name: ubahKeTeks(satu.name),
      unit: ubahKeTeks(satu.unit),
      stockQty: stok,
      // Dihitung dari stok yang sudah jadi angka, supaya teks "-12.500" dari
      // database juga terdeteksi sebagai minus.
      isNegative: nilaiNegatif(stok),
    };
  });
}

// -----------------------------------------------------------------------------
// Bentuk respons GET /api/admin/ingredients/[id]/movements
// -----------------------------------------------------------------------------

// Satu pergerakan stok untuk tampilan.
export type PergerakanTampil = {
  movementId: string;
  // order_confirm, order_cancel_restore, restock, atau adjustment.
  type: string;
  // Berubahnya stok. Negatif berarti berkurang, positif bertambah.
  qtyChange: number;
  // Stok setelah perubahan ini.
  stockAfter: number;
  createdAt: string;
  // Terisi kalau pergerakan ini berasal dari order. Null kalau bukan.
  orderId: string | null;
  note: string | null;
};

/**
 * Mengubah baris pergerakan stok dari database menjadi bentuk tampilan.
 *
 * Input: baris dari tabel stock_movements.
 * Output: PergerakanTampil[].
 *
 * orderId dan note boleh kosong di database, jadi keduanya bisa null.
 */
export function petakanPergerakan(
  baris: {
    id: string;
    type: string;
    qty_change: unknown;
    stock_after: unknown;
    created_at: string;
    order_id: string | null;
    note: string | null;
  }[],
): PergerakanTampil[] {
  return baris.map((satu) => ({
    movementId: ubahKeTeks(satu.id),
    type: ubahKeTeks(satu.type),
    qtyChange: ubahKeAngka(satu.qty_change),
    stockAfter: ubahKeAngka(satu.stock_after),
    // Waktu dari database (timestamptz) diteruskan apa adanya. Formatnya ISO
    // dengan zona, jadi browser bisa menampilkannya dalam WIB.
    createdAt: satu.created_at,
    orderId: satu.order_id ?? null,
    note: satu.note ?? null,
  }));
}

// -----------------------------------------------------------------------------
// Bentuk respons dari fungsi database (create, update, restock, adjust)
// -----------------------------------------------------------------------------

/**
 * Mengubah hasil fungsi create_menu_item atau update_menu_item.
 *
 * Input: data apa pun dari fungsi database.
 * Output: { menuItemId, name, price }.
 *
 * Fungsi database sudah mengembalikan kunci camelCase, tapi nilainya tetap
 * dibersihkan di sini supaya bentuknya dijamin lengkap.
 */
export function petakanMenuSatuan(data: unknown): {
  menuItemId: string;
  name: string;
  price: number;
} {
  const kolom = jadiObjek(data);
  return {
    menuItemId: ubahKeTeks(kolom.menuItemId),
    name: ubahKeTeks(kolom.name),
    price: ubahKeBulat(kolom.price),
  };
}

/**
 * Mengubah hasil fungsi set_menu_active.
 *
 * Input: data apa pun dari fungsi database.
 * Output: { menuItemId, isActive }.
 */
export function petakanStatusMenu(data: unknown): {
  menuItemId: string;
  isActive: boolean;
} {
  const kolom = jadiObjek(data);
  return {
    menuItemId: ubahKeTeks(kolom.menuItemId),
    isActive: kolom.isActive === true,
  };
}

/**
 * Mengubah hasil fungsi set_recipe.
 *
 * Input: data apa pun dari fungsi database.
 * Output: { menuItemId, lines }.
 *
 * lines sudah dalam bentuk { ingredientId, qtyPerPortion } (fungsi database
 * memformatnya begitu), jadi di sini hanya dibersihkan dari nilai null.
 */
export function petakanResepFungsi(data: unknown): {
  menuItemId: string;
  lines: { ingredientId: string; qtyPerPortion: number }[];
} {
  const kolom = jadiObjek(data);

  const barisMentah = Array.isArray(kolom.lines) ? kolom.lines : [];
  const lines: { ingredientId: string; qtyPerPortion: number }[] = [];

  for (const satuMentah of barisMentah) {
    const satu = jadiObjek(satuMentah);
    lines.push({
      ingredientId: ubahKeTeks(satu.ingredientId),
      qtyPerPortion: ubahKeAngka(satu.qtyPerPortion),
    });
  }

  return {
    menuItemId: ubahKeTeks(kolom.menuItemId),
    lines: lines,
  };
}

/**
 * Mengubah hasil fungsi create_ingredient.
 *
 * Input: data apa pun dari fungsi database.
 * Output: { ingredientId, name, unit, stockQty }.
 */
export function petakanBahanBaru(data: unknown): {
  ingredientId: string;
  name: string;
  unit: string;
  stockQty: number;
} {
  const kolom = jadiObjek(data);
  return {
    ingredientId: ubahKeTeks(kolom.ingredientId),
    name: ubahKeTeks(kolom.name),
    unit: ubahKeTeks(kolom.unit),
    stockQty: ubahKeAngka(kolom.stockQty),
  };
}

/**
 * Mengubah hasil fungsi update_ingredient.
 *
 * Input: data apa pun dari fungsi database.
 * Output: { ingredientId, name }.
 *
 * Tidak ada unit di sini, karena fungsi ini hanya mengubah nama.
 */
export function petakanBahanDiubah(data: unknown): {
  ingredientId: string;
  name: string;
} {
  const kolom = jadiObjek(data);
  return {
    ingredientId: ubahKeTeks(kolom.ingredientId),
    name: ubahKeTeks(kolom.name),
  };
}

/**
 * Mengubah hasil fungsi restock_ingredient dan adjust_stock.
 *
 * Input: data apa pun dari fungsi database.
 * Output: { ingredientId, stockQty, qtyChange }.
 *
 * Dua fungsi ini punya bentuk keluaran yang sama (stok setelah perubahan dan
 * selisihnya), jadi dipetakan bersama.
 */
export function petakanPerubahanStok(data: unknown): {
  ingredientId: string;
  stockQty: number;
  qtyChange: number;
} {
  const kolom = jadiObjek(data);
  return {
    ingredientId: ubahKeTeks(kolom.ingredientId),
    stockQty: ubahKeAngka(kolom.stockQty),
    qtyChange: ubahKeAngka(kolom.qtyChange),
  };
}

/**
 * Mengubah data apa pun menjadi objek yang bisa dibaca dengan aman.
 *
 * Output: objek. Kalau data bukan objek (mis. null), objek kosong dikembalikan
 * supaya pembacaan field di bawah tidak gagal.
 */
function jadiObjek(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return {};
}
