// File ini: halaman Barista (/barista).
//
// Halaman ini TIPIS, sesuai aturan di AGENTS.md bagian "Tampilan": isinya hanya
// merakit hook (yang di dalam komponen LayarBaristaClient) dan komponen
// tampilan. Semua logika ada di src/features/barista/.
//
// Yang tetap ada dari tugas sebelumnya (tugas 2.7):
//   1. Penjagaan akses di sisi server lewat wajibPeran("/barista"). Wajib,
//      karena hanya Barista yang boleh membuka halaman ini
//      (docs/pemissions.md bagian 2). Cashier dan Admin tidak, termasuk Admin
//      yang tidak memakai tombol Mulai dan Selesai.
//   2. Server Action keluar (logoutAction).
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts.
// proxy.ts hanya pengarah; penjagaan yang sesungguhnya ada di baris pertama
// halaman. Karena penjagaan terjadi sebelum return, kode di bawahnya tidak
// pernah ikut dijalankan untuk orang yang tidak berhak.

import { LayarBaristaClient } from "@/components/barista/layar-barista-client";
import { wajibPeran } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";

export default async function HalamanBarista() {
  // Penjaga utama. Kalau pengguna bukan Barista, fungsi ini mengarahkan ke
  // halamannya sendiri, sehingga baris di bawah tidak pernah ikut dijalankan
  // untuk orang yang tidak berhak.
  const sesi = await wajibPeran("/barista");

  return (
    <LayarBaristaClient
      namaAkun={sesi.name}
      // Server Action keluar diteruskan sebagai prop supaya tombol Keluar di
      // komponen tampilan bisa memakainya. Cookie sesi dihapus di server.
      keluar={logoutAction}
    />
  );
}
