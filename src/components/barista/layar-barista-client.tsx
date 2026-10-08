// File ini: pembungkus layar Barista yang berjalan di browser.
//
// Kenapa perlu: useAntreanBarista memakai useState, useEffect, dan polling, jadi
// hanya bisa jalan di browser. Halaman src/app/barista/page.tsx berjalan di
// server (karena perlu membaca sesi), jadi halaman itu tidak bisa langsung
// memakai hook. File ini menjadi jembatan: dipanggil dari halaman server, lalu
// merakit hook dan komponen tampilan di sisi browser.
//
// Komponen ini juga mengurus judul tab browser, karena itu juga hanya bisa
// dilakukan di browser.

"use client";

import { useEffect } from "react";
import { LayarBarista } from "./layar-barista";
import { useAntreanBarista } from "@/features/barista/use-antrean-barista";
import { teksBarista } from "@/features/barista/teks";

// Props dari halaman server.
type PropsLayarBaristaClient = {
  // Nama akun Barista yang sedang login.
  namaAkun: string;
  // Server Action untuk keluar. Server Action boleh dikirim sebagai prop ke
  // komponen browser.
  keluar: () => void;
};

/**
 * Merakit seluruh layar Barista di sisi browser.
 *
 * Input: nama akun dan Server Action keluar.
 * Output: elemen React.
 */
export function LayarBaristaClient({
  namaAkun,
  keluar,
}: PropsLayarBaristaClient) {
  const keadaan = useAntreanBarista();

  // Judul tab browser: menampilkan jumlah pesanan Baru masuk, supaya Barista
  // tahu ada pesanan baru yang belum dikerjakan, bahkan tanpa melihat layar
  // (mis. sedang membuat pesanan sebelumnya).
  //
  // Judul hanya diubah kalau jumlahnya berubah, supaya tidak menulis judul
  // berulang tiap 3 detik.
  useEffect(() => {
    document.title =
      keadaan.jumlahBaruMasuk > 0
        ? teksBarista.order.judulTabDenganJumlah.replace(
            "{jumlah}",
            String(keadaan.jumlahBaruMasuk),
          )
        : teksBarista.order.judulTabTanpaJumlah;

    // Kembalikan judul semula saat halaman ditinggalkan.
    return () => {
      document.title = "";
    };
  }, [keadaan.jumlahBaruMasuk]);

  return <LayarBarista keadaan={keadaan} namaAkun={namaAkun} keluar={keluar} />;
}
