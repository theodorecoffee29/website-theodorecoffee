// File ini: halaman sementara untuk Barista (/barista).
//
// Halaman ini belum punya fitur apa pun. Yang ada hanya:
//   1. Penjagaan akses di sisi server lewat wajibPeran("/barista"). Wajib,
//      karena hanya Barista yang boleh membuka halaman ini
//      (docs/pemissions.md bagian 2). Cashier dan Admin tidak, termasuk Admin
//      yang tidak memakai tombol Mulai dan Selesai.
//   2. Judul peran, nama akun, dan tombol keluar.
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts.
// Proxy hanya pengarah; penjagaan yang sesungguhnya ada di baris pertama halaman.
//
// Catatan tampilan: layar Barista nanti sengaja TIDAK boleh memuat harga dan
// data pembayaran (docs/pemissions.md bagian 2). Untuk sekarang belum ada data
// apa pun, jadi aman.

import PanelPeran from "@/components/panel-peran";
import { wajibPeran } from "@/lib/auth/session";

export default async function HalamanBarista() {
  // Penjaga utama. Kalau pengguna bukan Barista, fungsi ini mengarahkan ke
  // halamannya sendiri, sehingga baris di bawah tidak pernah ikut dijalankan
  // untuk orang yang tidak berhak.
  const sesi = await wajibPeran("/barista");

  return <PanelPeran sesi={sesi} path="/barista" />;
}
