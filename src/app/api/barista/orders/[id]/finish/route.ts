// File ini: route handler POST /api/barista/orders/[id]/finish.
//
// Tugasnya: Barista menekan tombol Selesai, jadi order berubah dari "dikerjakan"
// ke "selesai". Memanggil fungsi database finish_order.
//
// Peran: hanya Barista. Order harus sudah "dikerjakan"; kalau belum, fungsi
// mengembalikan ORDER_STATUS_CHANGED (docs/order-flow.md bagian 5).
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
 * Handler POST untuk menyelesaikan satu order (tombol Selesai Barista).
 *
 * Input: id order dari parameter alamat ([id]).
 * Output: { ok: true, data: { status: "selesai" } } atau { ok: false, error }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Barista.
  const jaga = await jagaPeranStaf(["barista"], "selesai order");
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

  // 4. Panggil fungsi database finish_order.
  //    p_actor_id: id barista yang menekan Selesai. p_meta: session_id kalau ada.
  const { data, error } = await getAdminClient().rpc("finish_order", {
    p_order_id: id,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    // ORDER_STATUS_CHANGED normal bila order belum selesai dikerjakan atau
    // sudah selesai. Tidak dicatat sebagai kegagalan sistem.
    return balasDariErrorDatabase(error, "finish_order");
  }

  return balasOk(data);
}
