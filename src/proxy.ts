// File ini: proxy untuk Next.js 16 (sebelumnya bernama middleware).
//
// Tugasnya hanya dua:
//   1. Menyegarkan cookie sesi Supabase supaya login tidak cepat kedaluwarsa.
//   2. Mengarahkan pengguna yang belum login ke /login sebelum sempat melihat
//      halaman peran.
//
// PENTING: file ini BUKAN penjaga utama. Proteksi peran yang sebenarnya
// dilakukan di server oleh setiap halaman peran, lewat wajibPeran() di
// src/lib/auth/session.ts. Alasannya, proxy adalah lapisan jaringan yang bisa
// dilewati, dan pola membagi tanggung jawab seperti ini juga yang disarankan
// dokumentasi Next.js. Kalau proteksi hanya ada di sini, membuka alamat halaman
// secara langsung bisa melewatinya.
//
// Catatan versi: di Next.js 16, konvensi middleware.ts sudah diganti menjadi
// proxy.ts dan nama fungsinya menjadi proxy. Versi Next.js yang terpasang di
// proyek ini memakai konvensi yang baru itu.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HALAMAN_PERAN } from "@/lib/auth/roles";

// Variabel yang boleh dipakai di proxy. Proxy berjalan di server, jadi boleh
// membaca env. Kita membaca langsung dari process.env (bukan dari src/lib/env.ts)
// karena env.ts memakai paket "server-only" yang tidak perlu di sini.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Halaman yang butuh login. Sesuai dengan halaman peran yang dilindungi.
const protectedPrefixes = HALAMAN_PERAN;

/**
 * Fungsi proxy untuk setiap permintaan yang cocok dengan config.matcher di bawah.
 *
 * Alur sederhana:
 *   1. Siapkan respons.
 *   2. Buat klien Supabase yang membaca cookie dari permintaan ini.
 *   3. Panggil getClaims() supaya token diperbarui bila perlu. Pemanggilan ini
 *      juga menulis cookie sesi yang baru ke respons.
 *   4. Kalau pengguna belum login dan sedang membuka halaman peran, arahkan ke
 *      /login.
 */
export async function proxy(request: NextRequest) {
  // supabaseResponse dibuat ulang di dalam setAll setiap kali Supabase perlu
  // menulis cookie baru. Karena itu variabelnya pakai let, dan nilai terakhirnya
  // yang dikembalikan di akhir fungsi ini.
  let supabaseResponse = NextResponse.next({ request });

  // Kalau env belum diisi, lewati saja (proxy tidak boleh menjatuhkan aplikasi).
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Buat respons baru yang membawa cookie permintaan yang sama, lalu
        // tulis semua cookie sesi yang diperbarui ke respons itu. Supabase
        // memanggil setAll ini hanya ketika token benar-benar perlu disegarkan.
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // Panggil getClaims() dan tunggu hasilnya. Pemanggilan inilah yang menyegarkan
  // token bila hampir kedaluwarsa, sekaligus memberi tahu apakah ada sesi.
  // claims hanya terisi kalau tokennya benar-benar terverifikasi.
  // data bisa null kalau tidak ada sesi sama sekali, jadi dijaga.
  const { data } = await supabase.auth.getClaims();
  const adaSesi = Boolean(data && data.claims);

  const url = request.nextUrl;

  // Belum login dan sedang membuka halaman peran: arahkan ke /login.
  const sedangBukaHalamanPeran = protectedPrefixes.some(
    (prefix) =>
      url.pathname === prefix || url.pathname.startsWith(prefix + "/"),
  );

  if (!adaSesi && sedangBukaHalamanPeran) {
    const redirectUrl = url.clone();
    redirectUrl.pathname = "/login";
    // Buang query string asal supaya tidak ada parameter lain ikut terbawa.
    redirectUrl.search = "";

    const responsRedirect = NextResponse.redirect(redirectUrl);

    // Respons redirect adalah objek baru, jadi cookie yang mungkin baru saja
    // disegarkan harus disalin ke sini satu per satu. Tanpa ini, sesi bisa
    // hilang setiap kali pengguna diarahkan ke halaman login.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      responsRedirect.cookies.set(cookie);
    }

    return responsRedirect;
  }

  return supabaseResponse;
}

/**
 * Menentukan permintaan mana yang perlu diproses oleh proxy.
 *
 * Kita memproses semua halaman, TIDAK hanya halaman peran, karena tugas proxy
 * juga menyegarkan cookie sesi. Penyegaran harus berjalan di mana pun supaya
 * login tidak ikut kedaluwarsa saat pengguna berpindah halaman.
 */
export const config = {
  // Kecualikan berkas statis dan gambar supaya tidak memboroskan kerja.
  matcher: [
    /*
     * Semua permintaan KECUALI:
     * - _next/static, _next/image (berkas hasil build)
     * - favicon.ico dan berkas gambar
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
