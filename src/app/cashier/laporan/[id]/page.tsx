// File ini: halaman detail satu laporan tersimpan untuk Cashier
// (/cashier/laporan/[id]).
//
// Halaman ini TIPIS, sesuai aturan di AGENTS.md bagian "Tampilan". Isinya hanya
// merakit hook (yang di dalam komponen LayarDetailLaporanClient) dan komponen
// tampilan. Semua logika ada di src/features/laporan/.
//
// PROTEKSI PERAN (dari tugas 2.7, dipertahankan di sini):
//   1. wajibPeran("/cashier/laporan/[id]") dijalankan di server SEBELUM apa pun
//      ditampilkan. Cashier dan Admin boleh; Barista dan anonim ditolak.
//   2. Server Action keluar (logoutAction).
//
// CATATAN TENTANG PATH PENJAGAAN: yang ditulis adalah "/cashier/laporan/[id]",
// BUKAN alamat dengan id aslinya. Alasannya, aturan "siapa boleh halaman ini"
// tidak berubah tiap laporan, jadi aturan itu cukup ditulis sekali untuk semua
// laporan. Daftar aturan ada di src/lib/auth/roles.ts.

import { LayarDetailLaporanClient } from "@/components/laporan/layar-detail-laporan-client";
import { wajibPeran } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";

// Di Next.js 15 ke atas, params harus di-await.
export default async function HalamanDetailLaporanCashier({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Penjaga utama, dijalankan sebelum apa pun ditampilkan.
  const sesi = await wajibPeran("/cashier/laporan/[id]");

  const { id } = await params;

  return (
    <LayarDetailLaporanClient
      reportId={id}
      namaAkun={sesi.name}
      // Server Action keluar diteruskan sebagai prop supaya tombol Keluar di
      // komponen tampilan bisa memakainya. Cookie sesi dihapus di server.
      keluar={logoutAction}
      pathRiwayat="/cashier/laporan"
    />
  );
}
