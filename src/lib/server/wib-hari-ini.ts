// File ini: mendapat tanggal hari ini di zona waktu WIB (Asia/Jakarta).
//
// Kenapa perlu: tanggal di tabel orders (queue_date) dihitung dengan zona WIB,
// dan "hari" untuk laporan dan antrean juga WIB (docs/data-model.md bagian 3).
// Kalau server memakai tanggal lokal (biasanya UTC di Vercel), tanggalnya bisa
// berbeda 7 jam dari yang dipakai customer, sehingga daftar order "hari ini"
// bisa salah.
//
// Cara kerja: (now() at time zone 'Asia/Jakarta') mengubah waktu UTC dari
// database menjadi waktu Jakarta, lalu diambil bagian tanggalnya saja.

import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Mengembalikan tanggal hari ini di zona WIB sebagai teks "YYYY-MM-DD".
 *
 * Output: string tanggal, contoh "2026-10-07". String ini bisa langsung
 *         dibandingkan dengan kolom queue_date (tipe date) di database.
 *
 * Kenapa memakai fungsi database wib_today dan bukan menghitungnya di
 * JavaScript: supaya timezone-nya benar-benar sama dengan yang dipakai saat
 * nomor antrean dibuat, sehingga tanggal yang dicari tidak pernah meleset.
 *
 * Catatan: fungsi ini dipakai untuk MEMBACA daftar order, bukan untuk membuat
 * order (pembuatan order memakai wib_today di dalam fungsi database). Kalau
 * pemanggilan ini gagal, fungsi mengembalikan tanggal UTC sebagai cadangan
 * supaya halaman tetap bisa terbuka, dan kegagalan dicatat ke console.error.
 */
export async function wibToday(): Promise<string> {
  const { data, error } = await getAdminClient().rpc("wib_today");

  if (error || typeof data !== "string") {
    console.error(
      "[src/lib/server/wib-hari-ini] gagal memanggil wib_today: " +
        (error ? error.message : "balasan bukan teks"),
    );

    // Cadangan: pakai tanggal UTC. Ini mungkin meleset beberapa jam dari WIB,
    // tapi lebih baik daripada halaman Cashier tidak bisa dibuka sama sekali.
    return new Date().toISOString().slice(0, 10);
  }

  return data;
}
