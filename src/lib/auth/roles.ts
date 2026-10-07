// File ini: aturan murni soal peran dan halaman. TIDAK ADA database, TIDAK ADA
// Supabase, TIDAK ADA React di sini, semuanya fungsi biasa.
//
// Kenapa dipisah: aturan "peran mana boleh buka halaman mana" itu penting dan
// mudah salah. Kalau aturannya murni, kita bisa mengujinya dengan cepat untuk
// semua kombinasi peran dan halaman tanpa perlu server.
//
// Aturan ini dipakai dua tempat:
//   1. src/proxy.ts, untuk mengarahkan pengguna yang belum login.
//   2. Setiap halaman peran, untuk MENOLAK akses di sisi server. Pengecekan di
//      halaman inilah yang benar-benar ditegakkan (proxy hanya pengarah).

import { z } from "zod";

// Peran yang ada di aplikasi ini (harus sama dengan enum app_role di database).
const daftarPeran = ["cashier", "barista", "admin"] as const;

// Satu peran yang valid. Menulis nama di luar daftar ini ditolak saat ngetik kode.
export const AppRoleSchema = z.enum(daftarPeran);

// Tipe peran aplikasi.
export type AppRole = z.infer<typeof AppRoleSchema>;

// Halaman yang hanya boleh dibuka peran tertentu saja. Setiap entri berisi peran
// apa saja yang BOLEH membukanya.
//
// Mengikuti docs/pemissions.md bagian 2:
//   - /cashier boleh dibuka Cashier dan Admin. Admin boleh mengonfirmasi order
//     sebagai cadangan kalau Cashier berhalangan (order-flow.md bagian 7).
//   - /barista hanya boleh dibuka Barista. Pemisahan ini wajib karena layar
//     Barista sengaja berbeda dari layar Cashier.
//   - /admin hanya boleh dibuka Admin (kelola menu, stok, akun, dan log).
const halamanPerlPeran: Record<string, readonly AppRole[]> = {
  "/cashier": ["cashier", "admin"],
  "/barista": ["barista"],
  "/admin": ["admin"],
};

// Daftar seluruh halaman peran yang dilindungi.
export const HALAMAN_PERAN = ["/cashier", "/barista", "/admin"] as const;

/**
 * Menentukan halaman tujuan setelah login untuk sebuah peran.
 *
 * Input: peran (cashier / barista / admin).
 * Output: alamat halaman peran. Contoh: "cashier" menghasilkan "/cashier".
 *
 * Semua peran punya halaman sendiri, jadi tidak ada peran tanpa tujuan.
 */
export function pathUntukRole(role: AppRole): string {
  return `/${role}`;
}

/**
 * Memeriksa apakah sebuah peran boleh membuka sebuah path.
 *
 * Input:
 *   - role: peran pengguna yang sedang login.
 *   - path: alamat halaman yang ingin dibuka, contoh "/cashier".
 * Output: true kalau boleh, false kalau tidak.
 *
 * Cara kerja: kalau path itu bukan halaman peran (misalnya "/login" atau "/"),
 * jawabannya true, karena halaman umum tidak dibatasi peran. Kalau path-nya
 * halaman peran, jawabannya true hanya kalau perannya ada di daftar yang boleh.
 *
 * Path dinormalisasi lebih dulu: garis miring di akhir dihapus supaya "/admin/"
 * dan "/admin" dianggap sama, dan huruf besar-kecil diabaikan.
 */
export function peranBolehBukaPath(role: AppRole, path: string): boolean {
  const pathNormal = pathNormalisasi(path);

  // typeOfHalamanPeran adalah tipe salah satu path di HALAMAN_PERAN.
  type typeOfHalamanPeran = (typeof HALAMAN_PERAN)[number];

  // Kalau path ini bukan halaman peran, tidak ada pembatasan peran.
  if (!HALAMAN_PERAN.includes(pathNormal as typeOfHalamanPeran)) {
    return true;
  }

  // Di titik ini pathNormal pasti salah satu path di HALAMAN_PERAN.
  const peranYangBoleh = halamanPerlPeran[pathNormal];
  return peranYangBoleh.includes(role);
}

/**
 * Menormalkan path supaya perbandingan konsisten.
 *
 * Cara kerja: membuang garis miring di akhir dan mengubah huruf menjadi huruf
 * kecil. Contoh: "/Admin/" menjadi "/admin".
 */
function pathNormalisasi(path: string): string {
  return path.replace(/\/+$/, "").toLowerCase();
}
