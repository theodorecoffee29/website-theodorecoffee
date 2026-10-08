// File ini: route handler POST /api/orders/[id]/cancel.
//
// Tugasnya: membatalkan order oleh CUSTOMER (p_actor_id null, tanpa login).
// Customer hanya boleh membatalkan saat status masih menunggu_konfirmasi
// (docs/order-flow.md bagian 3). Aturan peran customer-vs-staf ditegakkan di
// fungsi database cancel_order, bukan di sini.
//
// Perbedaan dengan route cancel milik staf (/api/cashier/orders/[id]/cancel):
// di sini p_actor_id sengaja diisi null karena tidak ada akun yang login.
//
// Ada pembatas permintaan supaya tidak dipakai untuk membanjiri server.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
  balasOrderTidakDitemukan,
} from "@/lib/server/balas";
import {
  periksaPembatas,
  BATASAN_ENDPOINT,
} from "@/lib/server/pembatas-permintaan";
import { ambilIpPemanggil } from "@/lib/server/ambil-ip";
import { petakanHasilBatal } from "@/lib/server/petakan-hasil-fungsi";
import { apakahUuidValid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

/**
 * Handler POST untuk membatalkan satu order oleh customer.
 *
 * Input: id order dari parameter alamat ([id]).
 * Output: { ok: true, data: { status: "dibatalkan" } } atau { ok: false, error }.
 *
 * Body tidak dipakai. Customer tidak mengirim apa pun; server sudah tahu id
 * order dari alamat dan pelakunya adalah customer itu sendiri.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Pembatas permintaan per IP.
  const cekBatas = periksaPembatas(
    "batalkan-order:" + ambilIpPemanggil(request),
    Date.now(),
    BATASAN_ENDPOINT.batalkanOrder,
  );
  if (!cekBatas.boleh) {
    return balasGagal({
      type: "RATE_LIMITED",
      message: "Terlalu banyak permintaan. Coba lagi sebentar.",
    });
  }

  const { id } = await params;

  // Id yang bukan uuid ditolak sebelum menyentuh database (bukan kegagalan
  // sistem, jadi tidak dicatat di error_logs).
  if (!apakahUuidValid(id)) {
    return balasOrderTidakDitemukan();
  }

  // Panggil fungsi database cancel_order.
  // p_actor_id: null karena pelakunya customer yang tidak punya akun.
  // p_meta: null karena customer tidak punya id sesi.
  // Tipe hasil generate (database.types.ts) menuliskan kolom yang boleh kosong
  // sebagai wajib, padahal di database kolom itu menerima null. Karena itu
  // argumennya di-cast, seperti yang juga dilakukan di src/lib/log.
  const { data, error } = await getAdminClient().rpc("cancel_order", {
    p_order_id: id,
    p_actor_id: null,
    p_meta: null,
  } as never);

  if (error) {
    // Kalau order sudah dikonfirmasi/dibatalkan, fungsi mengembalikan
    // ORDER_STATUS_CHANGED. Penolakan seperti ini normal, jadi tidak dicatat
    // sebagai kegagalan sistem.
    return balasDariErrorDatabase(error, "cancel_order (customer)");
  }

  // Sukses. Hasil fungsi database dipetakan ke bentuk camelCase
  // (docs/api-contract.md bagian 4) supaya semua route konsisten.
  return balasOk(petakanHasilBatal(data));
}
