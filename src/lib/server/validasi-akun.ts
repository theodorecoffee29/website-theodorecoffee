// File ini: aturan validasi input untuk route handler kelola akun
// (/api/admin/accounts/...).
//
// File ini MURNI (tidak memakai database maupun Supabase), jadi aturan validasi
// bisa diuji dengan cepat tanpa database.
//
// ATURAN AMBIL DARI TUGAS INI DAN DOKUMEN:
//   - Nama akun: wajib, 1-50 karakter setelah spasi pinggir dipangkas.
//   - Email: format email valid, dipangkas, dan disimpan huruf kecil. Huruf kecil
//     supaya "Budi@x.com" dan "budi@x.com" dianggap akun yang sama, yang
//     layanan di Supabase juga membandingkan email tanpa membedakan huruf besar.
//   - Peran: hanya "cashier" atau "barista". Peran "admin" SENGAJA tidak diterima di
//     sini, jadi tidak ada jalan untuk membuat akun admin lewat halaman ini.
//     Akun admin pertama dibuat manual di Supabase (docs/permissions.md bagian 1).
//   - Password: minimal 10 karakter, harus memuat huruf dan angka, dan tidak boleh
//     sama dengan email. Docs/permissions.md bagian 5 menyebut "Password minimal
//     panjang tertentu"; angka 10 dan syarat huruf+angkaputuskan di tugas ini.
//
// PENTING SOAL PASSWORD: nilai password hanya dipakai di file ini untuk DIUKUR,
// tidak pernah disimpan, tidak pernah dicatat, dan tidak pernah dikirim balik ke
// browser (lihat catatan di src/lib/server/kelola-akun.ts).

import { z } from "zod";

// Batas panjang nama akun.
export const MAKSIMAL_NAMA_AKUN = 50;

// Panjang password minimum.
//
// Kenapa 10: password ini dibuat orang (bukan otomatis) dan sering dipampang di
// kertas untuk booth, jadi harus cukup panjang. Syarat huruf DAN angka membuat
// password seperti "aaaaaaaaaaaa" tidak bisa dipakai.
export const MINIMAL_PASSWORD_AKUN = 10;

/**
 * Skema nama akun.
 *
 * Dipangkas dulu (trim) baru diukur panjangnya, supaya spasi di awal atau akhir
 * tidak ikut terhitung dan nama yang isinya cuma spasi dianggap kosong.
 */
const namaSchema = z
  .string("Nama wajib diisi.")
  .trim()
  .min(1, "Nama wajib diisi.")
  .max(MAKSIMAL_NAMA_AKUN, `Nama maksimal ${MAKSIMAL_NAMA_AKUN} karakter.`);

/**
 * Skema email.
 *
 * Urutannya penting: .trim() dan .toLowerCase() harus SEBELUM .email(), supaya
 * pemeriksaan formatnya menerima "  Budi@X.com  " dan menghasilkan "budi@x.com".
 */
const emailSchema = z
  .string("Email wajib diisi.")
  .trim()
  .toLowerCase()
  .email("Format email tidak valid.");

/**
 * Skema peran.
 *
 * Hanya cashier dan barista. Admin tidak termasuk, dan itu disengaja: halaman ini
 * untuk mengelola akun Cashier dan Barista (docs/permissions.md bagian 2), dan
 * Admin tidak boleh membuat akun admin baru lewat sini.
 */
const peranSchema = z.enum(["cashier", "barista"], {
  message: "Peran harus cashier atau barista.",
});

/**
 * Skema password.
 *
 * Aturannya:
 *   1. Panjang minimal 10 karakter.
 *   2. Harus memuat minimal satu huruf (huruf besar atau kecil).
 *   3. Harus memuat minimal satu angka.
 *
 * Kenapa ".refine" dipakai dan bukan regex: pesannya bisa menjelaskan aturan
 * dengan bahasa manusia, sehingga pesan di layar Admin jelas.
 */
const passwordSchema = z
  .string("Password wajib diisi.")
  .min(
    MINIMAL_PASSWORD_AKUN,
    `Password minimal ${MINIMAL_PASSWORD_AKUN} karakter.`,
  )
  .refine((nilai) => /[A-Za-z]/.test(nilai), {
    message: "Password harus memuat minimal satu huruf.",
  })
  .refine((nilai) => /[0-9]/.test(nilai), {
    message: "Password harus memuat minimal satu angka.",
  });

/** POST /api/admin/accounts: membuat akun baru. */
export const buatAkunSchema = z
  .object({
    name: namaSchema,
    email: emailSchema,
    role: peranSchema,
    password: passwordSchema,
  })
  // Aturan "password tidak boleh sama dengan email" memakai DUA field, jadi harus
  // diperiksa di tingkat objek, bukan di tingkat satu field.
  //
  // Kenapa aturan ini ada: kalau password sama persis dengan email, siapa pun yang
  // melihat email (mis. Admin, atau pesan otomatis) bisa langsung masuk ke akun itu.
  // Perbandingan tidak membedakan huruf besar-kecil, karena password juga tidak.
  .refine((data) => data.password.toLowerCase() !== data.email.toLowerCase(), {
    message: "Password tidak boleh sama dengan email.",
    path: ["password"],
  });

/** PATCH /api/admin/accounts/[id]: mengubah nama dan peran. */
export const ubahAkunSchema = z.object({
  name: namaSchema,
  role: peranSchema,
});

/**
 * POST /api/admin/accounts/[id]/active: mengaktifkan atau menonaktifkan akun.
 *
 * Tidak ada nilai bawaan: server harus tahu Admin memang memilih status ini.
 */
export const ubahStatusAkunSchema = z.object({
  isActive: z.boolean("isActive harus true atau false."),
});

/** POST /api/admin/accounts/[id]/password: menyetel password baru. */
export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

/**
 * Skema id akun dari parameter alamat.
 *
 * Id dicek SEBELUM database disentuh. Id yang bukan uuid tidak mungkin ada, jadi
 * jawabannya sama dengan "akun tidak ditemukan" dan tidak dicatat ke error_logs
 * (docs/api-contract.md bagian 6).
 */
export const akunIdSchema = z.object({
  id: z.string().uuid("id akun harus berupa uuid yang valid."),
});

// Bentuk hasil setelah validasi, supaya nilai yang sudah dipangkas dan huruf kecil
// ikut terbawa ke route.
export type BuatAkunValidasi = z.infer<typeof buatAkunSchema>;
export type UbahAkunValidasi = z.infer<typeof ubahAkunSchema>;
export type ResetPasswordValidasi = z.infer<typeof resetPasswordSchema>;
