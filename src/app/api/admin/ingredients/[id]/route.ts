// File ini: route handler PATCH /api/admin/ingredients/[id].
//
// Tugasnya: Admin mengubah NAMA satu bahan (fungsi update_ingredient).
//
// PERAN: hanya Admin.
//
// KENAPA SATUAN TIDAK ADA DI SINI: satuan tidak bisa diubah setelah bahan dibuat
// (docs/api-contract.md bagian 4b). Kalau Admin mengirim field "unit", zod
// mengabaikannya karena tidak ada di skema, jadi satuan TIDAK akan berubah.
// Kalau memang satuan salah, jalannya adalah membuat bahan baru lalu memindahkan
// resepnya.

import type { NextRequest } from "next/server";
import { panggilFungsiAdmin } from "@/lib/server/panggil-fungsi-admin";
import { balasGagal, balasOk, balasValidasiGagal } from "@/lib/server/balas";
import { balasDariErrorAdmin } from "@/lib/server/balas-admin";
import { cekIdAlamat } from "@/lib/server/cek-id-alamat";
import { jagaPeranAdmin, metaSesi } from "@/lib/server/jaga-admin";
import { petakanBahanDiubah } from "@/lib/server/petakan-admin";
import { ubahBahanSchema } from "@/lib/server/validasi-admin";

export const dynamic = "force-dynamic";

/**
 * Handler PATCH: mengubah nama bahan.
 *
 * Input: id bahan dari parameter alamat, body { name }.
 * Output: { ok: true, data: { ingredientId, name } } atau { ok: false, error }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("ubah bahan");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil id dari alamat, lalu periksa formatnya sebelum menyentuh database.
  const { id } = await params;
  const cekId = cekIdAlamat(id, "ingredientId");
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

  // 4. Validasi dengan zod. Hanya name yang diperiksa; tidak ada field unit.
  const hasilValidasi = ubahBahanSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { name } = hasilValidasi.data;

  // 5. Panggil fungsi database.
  const { data, error } = await panggilFungsiAdmin("update_ingredient", {
    p_ingredient_id: id,
    p_name: name,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    return balasDariErrorAdmin(error, "update_ingredient");
  }

  return balasOk(petakanBahanDiubah(data));
}
