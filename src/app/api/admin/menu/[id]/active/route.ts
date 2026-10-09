// File ini: route handler POST /api/admin/menu/[id]/active.
//
// Tugasnya: Admin mengaktifkan atau menonaktifkan menu (fungsi set_menu_active).
//
// PERAN: hanya Admin.
//
// CATATAN PENTING: menu tidak pernah dihapus, hanya dinonaktifkan
// (docs/data-model.md aturan 5 dan api-contract bagian 4b). Menu yang
// dinonaktifkan hilang dari menu customer (get_menu hanya mengambil is_active),
// tapi order lama yang memakainya tetap utuh dan laporannya tetap terbaca.

import type { NextRequest } from "next/server";
import { panggilFungsiAdmin } from "@/lib/server/panggil-fungsi-admin";
import { balasGagal, balasOk, balasValidasiGagal } from "@/lib/server/balas";
import { balasDariErrorAdmin } from "@/lib/server/balas-admin";
import { cekIdAlamat } from "@/lib/server/cek-id-alamat";
import { jagaPeranAdmin, metaSesi } from "@/lib/server/jaga-admin";
import { petakanStatusMenu } from "@/lib/server/petakan-admin";
import { ubahStatusMenuSchema } from "@/lib/server/validasi-admin";

export const dynamic = "force-dynamic";

/**
 * Handler POST: mengaktifkan atau menonaktifkan menu.
 *
 * Input: id menu dari parameter alamat, body { isActive }.
 * Output: { ok: true, data: { menuItemId, isActive } } atau
 *         { ok: false, error }.
 *
 * Nama aksi yang dicatat berbeda menurut status barunya: dinonaktifkan memakai
 * menu.deactivated, diaktifkan kembali memakai menu.updated. Itu sudah diatur
 * di dalam fungsi database.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("aktivasi menu");
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

  // 4. Validasi dengan zod. isActive wajib ada: server harus tahu Admin memang
  //    memilih status ini, bukan lupa mengirim.
  const hasilValidasi = ubahStatusMenuSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { isActive } = hasilValidasi.data;

  // 5. Panggil fungsi database.
  const { data, error } = await panggilFungsiAdmin("set_menu_active", {
    p_menu_item_id: id,
    p_is_active: isActive,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    return balasDariErrorAdmin(error, "set_menu_active");
  }

  return balasOk(petakanStatusMenu(data));
}
