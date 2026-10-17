// File ini: pembungkus layar Laporan yang berjalan di browser.
//
// Kenapa perlu: useLaporanHariIni dan useRiwayatLaporan memakai useState,
// useEffect, dan pemanggilan API, jadi hanya bisa jalan di browser. Halaman
// src/app/*/laporan/page.tsx berjalan di server (karena perlu membaca sesi), jadi
// halaman itu tidak bisa langsung memakai hook. File ini menjadi jembatan.

"use client";

import { LayarLaporan } from "@/components/laporan/layar-laporan";
import { useLaporanHariIni } from "@/features/laporan/use-laporan-hari-ini";
import { useRiwayatLaporan } from "@/features/laporan/use-riwayat-laporan";

// Props dari halaman server.
type PropsLayarLaporanClient = {
  // Nama akun staf yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar.
  keluar: () => void;
  // Alamat halaman daftar Riwayat untuk area ini, misal "/cashier/laporan".
  pathRiwayat: string;
};

/**
 * Merakit seluruh layar Laporan di sisi browser.
 *
 * Input: nama akun, Server Action keluar, dan path Riwayat.
 * Output: elemen React.
 */
export function LayarLaporanClient({
  namaAkun,
  keluar,
  pathRiwayat,
}: PropsLayarLaporanClient) {
  // Dua hook terpisah karena masing-masing punya alasan sendiri untuk memuat:
  // laporan hari ini berubah tiap beberapa detik, sedangkan Riwayat hanya dimuat
  // sekali.
  const hariIni = useLaporanHariIni();
  const riwayat = useRiwayatLaporan();

  return (
    <LayarLaporan
      hariIni={hariIni}
      riwayat={riwayat}
      namaAkun={namaAkun}
      keluar={keluar}
      pathRiwayat={pathRiwayat}
    />
  );
}
