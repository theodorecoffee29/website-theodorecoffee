// File ini: route handler untuk /api/admin/menu.
//
// Dua handler dalam satu file (Next.js App Router membolehkan satu GET dan satu
// POST per file):
//   - GET  : daftar semua menu termasuk yang nonaktif, beserta baris resepnya
//             (docs/api-contract.md bagian 4b: "Bacaan Admin").
//   - POST : membuat menu baru (fungsi create_menu_item).
//
// PERAN: hanya Admin. Cashier dan Barista mendapat FORBIDDEN dan access.denied
// dicatat (docs/pemissions.md bagian 2). Belum login mendapat UNAUTHENTICATED.
//
// CATATAN SOAL PEMBACAAN: fungsi list_orders belum ada di database, jadi GET
// membaca langsung dari tabel memakai klien admin (kunci service role), yang
// melewati RLS. Kolom yang dipilih eksplisit supaya tidak mengambil yang tidak
// perlu.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { panggilFungsiAdmin } from "@/lib/server/panggil-fungsi-admin";
import { balasGagal, balasOk, balasValidasiGagal } from "@/lib/server/balas";
import { balasDariErrorAdmin } from "@/lib/server/balas-admin";
import { jagaPeranAdmin, metaSesi } from "@/lib/server/jaga-admin";
import { buatMenuSchema } from "@/lib/server/validasi-admin";
import {
  petakanDaftarMenu,
  petakanMenuSatuan,
} from "@/lib/server/petakan-admin";

export const dynamic = "force-dynamic";

/**
 * Handler GET: semua menu (aktif dan nonaktif) beserta resepnya.
 *
 * Output: { ok: true, data: { menuItems: [...] } } atau { ok: false, error }.
 *
 * Resep diambil dengan nested select supaya nama dan satuan bahan ikut terbawa
 * tanpa perlu kueri terpisah.
 */
// Parameter request tidak dipakai di handler GET (daftar menu hanya untuk Admin
// yang sudah login, jadi tidak perlu pembatas permintaan anonim), jadi ditulis
// dengan garis bawah depan agar ESLint tidak menegur.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("daftar menu admin");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil menu beserta resep dan info bahannya.
  //    Urut menurut nama supaya Admin mendapat daftar yang stabil dan mudah
  //    dipindai.
  const { data, error } = await getAdminClient()
    .from("menu_items")
    .select(
      "id, name, price, is_active, recipes(qty_per_portion, ingredient_id, ingredients(name, unit))",
    )
    .order("name", { ascending: true });

  if (error) {
    return balasDariErrorAdmin(error, "daftar menu admin");
  }

  // 3. Ubah nama kolom database (snake_case) menjadi camelCase.
  const hasil = petakanDaftarMenu(
    (data ?? []) as Parameters<typeof petakanDaftarMenu>[0],
  );

  return balasOk({ menuItems: hasil });
}

/**
 * Handler POST: membuat menu baru.
 *
 * Input: body { name, price }.
 * Output: { ok: true, data: { menuItemId, name, price } } atau
 *         { ok: false, error }.
 *
 * Menu baru langsung aktif (create_menu_item sudah begitu di database), dan
 * log menu.created ditulis di dalam fungsi database dalam satu transaksi.
 */
export async function POST(request: NextRequest) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("buat menu");
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
  const hasilValidasi = buatMenuSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { name, price } = hasilValidasi.data;

  // 4. Panggil fungsi database.
  //    p_actor_id: id Admin yang membuat. p_meta: session_id kalau ada.
  const { data, error } = await panggilFungsiAdmin("create_menu_item", {
    p_name: name,
    p_price: price,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    // Nama yang sudah dipakai menghasilkan VALIDATION_FAILED, dan detailnya
    // ("name ... sudah dipakai") ikut dikirim supaya Admin tahu apa yang salah.
    return balasDariErrorAdmin(error, "create_menu_item");
  }

  // 5. Sukses. Status 201 karena ada sumber daya baru.
  return balasOk(petakanMenuSatuan(data), 201);
}
