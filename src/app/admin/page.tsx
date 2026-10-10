// File ini: halaman utama Admin (/admin).
//
// Halaman ini masih sederhana: judul peran, nama akun, tombol keluar, dan daftar
// halaman Admin. Halaman-halaman Admin dibangun satu per satu di fase ini:
//   - Menu dan resep: /admin/menu (sudah ada).
//   - Stok: belum ada (dibuat di tugas berikutnya), jadi belum bisa dibuka.
//
// Yang tetap dari tugas sebelumnya (tugas 2.7):
//   1. Penjagaan akses di sisi server lewat wajibPeran("/admin"). Wajib, karena
//      hanya Admin yang boleh membuka halaman ini: kelola menu dan resep, ubah
//      stok, kelola akun Cashier/Barista, dan melihat log
//      (docs/pemissions.md bagian 2).
//   2. Server Action keluar (logoutAction).
//
// Pengecekan peran dilakukan DI SINI, di server, bukan hanya di src/proxy.ts.
// Proxy hanya pengarah; penjagaan yang sesungguhnya ada di baris pertama halaman.
//
// Catatan: Admin boleh membuka /cashier sebagai cadangan kalau Cashier
// berhalangan (order-flow.md bagian 7). Aturan itu sudah ditangani di
// src/lib/auth/roles.ts.

import Link from "next/link";
import PanelPeran from "@/components/panel-peran";
import { wajibPeran } from "@/lib/auth/session";
import { teksMenuAdmin } from "@/features/admin/menu/teks";

export default async function HalamanAdmin() {
  // Penjaga utama. Kalau pengguna bukan Admin, fungsi ini mengarahkan ke
  // halamannya sendiri, sehingga baris di bawah tidak pernah ikut dijalankan
  // untuk orang yang tidak berhak.
  const sesi = await wajibPeran("/admin");

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Identitas Admin dan tombol keluar. */}
        <PanelPeran sesi={sesi} path="/admin" />

        {/* Daftar halaman Admin. Menu dan resep sudah bisa dibuka; stok menyusul
            (belum ada tautannya karena halamannya belum dibuat). */}
        <nav className="rounded border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Halaman Admin</h2>

          <ul className="mt-2 space-y-2">
            <li>
              <Link href="/admin/menu" className="text-sm underline">
                {teksMenuAdmin.menuDanResep}
              </Link>
            </li>

            {/* Stok belum ada halamannya, jadi hanya ditampilkan sebagai
                informasi, belum bisa diklik. */}
            <li>
              <span className="text-sm text-gray-500">
                {teksMenuAdmin.stokSegera}
              </span>
            </li>
          </ul>
        </nav>
      </div>
    </main>
  );
}
