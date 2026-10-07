// File ini: membaca dan memvalidasi environment variable aplikasi.
// Dipakai di sisi server saja. Nilainya diambil dari process.env (diisi oleh
// Next.js dari file .env.local). File ini TIDAK PERNAH dicetak/dibaca manual.
//
// Kenapa pakai zod: supaya ada satu tempat yang memastikan semua variabel yang
// dibutuhkan ada dan tidak kosong. Kalau ada yang kurang, aplikasi berhenti
// dengan pesan yang menyebut NAMA variabel yang kurang, bukan error kabur.
//
// Kenapa import "server-only": file ini memegang kunci rahasia
// (SUPABASE_SERVICE_ROLE_KEY). Paket ini membuat build Next.js gagal kalau file
// ini ikut terbawa ke kode browser. Ini pengaman supaya kunci rahasia tidak
// pernah sampai ke klien.

import "server-only";

import { z } from "zod";

// Skema: satu tempat yang menyatakan bentuk dan aturan setiap variabel.
// z.string().min(1) berarti harus berupa teks dengan panjang minimal 1 karakter,
// jadi string kosong dianggap kurang.
const envSchema = z.object({
  // URL project Supabase, boleh dibaca di browser juga karena pakai awalan
  // NEXT_PUBLIC_. Contoh: https://abcdefghijkl.supabase.co
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "tidak boleh kosong"),

  // Kunci publik (anon / publishable key) Supabase. Relatif aman untuk kode
  // klien karena akses datanya dibatasi RLS.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "tidak boleh kosong"),

  // Kunci service role Supabase. INI RAHASIA: hanya boleh dipakai di server.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "tidak boleh kosong"),
});

/**
 * Environment variable yang sudah tervalidasi.
 *
 * Cara kerja: parse(process.env) mengembalikan hasil valid atau objek berisi
 * daftar kesalahan. Di sini:
 *   - kalau berhasil, simpan hasilnya ke variabel module `env`.
 *   - kalau gagal, lempar Error dengan pesan yang menyebut NAMA variabel
 *     yang kurang, lalu hentikan proses (throw).
 * Nama variabel ikut ditulis di pesan supaya mudah dicari, sementara nilainya
 * sendiri TIDAK ikut dicetak supaya kunci rahasia tidak bocor.
 */
function parseEnv() {
  const hasilParse = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!hasilParse.success) {
    // Kumpulkan NAMA variabel yang kurang atau salah. Kita sengaja hanya
    // menulis nama field-nya, bukan nilai yang dikembalikan zod, supaya isi
    // kunci rahasia tidak pernah ikut tampil di pesan error.
    const namaYangKurang = hasilParse.error.issues
      .map((masalah) => masalah.path.join("."))
      .filter(Boolean);

    const daftarNama = [...new Set(namaYangKurang)].join(", ");

    throw new Error(
      "src/lib/env.ts: environment variable berikut belum diisi atau tidak valid: " +
        daftarNama +
        ". Salin .env.example menjadi .env.local lalu lengkapi nilainya.",
    );
  }

  return hasilParse.data;
}

// Hasil validasi disimpan satu kali saat file ini diimpor, lalu dipakai ulang.
// "const" dipakai supaya nilainya tidak bisa diubah diam-diam oleh file lain.
export const env = parseEnv();
