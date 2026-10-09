// File ini: route handler untuk /api/admin/ingredients.
//
// Dua handler dalam satu file:
//   - GET  : daftar semua bahan beserta stoknya (docs/api-contract.md bagian 4b).
//   - POST : membuat bahan baru (fungsi create_ingredient).
//
// PERAN: hanya Admin.
//
// CATATAN SOAL STOK MINUS: kolom stock_qty tidak punya batasan nol
// (docs/data-model.md aturan 4). Stok minus berarti ada selisih antara stok
// fisik dan stok sistem, dan TIDAK berarti ada yang salah pada sistem ini.
// Field isNegative dikirim supaya Admin tahu bahan mana yang perlu dikoreksi
// lewat endpoint adjust (nilai itu dihitung di server, tidak disimpan di
// database).

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { panggilFungsiAdmin } from "@/lib/server/panggil-fungsi-admin";
import { balasGagal, balasOk, balasValidasiGagal } from "@/lib/server/balas";
import { balasDariErrorAdmin } from "@/lib/server/balas-admin";
import { jagaPeranAdmin, metaSesi } from "@/lib/server/jaga-admin";
import {
  petakanBahanBaru,
  petakanDaftarBahan,
} from "@/lib/server/petakan-admin";
import { buatBahanSchema } from "@/lib/server/validasi-admin";

export const dynamic = "force-dynamic";

/**
 * Handler GET: semua bahan beserta stoknya.
 *
 * Output: { ok: true, data: { ingredients: [...] } } atau { ok: false, error }.
 */
// Parameter request tidak dipakai di handler GET (daftar bahan hanya untuk Admin
// yang sudah login, jadi tidak perlu pembatas permintaan anonim), jadi ditulis
// dengan garis bawah depan agar ESLint tidak menegur.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("daftar bahan");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil bahan, urut menurut nama supaya daftar stabil dan mudah dipindai.
  const { data, error } = await getAdminClient()
    .from("ingredients")
    .select("id, name, unit, stock_qty")
    .order("name", { ascending: true });

  if (error) {
    return balasDariErrorAdmin(error, "daftar bahan admin");
  }

  // 3. Ubah nama kolom database (snake_case) menjadi camelCase, dan hitung
  //    isNegative dari stoknya.
  const hasil = petakanDaftarBahan(data ?? []);

  return balasOk({ ingredients: hasil });
}

/**
 * Handler POST: membuat bahan baru.
 *
 * Input: body { name, unit, initialStock? }.
 * Output: { ok: true, data: { ingredientId, name, unit, stockQty } } atau
 *         { ok: false, error }.
 *
 * Kalau initialStock lebih dari 0, fungsi database mencatatnya sebagai
 * pergerakan bertipe restock dan menulis log stock.restocked, jadi riwayat stok
 * terisi sejak awal.
 */
export async function POST(request: NextRequest) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("buat bahan");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Baca body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasGagal({
      type: "VALIDATION_FAILED",
      message: "Body permintaan harus berupa JSON yang valid.",
    });
  }

  // 3. Validasi dengan zod.
  const hasilValidasi = buatBahanSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { name, unit, initialStock } = hasilValidasi.data;

  // 4. Panggil fungsi database.
  //
  // CATATAN URUTAN PARAMETER: create_ingredient punya nilai bawaan pada
  // p_initial_stock, jadi parameter itu harus paling akhir (PostgreSQL menolak
  // parameter tanpa nilai bawaan yang berada setelah parameter yang punya nilai
  // bawaan). Karena itu p_actor_id dan p_meta dikirim lebih dulu.
  const { data, error } = await panggilFungsiAdmin("create_ingredient", {
    p_name: name,
    p_unit: unit,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
    // Kalau initialStock tidak dikirim, null berarti database memakai 0 dan
    // tidak mencatat pergerakan restock.
    p_initial_stock: initialStock ?? null,
  });

  if (error) {
    return balasDariErrorAdmin(error, "create_ingredient");
  }

  // 5. Sukses. Status 201 karena ada sumber daya baru.
  return balasOk(petakanBahanBaru(data), 201);
}
