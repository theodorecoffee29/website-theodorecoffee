// File ini: pembungkus layar log yang berjalan di browser.
//
// Kenapa perlu: useLogAdmin memakai useState, useEffect, dan pemanggilan API, jadi hanya
// bisa jalan di browser. Halaman src/app/admin/log/page.tsx berjalan di server (karena
// perlu membaca sesi), jadi halaman itu tidak bisa langsung memakai hook. File ini
// menjadi jembatan.

"use client";

import { LayarLog } from "@/components/log/layar-log";
import { useLogAdmin } from "@/features/log/use-log-admin";

// Props dari halaman server.
type PropsLayarLogClient = {
  // Nama akun Admin yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
};

/**
 * Merakit seluruh layar log di sisi browser.
 *
 * Input: nama akun dan Server Action keluar.
 * Output: elemen React.
 */
export function LayarLogClient({ namaAkun, keluar }: PropsLayarLogClient) {
  const keadaan = useLogAdmin();

  return <LayarLog keadaan={keadaan} namaAkun={namaAkun} keluar={keluar} />;
}
