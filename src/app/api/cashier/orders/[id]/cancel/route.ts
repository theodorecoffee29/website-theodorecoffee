// File ini: route handler POST /api/cashier/orders/[id]/cancel.
//
// Tugasnya: Cashier/Admin membatalkan order. Memanggil fungsi database
// cancel_order dengan p_actor_id diisi id staf yang membatalkan.
//
// Peran: hanya Cashier dan Admin. Cashier/Admin boleh membatalkan saat status
// menunggu_konfirmasi ATAU antrean (docs/order-flow.md bagian 3). Barista tidak
// boleh, dan tidak punya endpoint ini.
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
import { petakanHasilBatal } from "@/lib/server/petakan-hasil-fungsi";
import { apakahUuidValid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

/**
 * Handler POST untuk membatalkan satu order oleh staf (Cashier/Admin).
 *
 * Input: id order dari parameter alamat ([id]).
 * Output: { ok: true, data: { status: "dibatalkan" } } atau { ok: false, error }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Cashier dan Admin.
  const jaga = await jagaPeranStaf(
    ["cashier", "admin"],
    "batalkan order (staf)",
  );
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

  // 4. Panggil fungsi database cancel_order.
  //    p_actor_id: id staf yang membatalkan (bukan null seperti customer).
  const { data, error } = await getAdminClient().rpc("cancel_order", {
    p_order_id: id,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    // Kalau order sudah dikerjakan/selesai/dibatalkan, fungsi mengembalikan
    // ORDER_STATUS_CHANGED. Penolakan ini normal, jadi tidak dicatat sebagai
    // kegagalan sistem.
    return balasDariErrorDatabase(error, "cancel_order (staf)");
  }

  // Sukses. Hasil fungsi database dipetakan ke bentuk camelCase
  // (docs/api-contract.md bagian 4) supaya semua route konsisten.
  return balasOk(petakanHasilBatal(data));
}
