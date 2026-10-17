// File ini: pembungkus layar detail laporan yang berjalan di browser.
//
// Kenapa perlu: useLaporanDetail memakai useState, useEffect, dan pemanggilan API,
// jadi hanya bisa jalan di browser. Halaman src/app/*/laporan/[id]/page.tsx
// berjalan di server (karena perlu membaca sesi), jadi halaman itu tidak bisa
// langsung memakai hook. File ini menjadi jembatan.

"use client";

import { LayarDetailLaporan } from "@/components/laporan/layar-detail-laporan";
import { useLaporanDetail } from "@/features/laporan/use-laporan-detail";

// Props dari halaman server.
type PropsLayarDetailLaporanClient = {
  // Id laporan dari parameter halaman.
  reportId: string;
  // Nama akun staf yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
  // Alamat halaman daftar Riwayat, dipakai untuk tautan kembali.
  pathRiwayat: string;
};

/**
 * Merakit layar detail laporan di sisi browser.
 *
 * Input: id laporan, nama akun, Server Action keluar, dan path Riwayat.
 * Output: elemen React.
 */
export function LayarDetailLaporanClient({
  reportId,
  namaAkun,
  keluar,
  pathRiwayat,
}: PropsLayarDetailLaporanClient) {
  const keadaan = useLaporanDetail(reportId);

  return (
    <LayarDetailLaporan
      keadaan={keadaan}
      namaAkun={namaAkun}
      keluar={keluar}
      pathRiwayat={pathRiwayat}
    />
  );
}
