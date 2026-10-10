// File ini: halaman Menu dan Resep Admin (/admin/menu).
//
// Halaman ini TIPIS, sesuai aturan di AGENTS.md bagian "Tampilan": isinya hanya
// merakit hook (yang di dalam komponen LayarMenuAdminClient) dan komponen
// tampilan. Semua logika ada di src/features/admin/menu/.
//
// Yang tetap dari tugas sebelumnya (tugas 2.7):
//   1. Penjagaan akses di sisi server lewat wajibPeran("/admin"). Wajib, karena
//      hanya Admin yang boleh mengelola menu dan resep (docs/pemissions.md
//      bagian 2).
//   2. Server Action keluar (logoutAction).
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts.
// Proxy hanya pengarah; penjagaan yang sesungguhnya ada di baris pertama halaman.

import { LayarMenuAdminClient } from "@/components/admin/menu/layar-menu-admin-client";
import { wajibPeran } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";

export default async function HalamanMenuAdmin() {
  // Penjaga utama. Kalau pengguna bukan Admin, fungsi ini mengarahkan ke
  // halamannya sendiri, sehingga baris di bawah tidak pernah ikut dijalankan
  // untuk orang yang tidak berhak.
  const sesi = await wajibPeran("/admin");

  return (
    <LayarMenuAdminClient
      namaAkun={sesi.name}
      // Server Action keluar diteruskan sebagai prop supaya tombol Keluar di
      // komponen tampilan bisa memakainya. Cookie sesi dihapus di server.
      keluar={logoutAction}
    />
  );
}
