// File ini: route handler POST /api/cashier/orders/[id]/cancel.
//
// Tugasnya: Cashier/Admin membatalkan order. Memanggil fungsi database
// cancel_order dengan p_actor_id diisi id staf yang membatalkan.
//
// Peran: hanya Cashier dan Admin. Cashier/Admin boleh membatalkan saat status
// menunggu_konfirmasi ATAU antrean (docs/order-flow.md bagian 3). Barista tidak
// boleh, dan tidak punya endpoint ini.
//
// Body: { reason, note? }. Alasan WAJIB karena Cashier/Admin yang memutuskan
// (docs/order-flow.md bagian 6 acceptance criteria 22), dan alasan "lainnya"
// wajib memakai note. Catatan alasan disimpan dan ikut ditampilkan ke customer
// di halaman statusnya.
//
// CATATAN: endpoint pembatalan oleh CUSTOMER (/api/orders/[id]/cancel) tidak
// memakai body dan tidak mengirim alasan. Alasannya diisi database sebagai
// "diminta_customer" supaya customer tidak perlu memilih alasan dari halamannya.

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  balasDariErrorDatabase,
  balasGagal,
  balasOk,
  balasOrderTidakDitemukan,
  balasValidasiGagal,
} from "@/lib/server/balas";
import { jagaPeranStaf, metaSesi } from "@/lib/server/jaga-peran";
import { batalOrderSchema } from "@/lib/server/validasi";
import { petakanHasilBatal } from "@/lib/server/petakan-hasil-fungsi";
import { apakahUuidValid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

/**
 * Handler POST untuk membatalkan satu order oleh staf (Cashier/Admin).
 *
 * Input: id order dari parameter alamat ([id]) dan body { reason, note? }.
 * Output: { ok: true, data: { status: "dibatalkan" } } atau { ok: false, error }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Penjagaan peran: hanya Cashier dan Admin.
  const jaga = await jagaPeranStaf(
    ["cashier", "admin"],
    "batalkan order (staf)",
  );
  if (!jaga.diizinkan) {
    return balasGagal({ type: jaga.tipe, message: jaga.pesan });
  }

  // 2. Ambil id order dari alamat.
  const { id } = await params;

  // 3. Id yang bukan uuid ditolak sebelum menyentuh database (bukan kegagalan
  //    sistem, jadi tidak dicatat di error_logs).
  if (!apakahUuidValid(id)) {
    return balasOrderTidakDitemukan();
  }

  // 4. Baca dan validasi body. Alasan pembatalan wajib diisi, jadi body kosong
  //    ditolak di sini, bukan sampai ke database.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return balasGagal({
      type: "VALIDATION_FAILED",
      message: "Body permintaan harus berupa JSON yang valid.",
    });
  }

  const hasilValidasi = batalOrderSchema.safeParse(body);
  if (!hasilValidasi.success) {
    // balasValidasiGagal menyebut field yang salah, sesuai api-contract bagian 6.
    return balasValidasiGagal(hasilValidasi.error.issues);
  }

  const { reason, note } = hasilValidasi.data;

  // 5. Panggil fungsi database cancel_order dengan ARGUMEN BERNAMA.
  //
  //    Kenapa harus named: urutan parameter fungsi database (p_order_id,
  //    p_actor_id, p_reason, p_note, p_meta) boleh berubah di migrasi
  //    berikutnya. Dengan menyebut nama, pemanggilan ini tidak ikut rusak.
  //
  //    note dikirim apa adanya. Kalau tidak dikirim, kirim null: database yang
  //    mengubahnya menjadi null, bukan string kosong.
  //
  //    Tipe hasil generate (database.types.ts) menuliskan kolom yang boleh kosong
  //    sebagai wajib, padahal di database kolom itu menerima null. Karena itu
  //    argumennya di-cast, seperti pada route pembatalan customer.
  const { data, error } = await getAdminClient().rpc("cancel_order", {
    p_order_id: id,
    p_actor_id: jaga.sesi.userId,
    p_reason: reason,
    p_note: note ?? null,
    p_meta: metaSesi(jaga.sesi),
  } as never);

  if (error) {
    // Kalau order sudah dikerjakan/selesai/dibatalkan, fungsi mengembalikan
    // ORDER_STATUS_CHANGED. Kalau alasan atau catatannya tidak diterima,
    // fungsinya mengembalikan VALIDATION_FAILED. Keduanya penolakan bisnis
    // normal, jadi pesan ramahnya diteruskan apa adanya ke Cashier dan tidak
    // dicatat sebagai kegagalan sistem.
    return balasDariErrorDatabase(error, "cancel_order (staf)");
  }

  // Sukses. Hasil fungsi database dipetakan ke bentuk camelCase
  // (docs/api-contract.md bagian 4) supaya semua route konsisten.
  return balasOk(petakanHasilBatal(data));
}
