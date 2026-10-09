// File ini: route handler POST /api/admin/ingredients/[id]/restock.
//
// Tugasnya: Admin menambah stok bahan (fungsi restock_ingredient).
//
// PERAN: hanya Admin.
//
// Berbeda dengan adjust: yang dikirim di sini adalah JUMLAH TAMBAHAN (qty),
// bukan stok akhir. Untuk mengoreksi ke jumlah hasil hitung fisik, pakai
// endpoint adjust.

import type { NextRequest } from "next/server";
import { panggilFungsiAdmin } from "@/lib/server/panggil-fungsi-admin";
import { balasGagal, balasOk, balasValidasiGagal } from "@/lib/server/balas";
import { balasDariErrorAdmin } from "@/lib/server/balas-admin";
import { cekIdAlamat } from "@/lib/server/cek-id-alamat";
import { jagaPeranAdmin, metaSesi } from "@/lib/server/jaga-admin";
import { petakanPerubahanStok } from "@/lib/server/petakan-admin";
import { restockBahanSchema } from "@/lib/server/validasi-admin";

export const dynamic = "force-dynamic";

/**
 * Handler POST: menambah stok bahan.
 *
 * Input: id bahan dari parameter alamat, body { qty, note? }.
 * Output: { ok: true, data: { ingredientId, stockQty, qtyChange } } atau
 *         { ok: false, error }.
 *
 * qty wajib lebih dari 0, jadi ini tidak mungkin berarti mengurangi stok. Catatan
 * (note) opsional, maksimal 100 karakter.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("tambah stok bahan");
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

  // 4. Validasi dengan zod.
  const hasilValidasi = restockBahanSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { qty, note } = hasilValidasi.data;

  // 5. Panggil fungsi database. Baris bahan dikunci for update di dalam fungsi,
  //    jadi dua Admin yang menambah stok bersamaan tidak saling menimpa.
  const { data, error } = await panggilFungsiAdmin("restock_ingredient", {
    p_ingredient_id: id,
    p_qty: qty,
    // Catatan kosong dikirim sebagai null supaya tidak jadi string kosong di
    // riwayat pergerakan.
    p_note: note ?? null,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    return balasDariErrorAdmin(error, "restock_ingredient");
  }

  return balasOk(petakanPerubahanStok(data));
}
