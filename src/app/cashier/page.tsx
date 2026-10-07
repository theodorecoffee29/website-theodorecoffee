// File ini: halaman sementara untuk Cashier (/cashier).
//
// Halaman ini belum punya fitur apa pun. Yang ada hanya:
//   1. Penjagaan akses di sisi server lewat wajibPeran("/cashier"). Wajib,
//      Cashier dan Admin boleh membuka halaman ini (docs/pemissions.md bagian 2).
//   2. Judul peran, nama akun, dan tombol keluar.
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts.
//_proxy hanya pengarah; penjagaan yang sesungguhnya ada di baris pertama halaman.

import PanelPeran from "@/components/panel-peran";
import { wajibPeran } from "@/lib/auth/session";

export default async function HalamanCashier() {
  // Penjaga utama. Kalau pengguna tidak login atau bukan Cashier/Admin, fungsi
  // ini mengarahkan ke /login atau ke halamannya sendiri, sehingga baris di
  // bawah tidak pernah ikut dijalankan untuk orang yang tidak berhak.
  const sesi = await wajibPeran("/cashier");

  return <PanelPeran sesi={sesi} path="/cashier" />;
}
