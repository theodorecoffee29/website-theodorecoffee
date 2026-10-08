// File ini: halaman Cashier (/cashier).
//
// Halaman ini TIPIS, sesuai aturan di AGENTS.md bagian "Tampilan": isinya hanya
// merakit hook (yang di dalam komponen LayarCashierClient) dan komponen
// tampilan. Semua logika ada di src/features/cashier/.
//
// Yang tetap ada dari tugas sebelumnya (tugas 2.7):
//   1. Penjagaan akses di sisi server lewat wajibPeran("/cashier"). Wajib,
//      Cashier dan Admin boleh membuka halaman ini (docs/pemissions.md bagian 2).
//   2. Server Action keluar (logoutAction).
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts.
// proxy.ts hanya pengarah; penjagaan yang sesungguhnya ada di baris pertama
// halaman. Karena penjagaan terjadi sebelum return, kode di bawahnya tidak
// pernah ikut dijalankan untuk orang yang tidak berhak.

import { LayarCashierClient } from "@/components/cashier/layar-cashier-client";
import { wajibPeran } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";

export default async function HalamanCashier() {
  // Penjaga utama. Kalau pengguna tidak login atau bukan Cashier/Admin, fungsi
  // ini mengarahkan ke /login atau ke halamannya sendiri, sehingga baris di
  // bawah tidak pernah ikut dijalankan untuk orang yang tidak berhak.
  const sesi = await wajibPeran("/cashier");

  return (
    <LayarCashierClient
      namaAkun={sesi.name}
      // Server Action keluar diteruskan sebagai prop supaya tombol Keluar di
      // komponen tampilan bisa memakainya. Cookie sesi dihapus di server.
      keluar={logoutAction}
    />
  );
}
