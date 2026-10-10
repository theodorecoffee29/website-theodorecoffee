// File ini: pembungkus layar Stok Admin yang berjalan di browser.
//
// Kenapa perlu: useStokAdmin memakai useState, useEffect, dan pemanggilan API,
// jadi hanya bisa jalan di browser. Halaman src/app/admin/stok/page.tsx
// berjalan di server (karena perlu membaca sesi), jadi halaman itu tidak bisa
// langsung memakai hook. File ini menjadi jembatan.

"use client";

import { LayarStokAdmin } from "@/components/admin/stok/layar-stok-admin";
import { useStokAdmin } from "@/features/admin/stok/use-stok-admin";

// Props dari halaman server.
type PropsLayarStokAdminClient = {
  // Nama akun Admin yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
};

/**
 * Merakit seluruh layar Stok Admin di sisi browser.
 *
 * Input: nama akun dan Server Action keluar.
 * Output: elemen React.
 */
export function LayarStokAdminClient({
  namaAkun,
  keluar,
}: PropsLayarStokAdminClient) {
  const keadaan = useStokAdmin();

  return (
    <LayarStokAdmin keadaan={keadaan} namaAkun={namaAkun} keluar={keluar} />
  );
}
