// File ini: halaman log Admin (/admin/log).
//
// Halaman ini TIPIS, sesuai aturan di AGENTS.md bagian "Tampilan": isinya hanya merakit
// hook (yang di dalam komponen LayarLogClient) dan komponen tampilan. Semua logika ada
// di src/features/log/.
//
// PROTEKSI PERAN (dari tugas 2.7, dipertahankan di sini):
//   1. wajibPeran("/admin/log") dijalankan di server SEBELUM apa pun ditampilkan. Hanya
//      Admin yang boleh; Cashier, Barista, dan anonim ditolak
//      (docs/pemissions.md bagian 2: hanya Admin yang boleh membaca log).
//   2. Server Action keluar (logoutAction).
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts. Proxy hanya
// pengarah; penjagaan yang sesungguhnya ada di baris pertama halaman. Endpoint
// /api/admin/logs/* juga menjaganya sendiri, karena route handler bisa dipanggil langsung
// dari luar browser.
//
// CATATAN SOAL PENCATATAN: membuka halaman ini SENGAJA tidak dicatat ke activity_logs,
// karena itu hanya pembacaan data (docs/logging.md bagian 2: "Tidak dicatat: membuka
// halaman laporan atau log"). Kalau dicatat, setiap Admin yang membuka halaman akan
// mengisi log dengan baris yang tidak berguna.

import { LayarLogClient } from "@/components/log/layar-log-client";
import { wajibPeran } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";

export default async function HalamanLogAdmin() {
  // Penjaga utama. Kalau pengguna bukan Admin, fungsi ini mengarahkan ke halamannya
  // sendiri, sehingga baris di bawah tidak pernah ikut dijalankan untuk orang yang tidak
  // berhak.
  const sesi = await wajibPeran("/admin/log");

  return (
    <LayarLogClient
      namaAkun={sesi.name}
      // Server Action keluar diteruskan sebagai prop supaya tombol Keluar di komponen
      // tampilan bisa memakainya. Cookie sesi dihapus di server.
      keluar={logoutAction}
    />
  );
}
