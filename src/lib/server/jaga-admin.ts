// File ini: penjaga akses untuk endpoint Admin (/api/admin/...).
//
// Alasan file ini ada terpisah dari jagaPeranStaf: endpoint Admin HANYA boleh
// dipakai admin (docs/pemissions.md bagian 2: Cashier dan Barista tidak boleh
// mengelola menu, resep, dan stok). Menulis ["admin"] langsung di setiap route
// berisiko terlewat di satu tempat, jadi aturan "hanya admin" dikumpulkan di sini.
//
// Cara kerjanya sama dengan penjaga peran lain:
//   1. Baca sesi dari cookie lewat ambilSesiStaf(). Fungsi itu sudah memverifikasi
//      token dan mengecek akun aktif.
//   2. Belum login -> UNAUTHENTICATED (401).
//   3. Peran bukan admin -> FORBIDDEN (403), dan access.denied dicatat lewat
//      logActivity supaya Admin bisa melihat siapa yang mencoba
//      (docs/logging.md bagian 2).
//   4. Lolos -> mengembalikan sesi, supaya route bisa mengirim p_actor_id dan
//      p_meta ke fungsi database.
//
// CATATAN: penjagaan di route handler BUKAN pengganti penjagaan di database.
// Fungsi database juga memanggil require_admin, jadi ada dua lapis. Ini wajib,
// karena setiap route handler bisa dipanggil langsung dari luar browser.

import { jagaPeranStaf, metaSesi } from "@/lib/server/jaga-peran";
import type { SesiStaf } from "@/lib/auth/session";

// Hasil penjagaan Admin: kalau diizinkan, iface berisi sesi staf.
export type HasilJagaAdmin =
  | { diizinkan: true; sesi: SesiStaf }
  | { diizinkan: false; tipe: "UNAUTHENTICATED" | "FORBIDDEN"; pesan: string };

/**
 * Memeriksa apakah yang sedang login boleh memakai endpoint Admin.
 *
 * Input: nama endpoint, hanya untuk pesan access.denied.
 *         Contoh: "buat menu", "ubah resep".
 * Output: HasilJagaAdmin.
 *
 * Cara kerja: memakai penjaga peran yang sama dengan endpoint staf lain, tapi
 * daftar peran yang diizinkan hanya "admin".
 */
export async function jagaPeranAdmin(
  namaEndpoint: string,
): Promise<HasilJagaAdmin> {
  return jagaPeranStaf(["admin"], namaEndpoint);
}

/**
 * Membentuk objek meta untuk fungsi database dari sesi Admin.
 *
 * Input: sesi Admin.
 * Output: objek meta berisi session_id kalau tersedia.
 *
 * Dipakai ulang dari penjaga peran yang sudah ada, supaya semua endpoint staf
 * dan admin mengirim bentuk meta yang sama (dokumentasi logging bagian 3: satu
 * akun bisa dipakai di beberapa laptop, jadi session_id dipakai untuk
 * membedakan).
 */
export { metaSesi };
