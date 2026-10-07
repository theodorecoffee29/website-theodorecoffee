// File ini: membuat satu klien Supabase untuk sisi server memakai kunci service
// role (rahasia). Klien ini dipakai server untuk memanggil fungsi database
// seperti get_menu, create_order, confirm_order, dan untuk menulis ke tabel log.
//
// Kenapa memakai kunci service role: semua tabel proyek ini menolak akses
// secara default (RLS), dan fungsi database yang kritis (konfirmasi order,
// pencatatan log) hanya boleh dipanggil server yang memegang kunci rahasia ini,
// bukan browser.
//
// Kenapa import "server-only" di paling atas: paket ini membuat build Next.js
// gagal kalau file ini ikut terbawa ke kode browser. Karena file ini memegang
// kunci service role, ini pengaman terakhir supaya kunci rahasia tidak pernah
// sampai ke klien.
//
// Catatan penting: kunci service role melewati RLS, jadi hasilnya tidak boleh
// langsung dikirim ke browser tanpa memeriksa perannya dulu.

import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { env } from "../env";

/**
 * Membuat klien Supabase baru dengan kunci service role.
 *
 * auth.persistSession: false dan autoRefreshToken: false karena klien ini
 * dipakai di server, bukan di browser, jadi tidak ada sesi yang perlu disimpan
 * atau disegarkan.
 *
 * Tipe Database dari database.types.ts dipasang supaya TypeScript tahu nama
 * tabel, kolom, dan fungsi database yang boleh dipanggil.
 */
export function createAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

// Variabel untuk menyimpan satu instance saja.
let adminClient: ReturnType<typeof createAdminClient> | null = null;

/**
 * Mengembalikan klien admin yang sama setiap kali dipanggil (singleton).
 *
 * Kenapa perlu: membuat klien berulang-ulang tidak baik untuk koneksi.
 */
export function getAdminClient() {
  if (adminClient === null) {
    adminClient = createAdminClient();
  }
  return adminClient;
}
