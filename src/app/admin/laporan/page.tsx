// File ini: halaman Laporan Admin (/admin/laporan).
//
// Halaman ini TIPIS, sesuai aturan di AGENTS.md bagian "Tampilan": isinya hanya
// merakit hook (yang di dalam komponen LayarLaporanClient) dan komponen tampilan.
// Semua logika ada di src/features/laporan/.
//
// Komponennya sama dengan /cashier/laporan, karena isi laporannya sama persis. Yang
// berbeda hanya aturan aksesnya.
//
// PROTEKSI PERAN (dari tugas 2.7, dipertahankan di sini):
//   1. wajibPeran("/admin/laporan") dijalankan di server SEBELUM apa pun
//      ditampilkan. Hanya Admin yang boleh; Cashier, Barista, dan anonim
//      ditolak (docs/pemissions.md bagian 2).
//   2. Server Action keluar (logoutAction).
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts.
// Proxy hanya pengarah; penjagaan yang sesungguhnya ada di baris pertama halaman.

import { LayarLaporanClient } from "@/components/laporan/layar-laporan-client";
import { wajibPeran } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";

export default async function HalamanLaporanAdmin() {
  // Penjaga utama. Kalau pengguna bukan Admin, fungsi ini mengarahkan ke halamannya
  // sendiri, sehingga baris di bawah tidak pernah ikut dijalankan untuk orang yang
  // tidak berhak.
  const sesi = await wajibPeran("/admin/laporan");

  return (
    <LayarLaporanClient
      namaAkun={sesi.name}
      // Server Action keluar diteruskan sebagai prop supaya tombol Keluar di
      // komponen tampilan bisa memakainya. Cookie sesi dihapus di server.
      keluar={logoutAction}
      // Path ini dipakai untuk tautan dari daftar Riwayat ke halaman detailnya.
      pathRiwayat="/admin/laporan"
    />
  );
}
