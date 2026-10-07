// File ini: halaman sementara untuk Admin (/admin).
//
// Halaman ini belum punya fitur apa pun. Yang ada hanya:
//   1. Penjagaan akses di sisi server lewat wajibPeran("/admin"). Wajib, karena
//      hanya Admin yang boleh membuka halaman ini: kelola menu dan resep,
//      ubah stok, kelola akun Cashier/Barista, dan melihat log
//      (docs/pemissions.md bagian 2).
//   2. Judul peran, nama akun, dan tombol keluar.
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts.
// Proxy hanya pengarah; penjagaan yang sesungguhnya ada di baris pertama halaman.
//
// Catatan: Admin boleh membuka /cashier sebagai cadangan kalau Cashier
// berhalangan (order-flow.md bagian 7). Aturan itu sudah ditangani di
// src/lib/auth/roles.ts.

import PanelPeran from "@/components/panel-peran";
import { wajibPeran } from "@/lib/auth/session";

export default async function HalamanAdmin() {
  // Penjaga utama. Kalau pengguna bukan Admin, fungsi ini mengarahkan ke
  // halamannya sendiri, sehingga baris di bawah tidak pernah ikut dijalankan
  // untuk orang yang tidak berhak.
  const sesi = await wajibPeran("/admin");

  return <PanelPeran sesi={sesi} path="/admin" />;
}
