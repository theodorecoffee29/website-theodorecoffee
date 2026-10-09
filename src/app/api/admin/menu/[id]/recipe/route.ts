// File ini: route handler PUT /api/admin/menu/[id]/recipe.
//
// Tugasnya: Admin mengganti seluruh resep satu menu (fungsi set_recipe).
//
// PERAN: hanya Admin.
//
// Mengapa PUT (bukan PATCH): yang dikirim adalah seluruh isi resep, bukan
// sebagian. Resep lama dihapus dan diganti yang baru, dalam satu transaksi
// (docs/api-contract.md bagian 4b). Resep kosong (lines: []) diizinkan: itu
// berarti menu dianggap selalu tersedia.
//
// Bahan tidak boleh ganda. Aturan itu diperiksa di dua lapis: di server (zod,
// supaya pesannya menyebut bahan mana yang ganda sebelum dikirim) dan di dalam
// fungsi database sebagai pengaman kedua.

import type { NextRequest } from "next/server";
import { panggilFungsiAdmin } from "@/lib/server/panggil-fungsi-admin";
import { balasGagal, balasOk, balasValidasiGagal } from "@/lib/server/balas";
import { balasDariErrorAdmin } from "@/lib/server/balas-admin";
import { cekIdAlamat } from "@/lib/server/cek-id-alamat";
import { jagaPeranAdmin, metaSesi } from "@/lib/server/jaga-admin";
import { petakanResepFungsi } from "@/lib/server/petakan-admin";
import { ubahResepSchema } from "@/lib/server/validasi-admin";

export const dynamic = "force-dynamic";

/**
 * Handler PUT: mengganti seluruh resep satu menu.
 *
 * Input: id menu dari parameter alamat, body { lines: [{ ingredientId, qtyPerPortion }] }.
 * Output: { ok: true, data: { menuItemId, lines } } atau { ok: false, error }.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("ubah resep");
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

  // 4. Validasi dengan zod: 0-20 baris, ingredientId uuid, bahan tidak boleh
  //    ganda, qtyPerPortion lebih dari 0 dengan maksimal 3 angka desimal.
  const hasilValidasi = ubahResepSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { lines } = hasilValidasi.data;

  // 5. Panggil fungsi database. lines dikirim sebagai jsonb apa adanya; nama
  //    fieldnya sudah cocok dengan yang dibaca fungsi (ingredientId,
  //    qtyPerPortion).
  const { data, error } = await panggilFungsiAdmin("set_recipe", {
    p_menu_item_id: id,
    p_lines: lines,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    // Bahan ganda atau bahan yang tidak ada menghasilkan VALIDATION_FAILED,
    // dan detailnya ikut dikirim supaya Admin tahu bahannya yang mana.
    return balasDariErrorAdmin(error, "set_recipe");
  }

  return balasOk(petakanResepFungsi(data));
}
