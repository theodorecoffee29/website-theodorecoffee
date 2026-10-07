// File ini: membuat klien Supabase untuk sisi server (Server Component,
// Server Action, Route Handler). Sesi login dibaca dan ditulis lewat cookie.
//
// Kenapa perlu file ini: sesi login disimpan di cookie, bukan di localStorage,
// supaya sesi ikut terbaca ketika halaman dirender di server. Kalau sesi hanya
// disimpan di browser, server selalu menganggap pengguna belum login setiap kali
// halaman dibuka.
//
// Kenapa memakai kunci publik (anon) dan bukan service role: kode ini berjalan
// sebagai pengguna yang sedang login. Kalau memakai service role, setiap orang
// otomatis menjadi admin, dan itu melanggar docs/pemissions.md. Service role
// hanya dipakai di src/lib/log dan src/lib/supabase/admin.ts.

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { env } from "../env";

/**
 * Membuat klien Supabase sisi server yang terhubung ke sesi login pengguna.
 *
 * Cara kerja:
 *   - getAll: membaca cookie sesi milik permintaan yang sedang berjalan.
 *   - setAll: dipakai Supabase saat perlu menulis cookie baru, misalnya setelah
 *     token diperbarui. Server Component tidak boleh menulis cookie, jadi
 *     kegagalan di sini sengaja diabaikan. Penulisan cookie yang sebenarnya
 *     dilakukan di src/proxy.ts pada setiap permintaan.
 *
 * Catatan: fungsi ini hanya boleh dipanggil dari Server Component, Server
 * Action, atau Route Handler, karena hanya konteks itu yang boleh membaca cookie.
 */
export async function createSupabaseServerClient() {
  // Di Next.js 15 ke atas, cookies() harus di-await.
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component tidak bisa menulis cookie. Ini sudah diharapkan,
            // dan cookie yang sebenarnya ditulis oleh proxy.ts. Karena itu
            // error di sini sengaja ditelan agar halaman tidak gagal.
          }
        },
      },
    },
  );
}
