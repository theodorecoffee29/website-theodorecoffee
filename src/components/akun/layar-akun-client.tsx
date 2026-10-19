// File ini: pembungkus layar Kelola Akun yang berjalan di browser.
//
// Kenapa perlu: useAkunAdmin memakai useState, useEffect, dan pemanggilan API, jadi hanya
// bisa jalan di browser. Halaman src/app/admin/akun/page.tsx berjalan di server (karena
// perlu membaca sesi), jadi halaman itu tidak bisa langsung memakai hook. File ini
// menjadi jembatan.

"use client";

import { LayarAkun } from "@/components/akun/layar-akun";
import { useAkunAdmin } from "@/features/akun/use-akun-admin";

// Props dari halaman server.
type PropsLayarAkunClient = {
  // Nama akun Admin yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
};

/**
 * Merakit seluruh layar Kelola Akun di sisi browser.
 *
 * Input: nama akun dan Server Action keluar.
 * Output: elemen React.
 */
export function LayarAkunClient({ namaAkun, keluar }: PropsLayarAkunClient) {
  const keadaan = useAkunAdmin();

  return <LayarAkun keadaan={keadaan} namaAkun={namaAkun} keluar={keluar} />;
}
