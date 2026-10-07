// File ini: route handler GET /api/cashier/orders.
//
// Tugasnya: menampilkan daftar order HARI INI (zona WIB) untuk layar Cashier,
// lengkap dengan item, total, source, status, dan pembayaran.
//
// Kenapa membaca dari tabel dan bukan lewat fungsi database: fungsi
// list_orders belum dibuat di database (masih di daftar "ringkas saja" di
// api-contract.md bagian 3). Jadi untuk sementara route ini membaca langsung
// dari tabel memakai klien admin (kunci service role), yang melewati RLS.
//
// Peran: hanya Cashier dan Admin. Admin boleh memakai ini sebagai cadangan kalau
// Cashier berhalangan (order-flow.md bagian 7). Penjagaan dilakukan server-side
// lewat jagaPeranStaf SEBELUM menyentuh database.
//
// Catatan layar Cashier BOLEH memuat harga dan pembayaran (berbeda dari layar
// Barista). Jadi data pembayaran ikut dikirim di sini.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
} from "@/lib/server/balas";
import { jagaPeranStaf } from "@/lib/server/jaga-peran";
import { wibToday } from "@/lib/server/wib-hari-ini";

export const dynamic = "force-dynamic";

// Parameter request tidak dipakai di sini (daftar order hanya untuk staf yang
// sudah login, jadi tidak perlu pembatas permintaan anonim), jadi ditulis
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
  const { data: daftarOrder, error: errorOrder } = await getAdminClient()
    .from("orders")
    .select(
      "id, queue_number, queue_date, customer_name, source, status, total, created_at, confirmed_at, order_items(name_snapshot, price_snapshot, qty, note, subtotal), payments(method, amount, voided_at)",
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
