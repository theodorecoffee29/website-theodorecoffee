// File ini: membaca alamat IP pemanggil untuk pembatas permintaan.
//
// Kenapa perlu: pembatas permintaan di src/lib/server/pembatas-permintaan.ts
// menghitung per alamat IP. Route handler Next.js tidak menyediakan
// request.ip secara langsung di semua versi, jadi kita ambil dari header.
//
// Dari mana header ini berasal: di Vercel (tempat aplikasi ini dijalankan),
// header x-forwarded-for diisi oleh Vercel dan tidak bisa dipalsukan pengguna
// karena Vercel menimpanya sendiri. Kalau nanti aplikasi dijalankan di tempat
// lain, pastikan header ini memang berasal dari proxy yang tepercaya sebelum
// memakainya.

import type { NextRequest } from "next/server";

/**
 * Mengembalikan alamat IP pemanggil sebagai teks.
 *
 * Input: permintaan Next.js.
 * Output: alamat IP, atau teks "tidak diketahui" kalau header tidak ada.
 *
 * Cara kerja: x-forwarded-for berisi daftar IP, dan yang pertama adalah
 * pemanggil aslinya. x-real-ip dipakai kalau header pertama tidak ada.
 */
export function ambilIpPemanggil(request: NextRequest): string {
  const daftarIp = request.headers.get("x-forwarded-for");

  if (daftarIp) {
    // Ambil bagian pertama sebelum tanda koma.
    const ipPertama = daftarIp.split(",")[0].trim();
    if (ipPertama) {
      return ipPertama;
    }
  }

  const ipReal = request.headers.get("x-real-ip");
  if (ipReal) {
    return ipReal.trim();
  }

  // Tidak diketahui. Semua orang yang tidak punya header akan berbagi satu
  // penghitung, jadi batasnya lebih ketat untuk mereka. Itu lebih aman
  // daripada membiarkan semuanya lolos tanpa batas.
  return "tidak-diketahui";
}
