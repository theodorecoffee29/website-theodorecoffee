// File ini: route handler GET /api/barista/queue.
//
// Tugasnya: menampilkan antrean untuk layar Barista, yaitu order yang sudah
// dikonfirmasi (status "antrean") dan yang sedang dibuat ("dikerjakan"),
// diurutkan dari waktu konfirmasi paling awal.
//
// PERAN: hanya Barista. Cashier dan Admin tidak boleh memakai endpoint ini
// (Admin sengaja tidak memakai tombol Mulai/Selesai, docs/pemissions.md bagian 6).
//
// KEAMANAN OUTPUT: layar Barista TIDAK BOLEH memuat harga, total, atau data
// pembayaran (docs/pemissions.md bagian 2). Karena itu hasil query TIDAK
// langsung dikirim; ia diteruskan ke petakanAntreanBarista() yang membangun
// objek baru hanya berisi orderId, queueNumber, customerName, items (name, qty,
// note), dan status.(select di bawah sengaja tidak mengambil kolom harga sama
// sekali, sebagai lapisan pengaman kedua.)

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
} from "@/lib/server/balas";
import { jagaPeranStaf } from "@/lib/server/jaga-peran";
import { petakanAntreanBarista } from "@/lib/server/petakan-antrean";

export const dynamic = "force-dynamic";

// Parameter request tidak dipakai di sini (antrean tidak butuh pembatas
// permintaan anonim karena endpoint ini hanya untuk staf yang sudah login),
// jadi ditulis dengan garis bawah depan agar ESLint tidak menegur.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  // 1. Penjagaan peran: hanya Barista.
  const jaga = await jagaPeranStaf(["barista"], "antrean barista");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil order yang sudah dikonfirmasi atau sedang dibuat.
  //    Select hanya kolom yang boleh tampil (tanpa harga/pembayaran).
  //    Diurutkan dari confirmed_at paling awal supaya order yang lebih dulu masuk
  //    antrean dikerjakan lebih dulu (docs/order-flow.md bagian 4).
  const { data: antrean, error } = await getAdminClient()
    .from("orders")
    .select(
      "id, queue_number, customer_name, status, order_items(name_snapshot, qty, note)",
    )
    .in("status", ["antrean", "dikerjakan"])
    .order("confirmed_at", { ascending: true });

  if (error) {
    return balasDariErrorDatabase(error, "antrean barista");
  }

  // 3. Petakan ke bentuk yang aman untuk Barista (tidak ada harga/pembayaran).
  const hasil = petakanAntreanBarista(antrean ?? []);

  // 4. Sukses.
  return balasOk({ orders: hasil });
}
