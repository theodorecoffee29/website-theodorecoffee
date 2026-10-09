// File ini: route handler PATCH /api/admin/menu/[id].
//
// Tugasnya: Admin mengubah nama dan harga satu menu (fungsi update_menu_item).
//
// PERAN: hanya Admin.
// CATATAN: satuan bahan tidak ada di sini (tidak relevan untuk menu). Dan mengubah
// harga menu tidak mengubah order lama, karena harga di order_items disalin saat
// order dibuat (docs/data-model.md aturan 6).

import type { NextRequest } from "next/server";
import { panggilFungsiAdmin } from "@/lib/server/panggil-fungsi-admin";
import { balasGagal, balasOk, balasValidasiGagal } from "@/lib/server/balas";
import { balasDariErrorAdmin } from "@/lib/server/balas-admin";
import { cekIdAlamat } from "@/lib/server/cek-id-alamat";
import { jagaPeranAdmin, metaSesi } from "@/lib/server/jaga-admin";
import { petakanMenuSatuan } from "@/lib/server/petakan-admin";
import { ubahMenuSchema } from "@/lib/server/validasi-admin";

export const dynamic = "force-dynamic";

/**
 * Handler PATCH: mengubah nama dan harga menu.
 *
 * Input: id menu dari parameter alamat, body { name, price }.
 * Output: { ok: true, data: { menuItemId, name, price } } atau
 *         { ok: false, error }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("ubah menu");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil id dari alamat, lalu periksa formatnya sebelum menyentuh database.
  const { id } = await params;
  const cekId = cekIdAlamat(id, "menuItemId");
  if (cekId !== null) {
    return cekId;
  }

  // 3. Baca body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasGagal({
      type: "VALIDATION_FAILED",
      message: "Body permintaan harus berupa JSON yang valid.",
    });
  }

  // 4. Validasi dengan zod.
  const hasilValidasi = ubahMenuSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { name, price } = hasilValidasi.data;

  // 5. Panggil fungsi database. Id dikirim sebagai teks, mengikuti signature
  //    fungsi (p_menu_item_id text); konversi ke uuid terjadi di dalam fungsi.
  const { data, error } = await panggilFungsiAdmin("update_menu_item", {
    p_menu_item_id: id,
    p_name: name,
    p_price: price,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    return balasDariErrorAdmin(error, "update_menu_item");
  }

  return balasOk(petakanMenuSatuan(data));
}
