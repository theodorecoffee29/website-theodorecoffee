// File ini: route handler GET /api/staff/stock.
//
// Tugasnya: mengembalikan ringkasan sisa stok untuk Cashier, Barista, dan Admin
// (hanya baca). Dipakai panel "Sisa stok" di layar Cashier dan Barista, supaya
// Cashier tahu sisa porsi tiap menu saat dua order bersaing untuk stok terakhir,
// dan Barista tahu sisa bahan saat menyiapkan pesanan
// (docs/pemissions.md bagian 2).
//
// Endpoint ini TIDAK memuat harga, total, maupun pembayaran. Layar Barista tidak
// boleh melihat data itu, dan panel ini dipakai Barista juga.
//
// Panggilannya memakai fungsi database get_stock_overview(p_actor_id) yang sudah
// memeriksa sendiri apakah perannya boleh (cashier, barista, admin, dan aktif).
// Penjagaan di route ini tetap dilakukan lebih dulu supaya peran yang tidak
// rightful tidak sampai menyentuh database, dan percobaannya tercatat sebagai
// access.denied (docs/logging.md bagian 2).

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
} from "@/lib/server/balas";
import { jagaPeranStaf } from "@/lib/server/jaga-peran";
import { PERAN_SISA_STOK, petakanSisaStok } from "@/lib/server/petakan-stok";

export const dynamic = "force-dynamic";

// Parameter request tidak dipakai: endpoint ini hanya untuk staf yang sudah
// login, jadi tidak perlu pembatas permintaan anonim.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  // 1. Penjagaan peran: hanya Cashier, Barista, dan Admin. Belum login ->
  //    UNAUTHENTICATED. Peran lain (atau customer yang menyamar) -> FORBIDDEN
  //    plus access.denied dicatat oleh jagaPeranStaf.
  const jaga = await jagaPeranStaf([...PERAN_SISA_STOK], "lihat sisa stok");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Panggil fungsi database dengan p_actor_id diisi id staf yang login.
  //    Peran dibaca ulang di dalam fungsi database dari tabel profiles, jadi
  //    nilai dari klien tidak pernah dipercaya.
  const { data, error } = await getAdminClient().rpc("get_stock_overview", {
    p_actor_id: jaga.sesi.userId,
  });

  if (error) {
    // FORBIDDEN dari database berarti datanya berubah di antara penjagaan route
    // dan pemanggilan fungsi (mis. akun dinonaktifkan). Penolakan bisnis normal
    // tidak dicatat sebagai kegagalan sistem.
    return balasDariErrorDatabase(error, "get_stock_overview");
  }

  // 3. Sukses. Angka dari kolom numeric database diubah ke angka, dan bentuknya
  //    dipetakan ke camelCase (docs/api-contract.md bagian 4).
  return balasOk(petakanSisaStok(data));
}
