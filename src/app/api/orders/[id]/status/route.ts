// File ini: route handler GET /api/orders/[id]/status.
//
// Tugasnya: mengembalikan status satu order untuk halaman status customer.
// Customer tidak punya akun, jadi identitasnya adalah id order itu sendiri
// (docs/pemissions.md bagian 3). Id order berupa uuid panjang yang tidak bisa
// ditebak, jadi orang lain tidak bisa menebak order orang.
//
// Alur: ambil id dari alamat, panggil fungsi get_order_status, kirim hasilnya.
// Ada pembatas permintaan karena halaman ini dipanggil berulang (polling 5 detik).

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
} from "@/lib/server/balas";
import {
  periksaPembatas,
  BATASAN_ENDPOINT,
} from "@/lib/server/pembatas-permintaan";
import { ambilIpPemanggil } from "@/lib/server/ambil-ip";

export const dynamic = "force-dynamic";

/**
 * Handler GET untuk status satu order.
 *
 * Input: id order diambil dari parameter alamat ([id]).
 * Output: { ok: true, data: { status, queueNumber, queueDate, items, total } }
 *         atau { ok: false, error } kalau order tidak ada.
 *
 * Catatan: kalau id-nya bukan uuid, fungsi get_order_status mengembalikan
 * ORDER_NOT_FOUND (bukan error database mentah), sesuai api-contract bagian 4.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Pembatas permintaan. Halaman status dipanggil berulang (polling 5 detik),
  // jadi batasnya longgar: sekitar 12 permintaan per menit per halaman status,
  // dan batasnya 60 memberi ruang untuk beberapa tab terbuka sekaligus.
  const cekBatas = periksaPembatas(
    "status-order:" + ambilIpPemanggil(request),
    Date.now(),
    BATASAN_ENDPOINT.statusOrder,
  );
  if (!cekBatas.boleh) {
    return balasGagal({
      type: "RATE_LIMITED",
      message: "Terlalu banyak permintaan. Coba lagi sebentar.",
    });
  }

  // Di Next.js 15 ke atas, params harus di-await.
  const { id } = await params;

  const { data, error } = await getAdminClient().rpc("get_order_status", {
    p_order_id: id,
  });

  if (error) {
    return balasDariErrorDatabase(error, "get_order_status");
  }

  return balasOk(data);
}
