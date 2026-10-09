// File ini: route handler GET /api/admin/ingredients/[id]/movements.
//
// Tugasnya: menampilkan riwayat pergerakan stok satu bahan, terbaru dulu,
// maksimal 100 baris (docs/api-contract.md bagian 4b).
//
// PERAN: hanya Admin.
//
// CATATAN SOAL ISI: riwayat pergerakan BOLEH memuat order_id, karena layar ini
// hanya untuk Admin. Ini berbeda dari layar Barista dan Cashier yang tidak boleh
// melihat harga maupun pembayaran (docs/pemissions.md bagian 2).

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { balasGagal, balasOk } from "@/lib/server/balas";
import { balasDariErrorAdmin } from "@/lib/server/balas-admin";
import { cekIdAlamat } from "@/lib/server/cek-id-alamat";
import { jagaPeranAdmin } from "@/lib/server/jaga-admin";
import { petakanPergerakan } from "@/lib/server/petakan-admin";

export const dynamic = "force-dynamic";

// Batas jumlah baris riwayat yang dikirim. Docs menetapkan maksimal 100.
const MAKSIMAL_BARIS = 100;

/**
 * Handler GET: riwayat pergerakan stok satu bahan.
 *
 * Input: id bahan dari parameter alamat.
 * Output: { ok: true, data: { movements: [...] } } atau { ok: false, error }.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Admin.
  const jaga = await jagaPeranAdmin("riwayat pergerakan stok");
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil id dari alamat, lalu periksa formatnya sebelum menyentuh database.
  const { id } = await params;
  const cekId = cekIdAlamat(id, "ingredientId");
  if (cekId !== null) {
    return cekId;
  }

  // 3. Ambil riwayat pergerakan bahan ini, terbaru dulu dan dibatasi 100 baris.
  //    created_at diurutkan menurun, lalu id sebagai pemutus supaya dua
  //    pergerakan dengan waktu yang sama tidak saling bertukar tempat.
  const { data, error } = await getAdminClient()
    .from("stock_movements")
    .select("id, type, qty_change, stock_after, created_at, order_id, note")
    .eq("ingredient_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MAKSIMAL_BARIS);

  if (error) {
    return balasDariErrorAdmin(error, "riwayat pergerakan stok");
  }

  // 4. Ubah nama kolom database (snake_case) menjadi camelCase.
  const hasil = petakanPergerakan(data ?? []);

  return balasOk({ movements: hasil });
}
