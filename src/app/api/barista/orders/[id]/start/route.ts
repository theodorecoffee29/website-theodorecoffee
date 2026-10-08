// File ini: route handler POST /api/barista/orders/[id]/start.
//
// Tugasnya: Barista menekan tombol Mulai, jadi order berubah dari "antrean" ke
// "dikerjakan". Memanggil fungsi database start_order.
//
// Peran: hanya Barista. Selesai tidak bisa ditekan sebelum Mulai karena fungsi
// finish_order memeriksa status harus "dikerjakan" (docs/order-flow.md bagian 5).
//
// Body tidak dipakai: server sudah tahu id order dari alamat dan pelakunya dari
// sesi login.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
  balasOrderTidakDitemukan,
} from "@/lib/server/balas";
import { jagaPeranStaf, metaSesi } from "@/lib/server/jaga-peran";
import { apakahUuidValid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

/**
 * Handler POST untuk memulai satu order (tombol Mulai Barista).
 *
 * Input: id order dari parameter alamat ([id]).
 * Output: { ok: true, data: { status: "dikerjakan" } } atau { ok: false, error }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Barista.
  const jaga = await jagaPeranStaf(["barista"], "mulai order");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil id order dari alamat.
  const { id } = await params;

  // 3. Id yang bukan uuid ditolak sebelum menyentuh database (bukan kegagalan
  //    sistem, jadi tidak dicatat di error_logs).
  if (!apakahUuidValid(id)) {
    return balasOrderTidakDitemukan();
  }

  // 4. Panggil fungsi database start_order.
  //    p_actor_id: id barista yang menekan Mulai. p_meta: session_id kalau ada.
  const { data, error } = await getAdminClient().rpc("start_order", {
    p_order_id: id,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    // ORDER_STATUS_CHANGED normal ketika barista lain sudah menekan lebih dulu
    // (docs/order-flow.md bagian 5). Tidak dicatat sebagai kegagalan sistem.
    return balasDariErrorDatabase(error, "start_order");
  }

  return balasOk(data);
}
