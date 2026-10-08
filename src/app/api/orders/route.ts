// File ini: route handler POST /api/orders.
//
// Tugasnya: membuat order online oleh customer (anonim, tanpa login).
// Body: { customerName, items: [{ menuItemId, qty, note }], idempotencyKey }.
//
// Aturan penting:
//   - Input divalidasi dengan zod (src/lib/server/validasi.ts).
//   - Harga TIDAK diterima dari klien. Kita hanya mengirim menuItemId, qty, note,
//     dan idempotencyKey ke fungsi database create_order. Fungsi itu menghitung
//     harga sendiri dari menu_items.
//   - Ada pembatas permintaan per IP supaya tidak dibanjiri order palsu.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
  balasValidasiGagal,
} from "@/lib/server/balas";
import { buatOrderSchema } from "@/lib/server/validasi";
import { petakanHasilBuatOrder } from "@/lib/server/petakan-hasil-fungsi";
import {
  periksaPembatas,
  BATASAN_ENDPOINT,
} from "@/lib/server/pembatas-permintaan";
import { ambilIpPemanggil } from "@/lib/server/ambil-ip";

// Route ini tidak boleh di-cache, dan mengembalikan 201 karena order berhasil dibuat.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // 1. Pembatas permintaan per IP. Batasnya ketat karena membuat order adalah
  //    aksi yang bisa dipakai untuk membanjiri server dengan order palsu.
  const cekBatas = periksaPembatas(
    "buat-order:" + ambilIpPemanggil(request),
    Date.now(),
    BATASAN_ENDPOINT.buatOrder,
  );
  if (!cekBatas.boleh) {
    return balasGagal({
      type: "RATE_LIMITED",
      message: "Terlalu banyak permintaan. Coba lagi sebentar.",
    });
  }

  // 2. Baca body. Kalau body bukan JSON yang valid, zod akan menolaknya.
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
  const hasilValidasi = buatOrderSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { customerName, items, idempotencyKey } = hasilValidasi.data;

  // 4. Panggil fungsi database create_order.
  //    Perhatikan: hanya nama, item, dan idempotencyKey yang dikirim. Tidak ada
  //    harga atau total, karena itu dihitung ulang di database.
  const { data, error } = await getAdminClient().rpc("create_order", {
    p_customer_name: customerName,
    p_items: items,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    // Error dari fungsi database sudah berupa tipe error yang dikenal
    // (VALIDATION_FAILED, MENU_UNAVAILABLE, dll), jadi diubah oleh
    // balasDariErrorDatabase.
    return balasDariErrorDatabase(error, "create_order");
  }

  // 5. Berhasil. Hasil fungsi database masih bergaya snake_case (order_id,
  //    queue_number, ...), jadi diubah dulu ke camelCase sesuai
  //    docs/api-contract.md bagian 4 (orderId, queueNumber, ...). Kalau tidak
  //    diubah, browser membaca orderId yang kosong. Status 201 karena ada
  //    sumber daya baru (order).
  return balasOk(petakanHasilBuatOrder(data), 201);
}
