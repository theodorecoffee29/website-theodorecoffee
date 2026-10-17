// File ini: halaman Laporan Cashier (/cashier/laporan).
//
// Halaman ini TIPIS, sesuai aturan di AGENTS.md bagian "Tampilan": isinya hanya
// merakit hook (yang di dalam komponen LayarLaporanClient) dan komponen tampilan.
// Semua logika ada di src/features/laporan/.
//
// Kenapa halaman ini memakai komponen yang sama dengan /admin/laporan: isi
// laporannya sama persis, yang berbeda hanya halaman induknya. Satu komponen dipakai
// dua kali supaya tidak ada bagian laporan yang berubah-ubah di antara keduanya
// (Fase 7 tinggal mengganti komponennya satu kali).
//
// PROTEKSI PERAN (dari tugas 2.7, dipertahankan di sini):
//   1. wajibPeran("/cashier/laporan") dijalankan di server SEBELUM apa pun
//      ditampilkan. Cashier dan Admin boleh; Barista dan anonim ditolak.
//   2. Server Action keluar (logoutAction).
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts.
// Proxy hanya pengarah; penjagaan yang sesungguhnya ada di baris pertama halaman.

import { LayarLaporanClient } from "@/components/laporan/layar-laporan-client";
import { wajibPeran } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";

export default async function HalamanLaporanCashier() {
  // Penjaga utama. Kalau pengguna tidak login atau bukan Cashier/Admin, fungsi ini
  // mengarahkan ke /login atau ke halamannya sendiri, sehingga baris di bawah tidak
  // pernah ikut dijalankan untuk orang yang tidak berhak.
  const sesi = await wajibPeran("/cashier/laporan");

  return (
    <LayarLaporanClient
      namaAkun={sesi.name}
      // Server Action keluar diteruskan sebagai prop supaya tombol Keluar di
      // komponen tampilan bisa memakainya. Cookie sesi dihapus di server.
      keluar={logoutAction}
      // Path ini dipakai untuk tautan dari daftar Riwayat ke halaman detailnya.
      pathRiwayat="/cashier/laporan"
    />
  );
}
