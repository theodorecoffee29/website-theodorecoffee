// File ini: membuat klien Supabase untuk sisi browser (Client Component).
// Sesi login dibaca dan ditulis langsung oleh browser lewat cookie.
//
// Kenapa perlu file ini: sebagian interaksi (misalnya tombol keluar) bisa
// dijalankan langsung di browser. Untuk itu browser butuh klien sendiri.
//
// Catatan: klien ini memakai kunci publik (anon), bukan service role.
// Kunci publik boleh ada di kode browser karena akses datanya dibatasi RLS di
// database. Service role TIDAK BOLEH dipakai di file ini dan tidak pernah
// dikirim ke browser.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Dua variabel ini berawalan NEXT_PUBLIC_, jadi Next.js menyisipkan nilainya ke
// kode browser saat build. Kuncinya sendiri sudah diatur di src/lib/env.ts.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Membuat klien Supabase untuk browser.
 *
 * createBrowserClient sudah memakai pola singleton di dalamnya, jadi fungsi ini
 * aman dipanggil berkali-kali tanpa membuat banyak koneksi.
 */
export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Kesalahan ini muncul kalau .env.local belum diisi. Pesannya menyebutkan
    // nama variabelnya supaya mudah diperbaiki.
    throw new Error(
      "src/lib/supabase/client.ts: NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi.",
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
