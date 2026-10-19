// File ini: halaman Kelola Akun Admin (/admin/akun).
//
// Halaman ini TIPIS, sesuai aturan di AGENTS.md bagian "Tampilan": isinya hanya merakit
// hook (yang di dalam komponen LayarAkunClient) dan komponen tampilan. Semua logika ada
// di src/features/akun/.
//
// PROTEKSI PERAN (dari tugas 2.7, dipertahankan di sini):
//   1. wajibPeran("/admin/akun") dijalankan di server SEBELUM apa pun ditampilkan.
//      Hanya Admin yang boleh; Cashier, Barista, dan anonim ditolak
//      (docs/permissions.md bagian 2: hanya Admin yang boleh mengelola akun Cashier dan
//      Barista).
//   2. Server Action keluar (logoutAction).
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts. Proxy hanya
// pengarah; penjagaan yang sesungguhnya ada di baris pertama halaman. Endpoint
// /api/admin/accounts/* juga menjaganya sendiri, karena route handler bisa dipanggil
// langsung dari luar browser.
//
// CATATAN SOAL PENCATATAN: setiap aksi di halaman ini (buat akun, ubah, nonaktifkan,
// reset password) tercatat sendiri oleh server lewat logActivity. Membuka halaman ini
// sendiri tidak dicatat, karena itu hanya pembacaan (docs/logging.md bagian 2).

import { LayarAkunClient } from "@/components/akun/layar-akun-client";
import { wajibPeran } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";

export default async function HalamanAkunAdmin() {
  // Penjaga utama. Kalau pengguna bukan Admin, fungsi ini mengarahkan ke halamannya
  // sendiri, sehingga baris di bawah tidak pernah ikut dijalankan untuk orang yang tidak
  // berhak.
  const sesi = await wajibPeran("/admin/akun");

  return (
    <LayarAkunClient
      namaAkun={sesi.name}
      // Server Action keluar diteruskan sebagai prop supaya tombol Keluar di komponen
      // tampilan bisa memakainya. Cookie sesi dihapus di server.
      keluar={logoutAction}
    />
  );
}
