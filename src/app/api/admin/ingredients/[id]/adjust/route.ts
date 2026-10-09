// File ini: route handler POST /api/admin/ingredients/[id]/adjust.
//
// Tugasnya: Admin mengoreksi stok ke jumlah hasil hitung fisik (fungsi
// adjust_stock).
//
// PERAN: hanya Admin.
//
// Berbeda dengan restock: yang dikirim di sini adalah HASIL HITUNG (newQty), bukan
// jumlah tambahan. Selisihnya dihitung di dalam fungsi dan dicatat sebagai
// pergerakan bertipe adjustment (bisa positif atau negatif).
//
// Endpoint ini juga dipakai untuk mengembalikan stok yang minus ke angka
// sebenarnya: aturan "stok boleh minus" hanya berlaku untuk mencatat selisih
// sementara, dan Admin wajib mengoreksinya lewat endpoint ini.
//
// Alasan (reason) wajib diisi, supaya riwayat stok tetap bisa ditelusuri
// ("kenapa stoknya berubah?"). Tanpa alasan, riwayatnya tidak berguna.

import type { NextRequest } from "next/server";
import { panggilFungsiAdmin } from "@/lib/server/panggil-fungsi-admin";
import { balasGagal, balasOk, balasValidasiGagal } from "@/lib/server/balas";
import { balasDariErrorAdmin } from "@/lib/server/balas-admin";
import { cekIdAlamat } from "@/lib/server/cek-id-alamat";
import { jagaPeranAdmin, metaSesi } from "@/lib/server/jaga-admin";
import { petakanPerubahanStok } from "@/lib/server/petakan-admin";
import { koreksiStokSchema } from "@/lib/server/validasi-admin";

export const dynamic = "force-dynamic";

/**
 * Handler POST: mengoreksi stok bahan ke hasil hitung fisik.
 *
 * Input: id bahan dari parameter alamat, body { newQty, reason }.
 * Output: { ok: true, data: { ingredientId, stockQty, qtyChange } } atau
 *         { ok: false, error }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("koreksi stok bahan");
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

  // 4. Validasi dengan zod. newQty boleh 0 (habis) tapi tidak boleh negatif,
  //    dan reason wajib diisi.
  const hasilValidasi = koreksiStokSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { newQty, reason } = hasilValidasi.data;

  // 5. Panggil fungsi database. Baris bahan dikunci for update di dalam fungsi.
  const { data, error } = await panggilFungsiAdmin("adjust_stock", {
    p_ingredient_id: id,
    p_new_qty: newQty,
    p_reason: reason,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    // Penyesuaian tanpa perubahan (selisih 0) menghasilkan VALIDATION_FAILED
    // dari database, dan detailnya ikut dikirim.
    return balasDariErrorAdmin(error, "adjust_stock");
  }

  return balasOk(petakanPerubahanStok(data));
}
