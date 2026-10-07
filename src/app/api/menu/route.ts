// File ini: route handler GET /api/menu.
//
// Tugasnya: mengembalikan daftar menu aktif beserta status ketersediaannya,
// dengan memanggil fungsi database get_menu. Bisa dipanggil siapa saja
// (anonim), karena melihat menu bukan hal sensitif.
//
// Pemanggilan fungsi database memakai klien admin (kunci service role). Fungsi
// get_menu sudah dikunci hanya untuk service_role di level database, jadi hanya
// server yang bisa memanggilnya, bukan browser secara langsung.

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

// Route ini tidak boleh di-cache, supaya daftar menu selalu terbaru.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Pembatas permintaan supaya satu orang tidak bisa mengambil menu tanpa batas.
  // Kuncinya memakai awalan "menu" supaya penghitungnya terpisah dari endpoint
  // lain untuk alamat IP yang sama.
  const cekBatas = periksaPembatas(
    "menu:" + ambilIpPemanggil(request),
    Date.now(),
    BATASAN_ENDPOINT.menu,
  );
  if (!cekBatas.boleh) {
    return balasGagal({
      type: "RATE_LIMITED",
      message: "Terlalu banyak permintaan. Coba lagi sebentar.",
    });
  }

  // Panggil fungsi database get_menu.
  const { data, error } = await getAdminClient().rpc("get_menu");

  if (error) {
    return balasDariErrorDatabase(error, "get_menu");
  }

  // Data dari fungsi sudah berbentuk { items: [...] }.
  return balasOk(data);
}
