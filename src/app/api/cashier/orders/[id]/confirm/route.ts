// File ini: route handler POST /api/cashier/orders/[id]/confirm.
//
// Tugasnya: Cashier/Admin mengonfirmasi order + memilih metode bayar.
// Memanggil fungsi database confirm_order.
//
// Peran: hanya Cashier dan Admin. Penjagaan dilakukan server-side lewat
// jagaPeranStaf sebelum menyentuh database.
//
// Catatan penting soal output: fungsi confirm_order mengembalikan
// stock_warnings kalau ada bahan yang stoknya jadi minus. stockWarnings BUKAN
// error (docs/api-contract.md bagian 4): konfirmasi tetap sukses, Cashier hanya
// melihat peringatan. Karena itu route ini mengembalikan status 200 (sukses),
// bukan 409.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
  balasValidasiGagal,
} from "@/lib/server/balas";
import { jagaPeranStaf, metaSesi } from "@/lib/server/jaga-peran";
import { konfirmasiOrderSchema } from "@/lib/server/validasi";

export const dynamic = "force-dynamic";

/**
 * Handler POST untuk mengonfirmasi satu order.
 *
 * Input: id order dari parameter alamat ([id]), body { paymentMethod }.
 * Output: { ok: true, data: { status, queueNumber, stockWarnings } } atau
 *         { ok: false, error }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Cashier dan Admin.
  const jaga = await jagaPeranStaf(["cashier", "admin"], "konfirmasi order");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil id order dari alamat.
  const { id } = await params;

  // 3. Validasi body (metode bayar harus qris atau tunai).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasGagal({
      type: "VALIDATION_FAILED",
      message: "Body permintaan harus berupa JSON yang valid.",
    });
  }

  const hasilValidasi = konfirmasiOrderSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  // 4. Panggil fungsi database confirm_order.
  //    p_actor_id: id staf yang mengonfirmasi. p_meta: session_id kalau ada.
  const { data, error } = await getAdminClient().rpc("confirm_order", {
    p_order_id: id,
    p_payment_method: hasilValidasi.data.paymentMethod,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  });

  if (error) {
    // Error yang mungkin: ORDER_NOT_FOUND, ORDER_STATUS_CHANGED, VALIDATION_FAILED
    // (metode bayar), atau INTERNAL_ERROR. Yang non-INTERNAL tidak dicatat
    // sebagai kegagalan sistem oleh balasDariErrorDatabase.
    return balasDariErrorDatabase(error, "confirm_order");
  }

  // 5. Sukses (status 200). stock_warnings ikut di dalam data.
  return balasOk(data);
}
