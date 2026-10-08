// File ini: route handler untuk /api/cashier/orders.
//
// File ini punya DUA handler (Next.js App Router membolehkan satu handler GET dan
// satu handler POST dalam satu file):
//   - GET  : daftar order HARI INI (zona WIB) untuk layar Cashier.
//   - POST : membuat order MANUAL oleh Cashier/Admin.
//
// Keduanya hanya untuk Cashier dan Admin. Admin boleh memakai keduanya sebagai
// cadangan kalau Cashier berhalangan (Order-flow.md bagian 7).
//
// CATATAN SOAL GET: fungsi list_orders belum dibuat di database (masih di daftar
// "ringkas saja" di api-contract.md bagian 3). Jadi untuk sementara route GET
// membaca langsung dari tabel memakai klien admin (kunci service role), yang
// melewati RLS.
//
// CATATAN SOAL ISI: layar Cashier BOLEH memuat harga dan pembayaran (berbeda
// dari layar Barista). Jadi data pembayaran ikut dikirim di GET.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
  balasValidasiGagal,
} from "@/lib/server/balas";
import { jagaPeranStaf, metaSesi } from "@/lib/server/jaga-peran";
import { orderManualSchema } from "@/lib/server/validasi";
import { petakanOrderManual } from "@/lib/server/petakan-hasil-fungsi";
import { wibToday } from "@/lib/server/wib-hari-ini";

export const dynamic = "force-dynamic";

// Parameter request tidak dipakai di handler GET (daftar order hanya untuk staf
// yang sudah login, jadi tidak perlu pembatas permintaan anonim), jadi ditulis
// dengan garis bawah depan agar ESLint tidak menegur.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  // 1. Penjagaan peran: hanya Cashier dan Admin. Belum login -> UNAUTHENTICATED.
  const jaga = await jagaPeranStaf(["cashier", "admin"], "daftar order");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Tentukan hari ini di zona WIB. queue_date pada tabel orders sudah
  //    memakai tanggal WIB, jadi cukup membandingkan dengan tanggal WIB ini.
  const hariIniWib = await wibToday();

  // 3. Ambil order hari ini beserta item dan pembayarannya.
  //    Daftar kolom dipilih eksplisit supaya tidak mengambil kolom yang tidak perlu.
  //    occurred_at dan is_manual_time ikut diambil karena Cashier perlu tahu
  //    order mana yang diinput_manual (Order-flow.md bagian 5).
  const { data: daftarOrder, error: errorOrder } = await getAdminClient()
    .from("orders")
    .select(
      "id, queue_number, queue_date, customer_name, source, status, total, created_at, confirmed_at, occurred_at, is_manual_time, order_items(name_snapshot, price_snapshot, qty, note, subtotal), payments(method, amount, voided_at)",
    )
    .eq("queue_date", hariIniWib)
    // Urutan supaya Cashier melihat antrean dari yang paling awal.
    .order("queue_number", { ascending: true });

  if (errorOrder) {
    return balasDariErrorDatabase(errorOrder, "daftar order cashier");
  }

  // 4. Ubah bentuk baris database menjadi bentuk yang lebih enak dibaca.
  const hasil = (daftarOrder ?? []).map((baris) => ({
    orderId: baris.id,
    queueNumber: baris.queue_number,
    queueDate: baris.queue_date,
    customerName: baris.customer_name,
    source: baris.source,
    status: baris.status,
    total: baris.total,
    createdAt: baris.created_at,
    confirmedAt: baris.confirmed_at,
    // Waktu kejadian order. Untuk order manual yang diinput belakangan, ini bisa
    // lebih lama dari created_at.
    occurredAt: baris.occurred_at,
    // true kalau occurred_at diisi manual (input belakangan), false kalau order
    // dibuat normal saat itu juga.
    isManualTime: baris.is_manual_time,
    items: Array.isArray(baris.order_items)
      ? baris.order_items.map((item) => ({
          name: item.name_snapshot,
          price: item.price_snapshot,
          qty: item.qty,
          note: item.note,
          subtotal: item.subtotal,
        }))
      : [],
    // Pembayaran hanya ada kalau order sudah dikonfirmasi. Pembayaran yang
    // sudah di-void (voided_at terisi) TIDAK ikut dihitung sebagai pembayaran
    // aktif, tapi tetap ditampilkan supaya Cashier tahu.
    payment:
      Array.isArray(baris.payments) && baris.payments.length > 0
        ? {
            method: baris.payments[0].method,
            amount: baris.payments[0].amount,
            voided: baris.payments[0].voided_at !== null,
          }
        : null,
  }));

  // 5. Sukses.
  return balasOk({ orders: hasil, queueDate: hariIniWib });
}

/**
 * Handler POST untuk membuat satu order manual oleh Cashier/Admin.
 *
 * Input: body { customerName, items, paymentMethod, occurredAt?, idempotencyKey }.
 * Output: { ok: true, data: { orderId, queueNumber, status, stockWarnings } }
 *         atau { ok: false, error }.
 */
export async function POST(request: NextRequest) {
  // 1. Penjagaan peran: hanya Cashier dan Admin. Belum login -> UNAUTHENTICATED;
  //    peran lain (mis. Barista) -> FORBIDDEN + access.denied dicatat.
  const jaga = await jagaPeranStaf(["cashier", "admin"], "order manual");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Baca body. Kalau bukan JSON, zod akan menolak.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasGagal({
      type: "VALIDATION_FAILED",
      message: "Body permintaan harus berupa JSON yang valid.",
    });
  }

  // 3. Validasi dengan zod (aturan di docs/api-contract.md bagian 2). Kalau
  //    gagal, balasValidasiGagal menyebut field yang salah.
  const hasilValidasi = orderManualSchema.safeParse(body);
  if (!hasilValidasi.success) {
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { customerName, items, paymentMethod, occurredAt, idempotencyKey } =
    hasilValidasi.data;

  // 4. Panggil fungsi database create_manual_order.
  //    p_actor_id: id staf yang menginput. p_meta: session_id kalau ada.
  //    occurredAt: kalau tidak dikirim, kirim null supaya database memakai waktu
  //    sekarang dan menandai is_manual_time = false.
  //
  //    Tipe hasil generate (database.types.ts) menuliskan p_occurred_at sebagai
  //    wajib string, padahal di database kolom itu menerima null. Karena itu
  //    argumennya di-cast, seperti yang juga dilakukan di src/lib/log.
  const { data, error } = await getAdminClient().rpc("create_manual_order", {
    p_customer_name: customerName,
    p_items: items,
    p_payment_method: paymentMethod,
    p_occurred_at: occurredAt ?? null,
    p_idempotency_key: idempotencyKey,
    p_actor_id: jaga.sesi.userId,
    p_meta: metaSesi(jaga.sesi),
  } as never);

  if (error) {
    // Error dari fungsi database sudah berupa tipe yang dikenal
    // (VALIDATION_FAILED, MENU_UNAVAILABLE, FORBIDDEN, dll), jadi diubah oleh
    // balasDariErrorDatabase. Yang non-INTERNAL tidak dicatat sebagai kegagalan
    // sistem (api-contract bagian 6).
    return balasDariErrorDatabase(error, "create_manual_order");
  }

  // 5. Sukses. Hasil fungsi database masih snake_case (order_id, queue_number,
  //    stock_warnings), jadi dipetakan dulu ke camelCase sesuai
  //    api-contract bagian 4. Status 201 karena ada sumber daya baru (order).
  return balasOk(petakanOrderManual(data), 201);
}
